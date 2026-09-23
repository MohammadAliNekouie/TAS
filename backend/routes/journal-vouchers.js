const express = require("express");
const db = require("../db");

const router = express.Router();

function getVoucherWithLines(id) {
  const voucher = db.prepare("SELECT * FROM journal_vouchers WHERE id = ?").get(id);
  if (!voucher) return null;
  const lines = db
    .prepare(
      `SELECT jl.*, a.code AS account_code, a.name AS account_name
       FROM journal_voucher_lines jl
       JOIN chart_of_accounts a ON a.id = jl.account_id
       WHERE jl.voucher_id = ?
       ORDER BY jl.id`
    )
    .all(id);
  return { ...voucher, lines };
}

function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    return "سند باید حداقل دو ردیف (یک بدهکار و یک بستانکار) داشته باشد.";
  }
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of lines) {
    const debit = Number(l.debit) || 0;
    const credit = Number(l.credit) || 0;
    if (debit > 0 && credit > 0) return "هر ردیف فقط می‌تواند بدهکار یا بستانکار باشد، نه هر دو.";
    if (debit === 0 && credit === 0) return "هر ردیف باید مبلغ بدهکار یا بستانکار داشته باشد.";
    if (!l.account_id) return "برای هر ردیف باید یک حساب انتخاب شود.";
    totalDebit += debit;
    totalCredit += credit;
  }
  
  // Use a tighter tolerance (0.01 Rial = 1 cent) for balance validation.
  // Floating-point arithmetic can introduce tiny errors, but anything beyond
  // one cent indicates a real accounting imbalance.
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return `سند تراز نیست: جمع بدهکار ${totalDebit.toLocaleString("en-US")} و جمع بستانکار ${totalCredit.toLocaleString("en-US")} برابر نیستند.`;
  }
  return null;
}

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT v.*,
              (SELECT COUNT(*) FROM journal_voucher_lines WHERE voucher_id = v.id) AS line_count,
              (SELECT COALESCE(SUM(debit), 0) FROM journal_voucher_lines WHERE voucher_id = v.id) AS total_amount
       FROM journal_vouchers v
       ORDER BY v.id DESC`
    )
    .all();
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const voucher = getVoucherWithLines(req.params.id);
  if (!voucher) return res.status(404).json({ error: "not found" });
  res.json(voucher);
});

function assertEditable(voucher) {
  if (voucher.source_type) {
    throw Object.assign(new Error(`این سند به‌صورت خودکار از فاکتور شماره ${voucher.source_id} ایجاد شده — برای تغییر، همان فاکتور را ویرایش یا حذف کنید.`), { status: 400 });
  }
}

router.post("/", (req, res) => {
  const { voucher_date, description = "", lines = [] } = req.body;
  if (!voucher_date) return res.status(400).json({ error: "تاریخ سند الزامی است." });
  const err = validateLines(lines);
  if (err) return res.status(400).json({ error: err });

  const tx = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO journal_vouchers (voucher_date, description) VALUES (?, ?)")
      .run(voucher_date, description);
    const voucherId = info.lastInsertRowid;
    const insertLine = db.prepare(
      `INSERT INTO journal_voucher_lines (voucher_id, account_id, debit, credit, description)
       VALUES (@voucher_id, @account_id, @debit, @credit, @description)`
    );
    for (const l of lines) {
      insertLine.run({
        voucher_id: voucherId, account_id: l.account_id,
        debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || "",
      });
    }
    return voucherId;
  });

  const voucherId = tx();
  res.status(201).json(getVoucherWithLines(voucherId));
});

router.put("/:id", (req, res) => {
  const { voucher_date, description = "", lines = [] } = req.body;
  if (!voucher_date) return res.status(400).json({ error: "تاریخ سند الزامی است." });
  const err = validateLines(lines);
  if (err) return res.status(400).json({ error: err });

  const existing = db.prepare("SELECT * FROM journal_vouchers WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  try {
    assertEditable(existing);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE journal_vouchers SET voucher_date = ?, description = ? WHERE id = ?")
      .run(voucher_date, description, req.params.id);
    db.prepare("DELETE FROM journal_voucher_lines WHERE voucher_id = ?").run(req.params.id);
    const insertLine = db.prepare(
      `INSERT INTO journal_voucher_lines (voucher_id, account_id, debit, credit, description)
       VALUES (@voucher_id, @account_id, @debit, @credit, @description)`
    );
    for (const l of lines) {
      insertLine.run({
        voucher_id: req.params.id, account_id: l.account_id,
        debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || "",
      });
    }
  });

  tx();
  res.json(getVoucherWithLines(req.params.id));
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM journal_vouchers WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  try {
    assertEditable(existing);
  } catch (e) {
    return res.status(e.status || 400).json({ error: e.message });
  }
  db.prepare("DELETE FROM journal_vouchers WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
