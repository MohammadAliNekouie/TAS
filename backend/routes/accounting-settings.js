const express = require("express");
const db = require("../db");

const router = express.Router();

const FIELDS = ["sales_account_id", "cogs_account_id", "inventory_account_id", "ar_account_id", "ap_account_id"];

function withAccountNames(row) {
  if (!row) return row;
  const out = { ...row };
  for (const f of FIELDS) {
    const id = row[f];
    out[f.replace("_id", "")] = id
      ? db.prepare("SELECT id, code, name FROM chart_of_accounts WHERE id = ?").get(id)
      : null;
  }
  return out;
}

router.get("/", (req, res) => {
  const row = db.prepare("SELECT * FROM accounting_settings WHERE id = 1").get();
  res.json(withAccountNames(row || { id: 1 }));
});

router.put("/", (req, res) => {
  const values = { id: 1 };
  for (const f of FIELDS) values[f] = req.body[f] || null;
  db.prepare(
    `INSERT INTO accounting_settings (id, ${FIELDS.join(", ")})
     VALUES (@id, ${FIELDS.map((f) => `@${f}`).join(", ")})
     ON CONFLICT(id) DO UPDATE SET ${FIELDS.map((f) => `${f} = excluded.${f}`).join(", ")}`
  ).run(values);
  res.json(withAccountNames(db.prepare("SELECT * FROM accounting_settings WHERE id = 1").get()));
});

module.exports = router;
