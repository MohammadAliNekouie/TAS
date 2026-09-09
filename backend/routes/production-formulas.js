const express = require("express");
const db = require("../db");

const router = express.Router();

function getFormulaWithLines(id) {
  const formula = db
    .prepare(
      `SELECT f.*, n.name AS output_item_name, n.unit AS output_item_unit
       FROM production_formulas f
       JOIN inventory_nodes n ON n.id = f.output_item_id
       WHERE f.id = ?`
    )
    .get(id);
  if (!formula) return null;
  const components = db
    .prepare(
      `SELECT c.*, n.name AS item_name, n.unit AS item_unit, n.code AS item_code, n.qty_on_hand AS item_qty_on_hand
       FROM production_formula_components c
       JOIN inventory_nodes n ON n.id = c.item_id
       WHERE c.formula_id = ? ORDER BY c.id`
    )
    .all(id);
  const services = db.prepare("SELECT * FROM production_formula_services WHERE formula_id = ? ORDER BY id").all(id);
  return { ...formula, components, services };
}

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT f.*, n.name AS output_item_name,
              (SELECT COUNT(*) FROM production_formula_components WHERE formula_id = f.id) AS component_count,
              (SELECT COUNT(*) FROM production_formula_services WHERE formula_id = f.id) AS service_count
       FROM production_formulas f
       JOIN inventory_nodes n ON n.id = f.output_item_id
       ORDER BY f.id DESC`
    )
    .all();
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const formula = getFormulaWithLines(req.params.id);
  if (!formula) return res.status(404).json({ error: "not found" });
  res.json(formula);
});

router.post("/", (req, res) => {
  const { name, output_item_id, description = "", components = [], services = [] } = req.body;
  if (!name || !output_item_id) return res.status(400).json({ error: "نام فرمول و کالای خروجی الزامی است." });
  if (!components.length) return res.status(400).json({ error: "حداقل یک قطعه لازم است." });

  const tx = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO production_formulas (name, output_item_id, description) VALUES (?, ?, ?)")
      .run(name, output_item_id, description);
    const formulaId = info.lastInsertRowid;

    const insertComp = db.prepare(
      "INSERT INTO production_formula_components (formula_id, item_id, quantity, description) VALUES (?, ?, ?, ?)"
    );
    for (const c of components) insertComp.run(formulaId, c.item_id, c.quantity, c.description || "");

    const insertSvc = db.prepare("INSERT INTO production_formula_services (formula_id, name, description) VALUES (?, ?, ?)");
    for (const s of services) insertSvc.run(formulaId, s.name, s.description || "");

    return formulaId;
  });

  const formulaId = tx();
  res.status(201).json(getFormulaWithLines(formulaId));
});

router.put("/:id", (req, res) => {
  const { name, output_item_id, description = "", components = [], services = [] } = req.body;
  if (!name || !output_item_id) return res.status(400).json({ error: "نام فرمول و کالای خروجی الزامی است." });
  if (!components.length) return res.status(400).json({ error: "حداقل یک قطعه لازم است." });

  const existing = db.prepare("SELECT * FROM production_formulas WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });

  const tx = db.transaction(() => {
    db.prepare("UPDATE production_formulas SET name = ?, output_item_id = ?, description = ? WHERE id = ?")
      .run(name, output_item_id, description, req.params.id);
    db.prepare("DELETE FROM production_formula_components WHERE formula_id = ?").run(req.params.id);
    db.prepare("DELETE FROM production_formula_services WHERE formula_id = ?").run(req.params.id);

    const insertComp = db.prepare(
      "INSERT INTO production_formula_components (formula_id, item_id, quantity, description) VALUES (?, ?, ?, ?)"
    );
    for (const c of components) insertComp.run(req.params.id, c.item_id, c.quantity, c.description || "");

    const insertSvc = db.prepare("INSERT INTO production_formula_services (formula_id, name, description) VALUES (?, ?, ?)");
    for (const s of services) insertSvc.run(req.params.id, s.name, s.description || "");
  });

  tx();
  res.json(getFormulaWithLines(req.params.id));
});

router.delete("/:id", (req, res) => {
  const usedByRuns = db.prepare("SELECT COUNT(*) AS c FROM production_runs WHERE formula_id = ?").get(req.params.id).c;
  if (usedByRuns > 0) {
    return res.status(400).json({ error: "این فرمول در فرایندهای تولید قبلی استفاده شده و قابل حذف نیست." });
  }
  db.prepare("DELETE FROM production_formulas WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

module.exports = router;
