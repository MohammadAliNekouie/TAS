const express = require("express");
const db = require("../db");
const { postVoucher, resolveAccount } = require("../lib/accounting");
const router = express.Router();

router.get("/", (req, res) => {
  try {
    const rows = db.prepare("SELECT id,name,start_date,end_date,status FROM financial_periods ORDER BY start_date DESC, id DESC").all();
    res.json(rows);
  } catch (e) {
    console.error("GET /financial-periods failed:", e);
    res.status(500).json({ error: "دریافت دوره‌های مالی ناموفق بود.", detail: e.message });
  }
});

router.post("/", (req, res) => {
  try {
    const { name, start_date, end_date } = req.body || {};
    if (!name || !start_date || !end_date || String(start_date) > String(end_date)) throw new Error("نام و بازه دوره مالی نامعتبر است.");
    const overlap = db.prepare("SELECT 1 FROM financial_periods WHERE start_date<=? AND end_date>=? LIMIT 1").get(end_date, start_date);
    if (overlap) throw new Error("بازه دوره مالی با دوره دیگری تداخل دارد.");
    const info = db.prepare("INSERT INTO financial_periods(name,start_date,end_date,status) VALUES(?,?,?,'open')").run(String(name).trim(), start_date, end_date);
    res.status(201).json(db.prepare("SELECT id,name,start_date,end_date,status FROM financial_periods WHERE id=?").get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/close", (req, res) => {
  try {
    const p = db.prepare("SELECT * FROM financial_periods WHERE id=?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "دوره یافت نشد." });
    if (p.status === "closed") return res.json(p);

    const s = db.prepare("SELECT * FROM accounting_settings WHERE id=1").get() || {};
    const closeAcc = resolveAccount(s.opening_closing_account_id, "2901", "تراز افتتاحیه و اختتامیه");
    const retained = resolveAccount(s.retained_earnings_account_id, "5801", "سود و زیان انباشته");
    const rows = db.prepare(`
      SELECT a.id,a.code,g.code group_code,
        COALESCE(SUM(l.debit),0) debit,
        COALESCE(SUM(l.credit),0) credit
      FROM chart_of_accounts a
      JOIN chart_of_accounts g2 ON g2.id=a.parent_id
      JOIN chart_of_accounts g ON g.id=g2.parent_id
      LEFT JOIN journal_voucher_lines l ON l.account_id=a.id
      LEFT JOIN journal_vouchers v ON v.id=l.voucher_id
      WHERE a.level=3 AND v.voucher_date BETWEEN ? AND ? AND g.code IN ('6','7')
      GROUP BY a.id
    `).all(p.start_date, p.end_date);

    const revenue = rows.filter(r => r.group_code === "6").reduce((x, r) => x + Number(r.credit) - Number(r.debit), 0);
    const expenses = rows.filter(r => r.group_code === "7").reduce((x, r) => x + Number(r.debit) - Number(r.credit), 0);
    const profit = Math.round(revenue - expenses);

    const tx = db.transaction(() => {
      const lines = [];
      for (const r of rows) {
        const bal = Number(r.credit) - Number(r.debit);
        if (r.group_code === "6" && bal !== 0) {
          lines.push({ account_id: r.id, debit: bal, credit: 0 });
          lines.push({ account_id: closeAcc, debit: 0, credit: bal });
        }
        if (r.group_code === "7" && bal !== 0) {
          lines.push({ account_id: r.id, debit: 0, credit: bal });
          lines.push({ account_id: closeAcc, debit: bal, credit: 0 });
        }
      }
      if (profit > 0) lines.push({ account_id: closeAcc, debit: profit, credit: 0 }, { account_id: retained, debit: 0, credit: profit });
      else if (profit < 0) lines.push({ account_id: retained, debit: -profit, credit: 0 }, { account_id: closeAcc, debit: 0, credit: -profit });

      if (lines.length) {
        const voucher = postVoucher({ date: p.end_date, description: `سند اختتامیه دوره ${p.name}`, sourceType: "period_closing", sourceId: p.id, lines });
        db.prepare("INSERT OR REPLACE INTO closing_entries(period_id,voucher_id) VALUES(?,?)").run(p.id, voucher);
      }
      db.prepare("UPDATE financial_periods SET status='closed' WHERE id=?").run(p.id);
    });

    tx();
    res.json(db.prepare("SELECT * FROM financial_periods WHERE id=?").get(p.id));
  } catch (e) {
    console.error("POST /financial-periods/:id/close failed:", e);
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
