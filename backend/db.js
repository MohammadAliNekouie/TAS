const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { normalizePersian } = require("./lib/persian");
const { COA_LEVEL1, COA_LEVEL2, COA_LEVEL3 } = require("./lib/coa-seed-data");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

let db;
try {
  db = new Database(path.join(DATA_DIR, "accounting.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
} catch (err) {
  // A failure here is one of two things in practice:
  //  1) SQLITE_READONLY — the db file/folder isn't writable by this user
  //     (wrong owner, read-only mount, permissions), or
  //  2) better-sqlite3's native binding failed to build/install.
  // Diagnose which one it is and print steps for that specific case,
  // instead of one generic message that may not match the real cause.
  console.error("\n❌ Failed to open/initialize the database.\n");
  console.error(err.message);

  if (err.code === "SQLITE_READONLY" || /readonly/i.test(err.message)) {
    console.error(`
این خطا یعنی SQLite اجازه نوشتن روی فایل پایگاه داده یا پوشه آن (backend/data) را ندارد — این یک مشکل مجوز فایل است، نه باگ برنامه. این مراحل را امتحان کنید:

  1) بررسی مالک و مجوز پوشه:
       ls -ld backend/data
       ls -l backend/data/accounting.db   (در صورت وجود)

  2) اگر پوشه توسط کاربر دیگری ساخته شده یا مجوز نوشتن ندارد:
       chmod -R u+w backend/data
     یا برای شروع کاملاً تازه:
       rm -rf backend/data
       npm run dev

  3) اگر مشکل حل نشد، بررسی کنید که این مسیر روی یک درایو read-only یا شبکه‌ای قرار نداشته باشد
     (مثلاً یک درایو NTFS/exFAT که به‌صورت پیش‌فرض read-only مانت شده است):
       touch backend/data/test-write && echo "writable" || echo "NOT writable"
     اگر نوشتن ممکن نبود، کل پوشه پروژه را به مسیری عادی مثل ~/projects منتقل کنید و دوباره اجرا کنید.
`);
  } else {
    console.error(`
این خطا معمولاً یعنی ماژول native کتابخانه better-sqlite3 درست نصب نشده است. این مراحل را امتحان کنید:

  1) نسخه Node.js را بررسی کنید (نسخه ۱۸ یا ۲۰ پیشنهاد می‌شود): node -v
  2) داخل پوشه backend اجرا کنید:
       rm -rf node_modules package-lock.json
       npm install
  3) اگر باز هم خطا داد، ماژول را مستقیم rebuild کنید:
       npm rebuild better-sqlite3
  4) در ویندوز ممکن است نیاز به "Visual Studio Build Tools" (workload: Desktop development with C++) داشته باشید.
     در مک: xcode-select --install
     در لینوکس: sudo apt install build-essential python3
`);
  }
  process.exit(1);
}

// Warehouses are needed even before any inventory items exist (e.g. so the
// "add item" form always has at least one to default to), so this seeds
// independently and idempotently regardless of inventory_nodes' state.
function seedDefaultWarehouse() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM warehouses").get().c;
  if (count > 0) return;
  const insert = db.prepare("INSERT INTO warehouses (name) VALUES (?)");
  insert.run("انبار مرکزی");
  insert.run("انبار شعبه ۲");
}
seedDefaultWarehouse();

// چارت حساب‌ها (کدینگ حسابداری) — از فایل کدینگ ارائه‌شده توسط کاربر
// (نمونه‌ی «بازرگانی») seed می‌شود. سطح ۱ ثابت است؛ سطح ۲ و ۳ توسط کاربر
// قابل افزودن/ویرایش/حذف هستند.
function seedChartOfAccounts() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM chart_of_accounts").get().c;
  if (count > 0) return;

  const insert = db.prepare(
    `INSERT INTO chart_of_accounts (code, level, parent_id, name, name_normalized)
     VALUES (@code, @level, @parent_id, @name, @name_normalized)`
  );

  const tx = db.transaction(() => {
    const l1IdByCode = {};
    for (const g of COA_LEVEL1) {
      const info = insert.run({
        code: g.code, level: 1, parent_id: null, name: g.name, name_normalized: normalizePersian(g.name),
      });
      l1IdByCode[g.code] = info.lastInsertRowid;
    }
    const l2IdByCode = {};
    for (const g of COA_LEVEL2) {
      const parentId = l1IdByCode[g.l1_code];
      if (!parentId) continue;
      const info = insert.run({
        code: g.code, level: 2, parent_id: parentId, name: g.name, name_normalized: normalizePersian(g.name),
      });
      l2IdByCode[g.code] = info.lastInsertRowid;
    }
    for (const a of COA_LEVEL3) {
      const parentId = l2IdByCode[a.l2_code];
      if (!parentId) continue;
      insert.run({
        code: a.code, level: 3, parent_id: parentId, name: a.name, name_normalized: normalizePersian(a.name),
      });
    }
  });

  tx();
  console.log(`Seeded chart of accounts: ${COA_LEVEL1.length} groups, ${COA_LEVEL2.length} subgroups, ${COA_LEVEL3.length} accounts.`);
}
seedChartOfAccounts();

// یک حساب مدیر سیستم پیش‌فرض با رمز تصادفی (نه یک رمز حدس‌زدنی مثل admin)
// در اولین اجرا ساخته می‌شود و رمز فقط همان یک‌بار در کنسول چاپ می‌شود.
function seedDefaultAdmin() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return;

  const crypto = require("crypto");
  const { hashPassword } = require("./lib/auth");
  const password = crypto.randomBytes(6).toString("base64url");

  db.prepare("INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)")
    .run("admin", hashPassword(password), "مدیر سیستم", "admin");

  console.log("\n============================================================");
  console.log("  حساب مدیر سیستم پیش‌فرض ساخته شد — این پیام فقط یک‌بار نمایش داده می‌شود:");
  console.log(`  نام کاربری: admin`);
  console.log(`  رمز عبور:   ${password}`);
  console.log("  لطفاً این رمز را یادداشت کنید و پس از ورود از بخش کاربران تغییر دهید.");
  console.log("============================================================\n");
}
seedDefaultAdmin();

module.exports = db;
