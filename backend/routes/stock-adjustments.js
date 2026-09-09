const express = require("express");
const db = require("../db");

const router = express.Router();

function getAdjustmentWithItems(id) {
  const header = db.prepare("SELECT * FROM stock_adjustments WHERE id = ?").get(id);
  if (!header) return null;
  const items = db
    .prepare(
      `SELECT ai.*, n.name AS item_name, n.unit AS item_unit, n.code AS item_code
       FROM stock_adjustment_items ai
       JOIN inventory_nodes n ON n.id = ai.item_id
       WHERE ai.adjustment_id = ? ORDER BY ai.id`
    )
    .all(id);
  return { ...header, items };
}

function applyEffect(direction, items, sign = 1) {
  for (const it of items) {
    const delta = (direction === "in" ? 1 : -1) * Number(it.quantity) * sign;
    db.prepare("UPDATE inventory_nodes SET qty_on_hand = qty_on_hand + ? WHERE id = ?").run(delta, it.item_id);
  }
}

function assertSufficientStock(direction, items) {
  if (direction !== "out") return;
  for (const it of items) {
    const node = db.prepare("SELECT name, qty_on_hand, unit FROM inventory_nodes WHERE id = ?").get(it.item_id);
    if (!node) throw new Error("کالای انتخاب‌شده در انبار یافت نشد.");
    if (Number(it.quantity) > node.qty_on_hand) {
      throw new Error(`موجودی «${node.name}» کافی نیست (موجودی فعلی: ${node.qty_on_hand} ${node.unit || ""}).`);
    }
  }
}

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, (SELECT COUNT(*) FROM stock_adjustment_items WHERE adjustment_id = a.id) AS item_count
       FROM stock_adjustments a ORDER BY a.id DESC`
    )
    .all();
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const row = getAdjustmentWithItems(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

router.post("/", (req, res) => {
  const { adjustment_date, direction, description, is_consignment = false, items = [] } = req.body;
  if (!adjustment_date || !direction) return res.status(400).json({ error: "تاریخ و نوع سند الزامی است." });
  if (!description || !description.trim()) return res.status(400).json({ error: "شرح سند الزامی است." });
  if (!items.length) return res.status(400).json({ error: "حداقل یک ردیف کالا لازم است." });

  try {
    const tx = db.transaction(() => {
      assertSufficientStock(direction, items);

      const info = db
        .prepare(
          "INSERT INTO stock_adjustments (adjustment_date, direction, description, is_consignment) VALUES (?, ?, ?, ?)"
        )
        .run(adjustment_date, direction, description, is_consignment ? 1 : 0);
      const adjustmentId = info.lastInsertRowid;

      const insertItem = db.prepare("INSERT INTO stock_adjustment_items (adjustment_id, item_id, quantity) VALUES (?, ?, ?)");
      for (const it of items) insertItem.run(adjustmentId, it.item_id, it.quantity);

      applyEffect(direction, items, 1);
      return adjustmentId;
    });

    const adjustmentId = tx();
    res.status(201).json(getAdjustmentWithItems(adjustmentId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", (req, res) => {
  const { adjustment_date, direction, description, is_consignment = false, items = [] } = req.body;
  if (!adjustment_date || !direction) return res.status(400).json({ error: "تاریخ و نوع سند الزامی است." });
  if (!description || !description.trim()) return res.status(400).json({ error: "شرح سند الزامی است." });
  if (!items.length) return res.status(400).json({ error: "حداقل یک ردیف کالا لازم است." });

  const existing = db.prepare("SELECT * FROM stock_adjustments WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const existingItems = db.prepare("SELECT item_id, quantity FROM stock_adjustment_items WHERE adjustment_id = ?").all(req.params.id);

  try {
    const tx = db.transaction(() => {
      applyEffect(existing.direction, existingItems, -1); // reverse old (fully reversible — no cost blending here)
      assertSufficientStock(direction, items);

      db.prepare("DELETE FROM stock_adjustment_items WHERE adjustment_id = ?").run(req.params.id);
      db.prepare(
        "UPDATE stock_adjustments SET adjustment_date = ?, direction = ?, description = ?, is_consignment = ? WHERE id = ?"
      ).run(adjustment_date, direction, description, is_consignment ? 1 : 0, req.params.id);

      const insertItem = db.prepare("INSERT INTO stock_adjustment_items (adjustment_id, item_id, quantity) VALUES (?, ?, ?)");
      for (const it of items) insertItem.run(req.params.id, it.item_id, it.quantity);

      applyEffect(direction, items, 1);
    });

    tx();
    res.json(getAdjustmentWithItems(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM stock_adjustments WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const existingItems = db.prepare("SELECT item_id, quantity FROM stock_adjustment_items WHERE adjustment_id = ?").all(req.params.id);

  const tx = db.transaction(() => {
    applyEffect(existing.direction, existingItems, -1);
    db.prepare("DELETE FROM stock_adjustments WHERE id = ?").run(req.params.id);
  });

  tx();
  res.status(204).end();
});

module.exports = router;
