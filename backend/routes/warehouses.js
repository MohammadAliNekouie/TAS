const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT * FROM warehouses ORDER BY id").all());
});

router.post("/", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "نام انبار الزامی است." });
  try {
    const info = db.prepare("INSERT INTO warehouses (name) VALUES (?)").run(name.trim());
    res.status(201).json(db.prepare("SELECT * FROM warehouses WHERE id = ?").get(info.lastInsertRowid));
  } catch (err) {
    res.status(409).json({ error: "انباری با همین نام قبلاً تعریف شده است." });
  }
});

router.put("/:id", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "نام انبار الزامی است." });
  try {
    db.prepare("UPDATE warehouses SET name = ? WHERE id = ?").run(name.trim(), req.params.id);
    const row = db.prepare("SELECT * FROM warehouses WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  } catch (err) {
    res.status(409).json({ error: "انباری با همین نام قبلاً تعریف شده است." });
  }
});

router.delete("/:id", (req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS c FROM warehouses").get().c;
  if (total <= 1) {
    return res.status(400).json({ error: "حداقل یک انبار باید در سیستم باقی بماند." });
  }
  try {
    db.prepare("DELETE FROM warehouses WHERE id = ?").run(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "این انبار برای کالاهایی در انبارداری استفاده شده و قابل حذف نیست." });
  }
});

module.exports = router;
