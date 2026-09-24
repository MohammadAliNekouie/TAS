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
  // Backward-compatible schema migrations for databases created by older releases.
  if (!db.prepare("PRAGMA table_info(stock_adjustment_items)").all().some(c => c.name === "unit_cost")) {
    db.exec("ALTER TABLE stock_adjustment_items ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0");
  }
  db.exec(`CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER REFERENCES users(id),action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id INTEGER,details TEXT,ip_address TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type,entity_id);
CREATE TABLE IF NOT EXISTS financial_periods(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,start_date TEXT NOT NULL,end_date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')));
CREATE TABLE IF NOT EXISTS inventory_ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,item_id INTEGER NOT NULL REFERENCES inventory_nodes(id),event_date TEXT NOT NULL,source_type TEXT NOT NULL,source_id INTEGER NOT NULL,quantity_in REAL NOT NULL DEFAULT 0 CHECK(quantity_in>=0),quantity_out REAL NOT NULL DEFAULT 0 CHECK(quantity_out>=0),unit_cost REAL NOT NULL DEFAULT 0 CHECK(unit_cost>=0),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(source_type,source_id,item_id));
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_item_date ON inventory_ledger(item_id,event_date,id);`);
  // v1.1/v2 migrations: additive columns keep existing installations upgradeable.
  const addColumn = (table, column, definition) => {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  addColumn('sales_purchase_invoices','invoice_kind',"TEXT NOT NULL DEFAULT 'normal'");
  addColumn('sales_purchase_invoices','original_invoice_id','INTEGER');
  addColumn('sales_purchase_invoices','subtotal','REAL NOT NULL DEFAULT 0');
  addColumn('sales_purchase_invoices','discount_amount','REAL NOT NULL DEFAULT 0');
  addColumn('sales_purchase_invoices','tax_rate','REAL NOT NULL DEFAULT 0');
  addColumn('sales_purchase_invoices','tax_amount','REAL NOT NULL DEFAULT 0');
  addColumn('receipts_payments','bank_account_id','INTEGER');
  addColumn('receipts_payments','cheque_id','INTEGER');
  addColumn('cheques','bank_account_id','INTEGER');
  addColumn('petty_cash','bank_account_id','INTEGER');
  addColumn('stock_adjustment_items','unit_cost','REAL NOT NULL DEFAULT 0');
  addColumn('accounting_settings','cash_account_id','INTEGER');
  addColumn('accounting_settings','petty_cash_account_id','INTEGER');
  addColumn('accounting_settings','vat_account_id','INTEGER');
  addColumn('accounting_settings','expense_account_id','INTEGER');
  addColumn('accounting_settings','other_payable_account_id','INTEGER');
  addColumn('accounting_settings','cheque_receivable_account_id','INTEGER');
  addColumn('accounting_settings','cheque_payable_account_id','INTEGER');
  addColumn('accounting_settings','retained_earnings_account_id','INTEGER');
  addColumn('accounting_settings','opening_closing_account_id','INTEGER');
  db.exec(`UPDATE sales_purchase_invoices SET subtotal=total_amount WHERE subtotal=0 AND total_amount>0;
CREATE TABLE IF NOT EXISTS invoice_links(id INTEGER PRIMARY KEY AUTOINCREMENT,invoice_id INTEGER NOT NULL REFERENCES sales_purchase_invoices(id) ON DELETE CASCADE,linked_invoice_id INTEGER NOT NULL REFERENCES sales_purchase_invoices(id),relation_type TEXT NOT NULL CHECK(relation_type IN ('return_of','amends')),UNIQUE(invoice_id,linked_invoice_id,relation_type));
CREATE TABLE IF NOT EXISTS closing_entries(id INTEGER PRIMARY KEY AUTOINCREMENT,period_id INTEGER NOT NULL REFERENCES financial_periods(id),voucher_id INTEGER NOT NULL REFERENCES journal_vouchers(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(period_id));
CREATE INDEX IF NOT EXISTS idx_invoice_links_invoice ON invoice_links(invoice_id);`);

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

function ensureOperationalAccounts(){
  const defaults=[['7307','بهای تمام‌شده کالای فروش‌رفته','73'],['1190','بانک اختصاصی ۱','11']];
  for(const [code,name,parentCode] of defaults){
    if(db.prepare('SELECT 1 FROM chart_of_accounts WHERE code=?').get(code)) continue;
    const parent=db.prepare('SELECT id FROM chart_of_accounts WHERE code=?').get(parentCode);
    if(parent) db.prepare('INSERT INTO chart_of_accounts(code,level,parent_id,name,name_normalized) VALUES(?,3,?,?,?)').run(code,parent.id,name,normalizePersian(name));
  }
}
ensureOperationalAccounts();

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
