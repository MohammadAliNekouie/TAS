const express = require("express");
const db = require("../db");
const { normalizePersian } = require("../lib/persian");

const router = express.Router();

// GET /api/inventory/tree?parentId=  -> children of a node.
// No parentId (or "null") returns the level-1 root categories.
router.get("/tree", (req, res) => {
  const { parentId } = req.query;
  let rows;
  if (!parentId || parentId === "null") {
    rows = db.prepare("SELECT * FROM inventory_nodes WHERE parent_id IS NULL ORDER BY code").all();
  } else {
    rows = db
      .prepare(
        `SELECT n.*, w.name AS warehouse_name
         FROM inventory_nodes n
         LEFT JOIN warehouses w ON w.id = n.warehouse_id
         WHERE n.parent_id = ?
         ORDER BY n.code`
      )
      .all(parentId);
  }
  res.json(rows);
});

// GET /api/inventory/search?q=...&inStockOnly=1  -> matches by exact ID,
// code prefix, or any substring of the (normalized) name. Exact ID/code
// matches rank first. inStockOnly=1 restricts to items with qty_on_hand > 0
// (used by sales invoices, which may only sell what's actually in stock).
router.get("/search", (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  const inStockOnly = req.query.inStockOnly === "1" || req.query.inStockOnly === "true";

  const normalized = normalizePersian(q);
  const rows = db
    .prepare(
      `SELECT * FROM inventory_nodes
       WHERE level = 3 AND (${inStockOnly ? "qty_on_hand > 0 AND" : ""} (
         CAST(id AS TEXT) = @q
         OR code LIKE @codePrefix
         OR name_normalized LIKE @nameSubstring
       ))
       ORDER BY
         CASE WHEN CAST(id AS TEXT) = @q THEN 0
              WHEN code = @q THEN 1
              WHEN name_normalized LIKE @namePrefix THEN 2
              ELSE 3 END,
         code
       LIMIT 30`
    )
    .all({
      q,
      codePrefix: `${q}%`,
      nameSubstring: `%${normalized}%`,
      namePrefix: `${normalized}%`,
    });

  // attach breadcrumb path (level1 > level2 > leaf name)
  const withPath = rows.map((row) => {
    const path = [];
    let current = row;
    while (current.parent_id) {
      const parent = db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(current.parent_id);
      if (!parent) break;
      path.unshift(parent.name);
      current = parent;
    }
    return { ...row, breadcrumb: path };
  });

  res.json(withPath);
});

// GET /api/inventory/categories -> flat list of level-2 nodes (the only
// level a new item can be filed under), with their parent's name attached
// so a dropdown can show "لوازم یدکی › فیلتر" instead of a bare "فیلتر".
router.get("/categories", (req, res) => {
  const rows = db
    .prepare(
      `SELECT n.id, n.code, n.name, p.name AS parent_name
       FROM inventory_nodes n
       JOIN inventory_nodes p ON p.id = n.parent_id
       WHERE n.level = 2
       ORDER BY n.code`
    )
    .all();
  res.json(rows);
});

function nextChildCode(parentCode, parentId, digits) {
  const siblings = db.prepare("SELECT code FROM inventory_nodes WHERE parent_id = ?").all(parentId);
  let maxSeq = 0;
  for (const s of siblings) {
    const suffix = s.code.split("-").pop();
    const n = parseInt(suffix, 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const seq = String(maxSeq + 1).padStart(digits, "0");
  return parentCode ? `${parentCode}-${seq}` : seq;
}

// ---------- groups (level 1) ----------

router.post("/groups", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "نام گروه الزامی است." });
  const rootSiblings = db.prepare("SELECT code FROM inventory_nodes WHERE parent_id IS NULL").all();
  let maxSeq = 0;
  for (const s of rootSiblings) {
    const n = parseInt(s.code, 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const nextCode = String(maxSeq + 1).padStart(2, "0");
  const info = db
    .prepare(
      `INSERT INTO inventory_nodes (code, level, parent_id, name, name_normalized)
       VALUES (@code, 1, NULL, @name, @name_normalized)`
    )
    .run({ code: nextCode, name: name.trim(), name_normalized: normalizePersian(name) });
  res.status(201).json(db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(info.lastInsertRowid));
});

router.put("/groups/:id", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "نام گروه الزامی است." });
  const node = db.prepare("SELECT * FROM inventory_nodes WHERE id = ? AND level = 1").get(req.params.id);
  if (!node) return res.status(404).json({ error: "not found" });
  db.prepare("UPDATE inventory_nodes SET name = ?, name_normalized = ? WHERE id = ?").run(name.trim(), normalizePersian(name), req.params.id);
  res.json(db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(req.params.id));
});

router.delete("/groups/:id", (req, res) => {
  const childCount = db.prepare("SELECT COUNT(*) AS c FROM inventory_nodes WHERE parent_id = ?").get(req.params.id).c;
  if (childCount > 0) {
    return res.status(400).json({ error: "ابتدا زیردسته‌های این گروه را حذف کنید." });
  }
  db.prepare("DELETE FROM inventory_nodes WHERE id = ? AND level = 1").run(req.params.id);
  res.status(204).end();
});

// ---------- subcategories (level 2) ----------

router.post("/categories", (req, res) => {
  const { parent_id, name } = req.body;
  if (!parent_id || !name || !name.trim()) return res.status(400).json({ error: "گروه و نام زیردسته الزامی است." });
  const parent = db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(parent_id);
  if (!parent || parent.level !== 1) return res.status(400).json({ error: "parent_id باید یک گروه سطح ۱ باشد." });
  const nextCode = nextChildCode(parent.code, parent_id, 2);
  const info = db
    .prepare(
      `INSERT INTO inventory_nodes (code, level, parent_id, name, name_normalized)
       VALUES (@code, 2, @parent_id, @name, @name_normalized)`
    )
    .run({ code: nextCode, parent_id, name: name.trim(), name_normalized: normalizePersian(name) });
  res.status(201).json(db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(info.lastInsertRowid));
});

router.put("/categories/:id", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "نام زیردسته الزامی است." });
  const node = db.prepare("SELECT * FROM inventory_nodes WHERE id = ? AND level = 2").get(req.params.id);
  if (!node) return res.status(404).json({ error: "not found" });
  db.prepare("UPDATE inventory_nodes SET name = ?, name_normalized = ? WHERE id = ?").run(name.trim(), normalizePersian(name), req.params.id);
  res.json(db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(req.params.id));
});

router.delete("/categories/:id", (req, res) => {
  const childCount = db.prepare("SELECT COUNT(*) AS c FROM inventory_nodes WHERE parent_id = ?").get(req.params.id).c;
  if (childCount > 0) {
    return res.status(400).json({ error: "ابتدا کالاهای این زیردسته را حذف کنید." });
  }
  db.prepare("DELETE FROM inventory_nodes WHERE id = ? AND level = 2").run(req.params.id);
  res.status(204).end();
});

// ---------- items (level 3) ----------

// POST /api/inventory/items -> create a new level-3 (leaf) item on the fly,
// e.g. from inside the invoice form when the item doesn't exist yet, or
// from the warehouse page directly. Code is generated as parentCode-NNNN.
router.post("/items", (req, res) => {
  const { parent_id, name, unit = "", warehouse_id = null, min_qty = 0, qty_on_hand = 0 } = req.body;
  if (!parent_id || !name) return res.status(400).json({ error: "parent_id and name are required" });

  const parent = db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(parent_id);
  if (!parent || parent.level !== 2) {
    return res.status(400).json({ error: "parent_id must reference a level-2 category" });
  }

  const nextCode = nextChildCode(parent.code, parent_id, 4);

  const info = db
    .prepare(
      `INSERT INTO inventory_nodes (code, level, parent_id, name, name_normalized, unit, warehouse_id, min_qty, qty_on_hand)
       VALUES (@code, 3, @parent_id, @name, @name_normalized, @unit, @warehouse_id, @min_qty, @qty_on_hand)`
    )
    .run({
      code: nextCode, parent_id, name, name_normalized: normalizePersian(name),
      unit, warehouse_id: warehouse_id || null, min_qty, qty_on_hand,
    });

  res.status(201).json(db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(info.lastInsertRowid));
});

router.put("/items/:id", (req, res) => {
  const { name, unit = "", warehouse_id = null, min_qty = 0, qty_on_hand = 0 } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "نام کالا الزامی است." });
  const node = db.prepare("SELECT * FROM inventory_nodes WHERE id = ? AND level = 3").get(req.params.id);
  if (!node) return res.status(404).json({ error: "not found" });
  db.prepare(
    `UPDATE inventory_nodes
     SET name = @name, name_normalized = @name_normalized, unit = @unit,
         warehouse_id = @warehouse_id, min_qty = @min_qty, qty_on_hand = @qty_on_hand
     WHERE id = @id`
  ).run({
    name: name.trim(), name_normalized: normalizePersian(name), unit,
    warehouse_id: warehouse_id || null, min_qty, qty_on_hand, id: req.params.id,
  });
  res.json(db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(req.params.id));
});

router.delete("/items/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM inventory_nodes WHERE id = ? AND level = 3").run(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: "این کالا در فاکتورهای ثبت‌شده استفاده شده و قابل حذف نیست." });
  }
});

module.exports = router;
