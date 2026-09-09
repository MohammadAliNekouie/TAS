const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/kpis", (req, res) => {
  const rows = db.prepare("SELECT key, label, value, delta, up, icon FROM kpis").all();
  res.json(rows.map((r) => ({ ...r, up: !!r.up })));
});

router.get("/sales", (req, res) => {
  const range = req.query.range === "30" ? 30 : 7;
  const rows = db
    .prepare("SELECT label, value FROM sales_daily ORDER BY seq DESC LIMIT ?")
    .all(range)
    .reverse();
  res.json(rows);
});

router.get("/events", (req, res) => {
  const rows = db
    .prepare("SELECT text, tone, icon, created_at FROM events ORDER BY created_at DESC LIMIT 10")
    .all();
  res.json(rows);
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
