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

function seedIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM inventory_nodes").get().c;
  if (count > 0) return; // already seeded

  const central = db.prepare("SELECT id FROM warehouses WHERE name = ?").get("انبار مرکزی").id;
  const branch2 = db.prepare("SELECT id FROM warehouses WHERE name = ?").get("انبار شعبه ۲")?.id || central;

  const insertNode = db.prepare(`
    INSERT INTO inventory_nodes (code, level, parent_id, name, name_normalized, unit, warehouse_id, min_qty, qty_on_hand)
    VALUES (@code, @level, @parent_id, @name, @name_normalized, @unit, @warehouse_id, @min_qty, @qty_on_hand)
  `);

  const tx = db.transaction(() => {
    // level 1
    const l1a = insertNode.run({
      code: "01", level: 1, parent_id: null, name: "لوازم یدکی",
      name_normalized: normalizePersian("لوازم یدکی"), unit: null, warehouse_id: null, min_qty: null, qty_on_hand: null,
    }).lastInsertRowid;
    const l1b = insertNode.run({
      code: "02", level: 1, parent_id: null, name: "روغن و روانکار",
      name_normalized: normalizePersian("روغن و روانکار"), unit: null, warehouse_id: null, min_qty: null, qty_on_hand: null,
    }).lastInsertRowid;

    // level 2
    const l2filter = insertNode.run({
      code: "01-03", level: 2, parent_id: l1a, name: "فیلتر",
      name_normalized: normalizePersian("فیلتر"), unit: null, warehouse_id: null, min_qty: null, qty_on_hand: null,
    }).lastInsertRowid;
    const l2tire = insertNode.run({
      code: "01-05", level: 2, parent_id: l1a, name: "لاستیک و رینگ",
      name_normalized: normalizePersian("لاستیک و رینگ"), unit: null, warehouse_id: null, min_qty: null, qty_on_hand: null,
    }).lastInsertRowid;
    const l2electric = insertNode.run({
      code: "01-07", level: 2, parent_id: l1a, name: "برقی",
      name_normalized: normalizePersian("برقی"), unit: null, warehouse_id: null, min_qty: null, qty_on_hand: null,
    }).lastInsertRowid;
    const l2engineOil = insertNode.run({
      code: "02-01", level: 2, parent_id: l1b, name: "روغن موتور",
      name_normalized: normalizePersian("روغن موتور"), unit: null, warehouse_id: null, min_qty: null, qty_on_hand: null,
    }).lastInsertRowid;

    // level 3 (leaf items)
    const items = [
      { code: "01-03-0027", parent: l2filter, name: "فیلتر روغن مدل A12", unit: "عدد", warehouse_id: central, min_qty: 30, qty_on_hand: 11 },
      { code: "01-03-0031", parent: l2filter, name: "فیلتر هوا مدل B4", unit: "عدد", warehouse_id: central, min_qty: 25, qty_on_hand: 40 },
      { code: "01-05-0002", parent: l2tire, name: "لاستیک ۱۷۵/۶۵R14", unit: "حلقه", warehouse_id: branch2, min_qty: 10, qty_on_hand: 2 },
      { code: "01-07-0015", parent: l2electric, name: "باتری ۶۰ آمپر", unit: "عدد", warehouse_id: central, min_qty: 15, qty_on_hand: 6 },
      { code: "02-01-0004", parent: l2engineOil, name: "روغن موتور ۵ لیتری", unit: "قوطی", warehouse_id: central, min_qty: 20, qty_on_hand: 4 },
      { code: "02-01-0009", parent: l2engineOil, name: "روغن موتور ۱ لیتری", unit: "قوطی", warehouse_id: central, min_qty: 40, qty_on_hand: 55 },
    ];
    for (const it of items) {
      insertNode.run({
        code: it.code, level: 3, parent_id: it.parent, name: it.name,
        name_normalized: normalizePersian(it.name), unit: it.unit, warehouse_id: it.warehouse_id,
        min_qty: it.min_qty, qty_on_hand: it.qty_on_hand,
      });
    }

    // events
    const insertEvent = db.prepare(
      "INSERT INTO events (text, tone, icon, created_at) VALUES (?, ?, ?, datetime('now', ?))"
    );
    insertEvent.run("فاکتور فروش شماره ۱۰۲۳۴ برای «شرکت آریا صنعت» صادر شد", "teal", "receipt", "-10 minutes");
    insertEvent.run("چک به مبلغ ۴۵۰,۰۰۰,۰۰۰ ریال از «فروشگاه پارسیان» وصول شد", "gold", "fileCheck", "-45 minutes");
    insertEvent.run("فاکتور خرید شماره ۸۸۱۲ در سامانه مودیان تایید شد", "teal", "fileCheck", "-1 hours");
    insertEvent.run("پرداخت به تامین‌کننده «فولاد البرز» ثبت شد", "brick", "landmark", "-2 hours");
    insertEvent.run("موجودی «روغن موتور ۵ لیتری» به زیر حد مجاز رسید", "brick", "alertTriangle", "-3 hours");

    // cheques
    const insertCheque = db.prepare(
      "INSERT INTO cheques (party, amount, due_date, status) VALUES (?, ?, ?, ?)"
    );
    insertCheque.run("شرکت آریا صنعت", 68000000, "۱۴۰۵/۰۶/۱۸", "در جریان وصول");
    insertCheque.run("فروشگاه پارسیان", 24500000, "۱۴۰۵/۰۶/۲۰", "در جریان وصول");
    insertCheque.run("فولاد البرز", 112000000, "۱۴۰۵/۰۶/۲۳", "نزد صندوق");

    // sales_daily: 30 points, last 7 also read from the tail of this same series
    const insertSale = db.prepare("INSERT INTO sales_daily (label, value, seq) VALUES (?, ?, ?)");
    const weekdayLabels = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];
    for (let i = 0; i < 30; i++) {
      const label = i >= 23 ? weekdayLabels[i - 23] : `روز ${i + 1}`;
      const value = Math.round(35 + Math.random() * 60 + (i / 30) * 25);
      insertSale.run(label, value, i + 1);
    }

    // kpis
    const insertKpi = db.prepare(`
      INSERT INTO kpis (key, label, value, delta, up, icon) VALUES (@key, @label, @value, @delta, @up, @icon)
    `);
    insertKpi.run({ key: "sales_today", label: "فروش امروز", value: 128500000, delta: 12.4, up: 1, icon: "trendingUp" });
    insertKpi.run({ key: "receivables", label: "مطالبات (دریافتنی)", value: 941200000, delta: -3.1, up: 0, icon: "receipt" });
    insertKpi.run({ key: "payables", label: "بدهی (پرداختنی)", value: 512300000, delta: 5.8, up: 1, icon: "creditCard" });
    insertKpi.run({ key: "cash_bank", label: "موجودی نقد و بانک", value: 1873400000, delta: 2.0, up: 1, icon: "wallet" });
  });

  tx();
  console.log("Seeded sample data.");
}

seedIfEmpty();

module.exports = db;
