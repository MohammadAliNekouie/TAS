-- انبارها (مکان‌های فیزیکی نگهداری کالا) — انبار مرکزی به‌صورت پیش‌فرض seed می‌شود
CREATE TABLE IF NOT EXISTS warehouses (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- Inventory / product classification: max 3 levels, fixed-width coding.
-- level 1 = گروه کالا (2 digits)   e.g. 01
-- level 2 = زیرگروه (2 digits)     e.g. 01-03
-- level 3 = کالا (4 digits, leaf)  e.g. 01-03-0027
CREATE TABLE IF NOT EXISTS inventory_nodes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,
  level           INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  parent_id       INTEGER REFERENCES inventory_nodes(id),
  name            TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  unit            TEXT,
  warehouse_id    INTEGER REFERENCES warehouses(id),
  min_qty         REAL,
  qty_on_hand     REAL,
  -- میانگین موزون بهای هر واحد؛ فقط با ثبت فاکتور خرید به‌روزرسانی می‌شود.
  avg_cost        REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_inventory_parent ON inventory_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_inventory_code ON inventory_nodes(code);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory_nodes(name_normalized);

CREATE TABLE IF NOT EXISTS cheques (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL DEFAULT 'received' CHECK (type IN ('received', 'issued')),
  party       TEXT NOT NULL,
  amount      REAL NOT NULL,
  due_date    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'در جریان وصول',
  sayad_id    TEXT,
  endorsed_to TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- اطلاعات شرکت (تنظیمات اولیه) — تک رکورد با id ثابت ۱
CREATE TABLE IF NOT EXISTS company_info (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  name               TEXT,
  legal_id           TEXT,
  economic_code      TEXT,
  address            TEXT,
  phone              TEXT,
  preferred_currency TEXT DEFAULT NULL CHECK (preferred_currency IS NULL OR preferred_currency IN ('usd', 'eur', 'cny'))
);

-- حساب‌های بانکی (تنظیمات اولیه)
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  bank_name       TEXT,
  sheba           TEXT,
  initial_balance REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  coa_account_id  INTEGER REFERENCES chart_of_accounts(id)
);

-- خرید و فروش: سربرگ فاکتور (هر فاکتور شامل چند آیتم انبار است)
CREATE TABLE IF NOT EXISTS sales_purchase_invoices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  type            TEXT NOT NULL CHECK (type IN ('sale', 'purchase')),
  party           TEXT NOT NULL,
  invoice_date    TEXT NOT NULL,
  bank_account_id INTEGER REFERENCES bank_accounts(id),
  total_amount    REAL NOT NULL DEFAULT 0,
  description     TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ردیف‌های فاکتور — هر ردیف به یک کالای تعریف‌شده در انبار اشاره می‌کند
CREATE TABLE IF NOT EXISTS invoice_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id        INTEGER NOT NULL REFERENCES sales_purchase_invoices(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_nodes(id),
  quantity          REAL NOT NULL,
  unit_price        REAL NOT NULL,
  line_total        REAL NOT NULL
);

-- سند حسابداری خودکار حاصل از ثبت هر فاکتور (برداشت/واریز از حساب بانکی)
CREATE TABLE IF NOT EXISTS journal_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id      INTEGER REFERENCES sales_purchase_invoices(id) ON DELETE CASCADE,
  entry_date      TEXT NOT NULL,
  bank_account_id INTEGER REFERENCES bank_accounts(id),
  amount          REAL NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  description     TEXT
);

-- طرف‌های حساب (مشتریان و تامین‌کنندگان)
-- کد نمایشی (مثل P-0001) از روی id ساخته می‌شود؛ چون ستون id با
-- AUTOINCREMENT تعریف شده، SQLite هرگز یک id حذف‌شده را دوباره استفاده
-- نمی‌کند، پس این کد هم منحصر به فرد می‌ماند و بعد از حذف تکرار نمی‌شود.
CREATE TABLE IF NOT EXISTS parties (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'both' CHECK (type IN ('customer', 'supplier', 'both')),
  -- شخص حقیقی یا حقوقی — برای تشخیص نیاز به یادآوری ثبت در سامانه مودیان
  legal_status    TEXT DEFAULT NULL CHECK (legal_status IS NULL OR legal_status IN ('individual', 'legal')),
  phone           TEXT,
  economic_code   TEXT,
  address         TEXT,
  description     TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_name_unique ON parties(name_normalized);

-- یادآوری بررسی/ثبت فاکتور در سامانه مودیان — وقتی فروش به شخص حقیقی یا
-- خرید از شخص حقوقی ثبت می‌شود، چون این نرم‌افزار مستقیماً به سامانه
-- مودیان ارسال نمی‌کند، یک یادآوری در داشبورد نمایش داده می‌شود.
CREATE TABLE IF NOT EXISTS modayan_reminders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES sales_purchase_invoices(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dismissed  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS receipts_payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL CHECK (type IN ('receipt', 'payment')),
  party        TEXT NOT NULL,
  method       TEXT NOT NULL,
  payment_date TEXT NOT NULL,
  amount       REAL NOT NULL,
  description  TEXT,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- تنخواه‌گردان
CREATE TABLE IF NOT EXISTS petty_cash (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_name   TEXT NOT NULL,
  entry_date  TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('topup', 'expense')),
  category    TEXT,
  amount      REAL NOT NULL,
  description TEXT
);

-- حسابداری چند ارزی
CREATE TABLE IF NOT EXISTS fx_transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date  TEXT NOT NULL,
  currency    TEXT NOT NULL,
  rate        REAL NOT NULL,
  amount_fc   REAL NOT NULL,
  amount_rial REAL,
  description TEXT
);

-- مدیریت تولید
CREATE TABLE IF NOT EXISTS production_orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_date   TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity     REAL NOT NULL,
  status       TEXT NOT NULL DEFAULT 'در حال تولید',
  description  TEXT
);

-- سامانه مودیان
CREATE TABLE IF NOT EXISTS modayan_submissions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_ref      TEXT NOT NULL,
  submission_date  TEXT NOT NULL,
  tax_id           TEXT,
  status           TEXT NOT NULL DEFAULT 'ارسال شده',
  description      TEXT
);

-- کدینگ حسابداری (چارت حساب‌ها) — سه سطح: گروه اصلی (۱ رقم، ثابت طبق
-- استاندارد)، گروه کل (۲ رقم)، حساب معین/تفصیلی (۴ رقم). فقط سطح ۲ و ۳
-- قابل افزودن/ویرایش/حذف هستند؛ سطح ۱ طبقه‌بندی ثابت صورت‌های مالی است.
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  code            TEXT NOT NULL UNIQUE,
  level           INTEGER NOT NULL CHECK (level IN (1, 2, 3)),
  parent_id       INTEGER REFERENCES chart_of_accounts(id),
  name            TEXT NOT NULL,
  name_normalized TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coa_parent ON chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_coa_code ON chart_of_accounts(code);
CREATE INDEX IF NOT EXISTS idx_coa_name ON chart_of_accounts(name_normalized);

-- اسناد حسابداری (دستی یا خودکار از سایر بخش‌ها) — سربرگ سند
CREATE TABLE IF NOT EXISTS journal_vouchers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_date TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'permanent' CHECK (status IN ('draft', 'approved', 'permanent')),
  -- اسنادی که source_type دارند به‌صورت خودکار از یک فاکتور/رویداد دیگر
  -- ساخته شده‌اند و باید فقط از طریق همان منبع ویرایش/حذف شوند، نه مستقیم.
  source_type  TEXT,
  source_id    INTEGER,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ردیف‌های سند — هر ردیف یا بدهکار است یا بستانکار (یکی صفر است)
CREATE TABLE IF NOT EXISTS journal_voucher_lines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id  INTEGER NOT NULL REFERENCES journal_vouchers(id) ON DELETE CASCADE,
  account_id  INTEGER NOT NULL REFERENCES chart_of_accounts(id),
  debit       REAL NOT NULL DEFAULT 0,
  credit      REAL NOT NULL DEFAULT 0,
  description TEXT
);

-- کاربران و سطح دسترسی (احراز هویت پایه)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'accountant' CHECK (role IN ('admin', 'accountant', 'viewer')),
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- تنظیمات اتصال حسابداری — نگاشت حساب‌های پیش‌فرض که فاکتورها بر اساس
-- آن‌ها به‌صورت خودکار سند حسابداری واقعی (بدهکار/بستانکار) می‌سازند.
CREATE TABLE IF NOT EXISTS accounting_settings (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  sales_account_id   INTEGER REFERENCES chart_of_accounts(id),
  cogs_account_id    INTEGER REFERENCES chart_of_accounts(id),
  inventory_account_id INTEGER REFERENCES chart_of_accounts(id),
  ar_account_id      INTEGER REFERENCES chart_of_accounts(id),
  ap_account_id      INTEGER REFERENCES chart_of_accounts(id)
);

-- فرمول تولید (BOM) — سربرگ: نام فرمول و کالای خروجی
CREATE TABLE IF NOT EXISTS production_formulas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  output_item_id INTEGER NOT NULL REFERENCES inventory_nodes(id),
  description    TEXT
);

-- قطعات لازم برای هر واحد از فرمول (بدون قیمت — قیمت در «فرایند تولید» در لحظه تعیین می‌شود)
CREATE TABLE IF NOT EXISTS production_formula_components (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  formula_id  INTEGER NOT NULL REFERENCES production_formulas(id) ON DELETE CASCADE,
  item_id     INTEGER NOT NULL REFERENCES inventory_nodes(id),
  quantity    REAL NOT NULL,
  description TEXT
);

-- خدمات لازم برای فرمول (مونتاژ، برش‌کاری و ...) — بدون هزینه ذخیره‌شده
CREATE TABLE IF NOT EXISTS production_formula_services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  formula_id  INTEGER NOT NULL REFERENCES production_formulas(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT
);

-- فرایند تولید — اجرای واقعی یک فرمول در یک لحظه با قیمت‌های همان روز
CREATE TABLE IF NOT EXISTS production_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  formula_id  INTEGER REFERENCES production_formulas(id),
  formula_name TEXT NOT NULL, -- کپی نام فرمول در لحظه اجرا (اگر فرمول بعداً تغییر/حذف شود)
  run_date    TEXT NOT NULL,
  quantity    REAL NOT NULL,
  total_cost  REAL NOT NULL,
  unit_cost   REAL NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_run_components (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id     INTEGER NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES inventory_nodes(id),
  quantity   REAL NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS production_run_services (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
  name   TEXT NOT NULL,
  cost   REAL NOT NULL
);

-- کالا در گردش — کسر/افزودن آزاد کالا برای فرایندهای بدون فرمول مشخص یا خروج امانی
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  adjustment_date TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  description     TEXT NOT NULL,
  is_consignment  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_adjustment_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  adjustment_id INTEGER NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  item_id       INTEGER NOT NULL REFERENCES inventory_nodes(id),
  quantity      REAL NOT NULL
);
