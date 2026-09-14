const express = require("express");
const db = require("../db");
const { todayJalaliString, lastNJalaliDays } = require("../lib/jalali");

const router = express.Router();

// GET /api/dashboard/kpis -> computed live from real data, not a static
// seed table (an earlier version of this endpoint read from a `kpis`
// table that was only ever seeded once with demo numbers and never
// updated — this was a real bug, now fixed).
router.get("/kpis", (req, res) => {
  const days = lastNJalaliDays(2); // [yesterday, today]
  const today = days[1];
  const yesterday = days[0];

  const salesOn = (date) =>
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales_purchase_invoices WHERE type = 'sale' AND invoice_date = ?").get(date).total;

  const salesToday = salesOn(today);
  const salesYesterday = salesOn(yesterday);
  const salesDelta = salesYesterday > 0 ? ((salesToday - salesYesterday) / salesYesterday) * 100 : (salesToday > 0 ? 100 : 0);

  const accountingSettings = db.prepare("SELECT * FROM accounting_settings WHERE id = 1").get() || {};

  function accountBalance(accountId) {
    if (!accountId) return null;
    const row = db
      .prepare("SELECT COALESCE(SUM(debit), 0) AS d, COALESCE(SUM(credit), 0) AS c FROM journal_voucher_lines WHERE account_id = ?")
      .get(accountId);
    return { debit: row.d, credit: row.c };
  }

  const ar = accountBalance(accountingSettings.ar_account_id);
  const ap = accountBalance(accountingSettings.ap_account_id);
  const cashAndBank = db.prepare("SELECT COALESCE(SUM(current_balance), 0) AS total FROM bank_accounts").get().total;

  const kpis = [
    { key: "sales_today", label: "فروش امروز", value: salesToday, delta: Math.round(salesDelta * 10) / 10, up: salesDelta >= 0, icon: "trendingUp" },
    {
      key: "receivables", label: "مطالبات (دریافتنی)",
      value: ar ? ar.debit - ar.credit : 0, icon: "receipt",
      note: accountingSettings.ar_account_id ? null : "حساب دریافتنی در «اتصال حسابداری» تنظیم نشده است.",
    },
    {
      key: "payables", label: "بدهی (پرداختنی)",
      value: ap ? ap.credit - ap.debit : 0, icon: "creditCard",
      note: accountingSettings.ap_account_id ? null : "حساب پرداختنی در «اتصال حسابداری» تنظیم نشده است.",
    },
    { key: "cash_bank", label: "موجودی نقد و بانک", value: cashAndBank, icon: "wallet" },
  ];

  res.json(kpis);
});

// GET /api/dashboard/sales?range=7|30 -> real daily sales totals, zero-
// filled for days with no invoices so the chart timeline stays continuous.
router.get("/sales", (req, res) => {
  const range = req.query.range === "30" ? 30 : 7;
  const days = lastNJalaliDays(range);

  const rows = db
    .prepare(
      `SELECT invoice_date, SUM(total_amount) AS total
       FROM sales_purchase_invoices
       WHERE type = 'sale' AND invoice_date IN (${days.map(() => "?").join(",")})
       GROUP BY invoice_date`
    )
    .all(...days);
  const byDate = Object.fromEntries(rows.map((r) => [r.invoice_date, r.total]));

  const weekdayLabels = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه"];
  const result = days.map((d, i) => ({
    label: range === 7 ? weekdayLabels[new Date(Date.now() - (6 - i) * 86400000).getDay()] : d.slice(5), // "MM/DD" for the 30-day view
    value: byDate[d] || 0,
  }));
  res.json(result);
});

// GET /api/dashboard/events -> real recent activity, derived live from the
// actual transactional tables (an earlier version read from a static
// `events` table that was seeded once with fake demo rows and never
// updated by any real action — also a real bug, now fixed).
router.get("/events", (req, res) => {
  const invoices = db
    .prepare(
      `SELECT ('فاکتور ' || CASE WHEN type='sale' THEN 'فروش' ELSE 'خرید' END || ' برای «' || party || '» ثبت شد') AS text,
              CASE WHEN type='sale' THEN 'teal' ELSE 'gold' END AS tone, 'receipt' AS icon, created_at
       FROM sales_purchase_invoices ORDER BY id DESC LIMIT 5`
    )
    .all();
  const cheques = db
    .prepare(
      `SELECT ('چک ' || CASE WHEN type='received' THEN 'دریافتنی' ELSE 'پرداختنی' END || ' از «' || party || '» ثبت شد') AS text,
              'gold' AS tone, 'fileCheck' AS icon, created_at
       FROM cheques ORDER BY id DESC LIMIT 5`
    )
    .all();
  const vouchers = db
    .prepare(
      `SELECT (CASE WHEN source_type IS NULL THEN 'سند حسابداری دستی ثبت شد' ELSE 'سند حسابداری خودکار از فاکتور ثبت شد' END) AS text,
              'teal' AS tone, 'fileCheck' AS icon, created_at
       FROM journal_vouchers ORDER BY id DESC LIMIT 5`
    )
    .all();
  const receipts = db
    .prepare(
      `SELECT (CASE WHEN type='receipt' THEN 'دریافت' ELSE 'پرداخت' END || ' از/به «' || party || '» ثبت شد') AS text,
              'teal' AS tone, 'landmark' AS icon, created_at
       FROM receipts_payments ORDER BY id DESC LIMIT 5`
    )
    .all();
  const runs = db
    .prepare(
      `SELECT ('فرایند تولید «' || formula_name || '» اجرا شد') AS text, 'gold' AS tone, 'fileCheck' AS icon, created_at
       FROM production_runs ORDER BY id DESC LIMIT 5`
    )
    .all();

  const merged = [...invoices, ...cheques, ...vouchers, ...receipts, ...runs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  res.json(merged);
});

router.get("/low-stock", (req, res) => {
  const rows = db
    .prepare(
      `SELECT n.code, n.name, n.unit, w.name AS warehouse, n.min_qty, n.qty_on_hand
       FROM inventory_nodes n
       LEFT JOIN warehouses w ON w.id = n.warehouse_id
       WHERE n.level = 3 AND n.qty_on_hand < n.min_qty
       ORDER BY (n.qty_on_hand * 1.0 / n.min_qty) ASC`
    )
    .all();
  res.json(rows);
});

router.get("/cheques-due", (req, res) => {
  const rows = db
    .prepare("SELECT party, amount, due_date, status FROM cheques ORDER BY due_date ASC LIMIT 10")
    .all();
  res.json(rows);
});

module.exports = router;
