const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.id, r.reason, r.created_at, i.id AS invoice_id, i.type, i.party, i.invoice_date, i.total_amount
       FROM modayan_reminders r
       JOIN sales_purchase_invoices i ON i.id = r.invoice_id
       WHERE r.dismissed = 0
       ORDER BY r.id DESC`
    )
    .all();
  res.json(rows);
});

router.put("/:id/dismiss", (req, res) => {
  db.prepare("UPDATE modayan_reminders SET dismissed = 1 WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
