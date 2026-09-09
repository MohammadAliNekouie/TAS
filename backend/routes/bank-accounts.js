const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT b.*, a.code AS coa_account_code, a.name AS coa_account_name
         FROM bank_accounts b
         LEFT JOIN chart_of_accounts a ON a.id = b.coa_account_id
         ORDER BY b.id DESC`
      )
      .all()
  );
});

router.post("/", (req, res) => {
  const { name, bank_name = "", sheba = "", initial_balance = 0, coa_account_id = null } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const info = db
    .prepare(
      `INSERT INTO bank_accounts (name, bank_name, sheba, initial_balance, current_balance, coa_account_id)
       VALUES (@name, @bank_name, @sheba, @initial_balance, @initial_balance, @coa_account_id)`
    )
    .run({ name, bank_name, sheba, initial_balance, coa_account_id });
  res.status(201).json(db.prepare("SELECT * FROM bank_accounts WHERE id = ?").get(info.lastInsertRowid));
});

// Only identity/mapping fields are editable after creation — current_balance
// moves only through invoices/journal vouchers, never a direct edit, so the
// ledger stays consistent with what was actually recorded.
router.put("/:id", (req, res) => {
  const { name, bank_name = "", sheba = "", coa_account_id = null } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  db.prepare(
    "UPDATE bank_accounts SET name = @name, bank_name = @bank_name, sheba = @sheba, coa_account_id = @coa_account_id WHERE id = @id"
  ).run({ name, bank_name, sheba, coa_account_id, id: req.params.id });
  const row = db.prepare("SELECT * FROM bank_accounts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

router.delete("/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM bank_accounts WHERE id = ?").run(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "این حساب در فاکتورها یا اسناد استفاده شده و قابل حذف نیست." });
  }
});

module.exports = router;
