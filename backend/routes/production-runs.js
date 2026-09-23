const express = require("express");
const db = require("../db");

const router = express.Router();

function getRunWithLines(id) {
  const run = db.prepare("SELECT * FROM production_runs WHERE id = ?").get(id);
  if (!run) return null;
  const components = db
    .prepare(
      `SELECT rc.*, n.name AS item_name, n.unit AS item_unit
       FROM production_run_components rc
       JOIN inventory_nodes n ON n.id = rc.item_id
       WHERE rc.run_id = ? ORDER BY rc.id`
    )
    .all(id);
  const services = db.prepare("SELECT * FROM production_run_services WHERE run_id = ? ORDER BY id").all(id);
  return { ...run, components, services };
}

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, n.name AS output_item_name
       FROM production_runs r
       LEFT JOIN production_formulas f ON f.id = r.formula_id
       LEFT JOIN inventory_nodes n ON n.id = f.output_item_id
       ORDER BY r.id DESC`
    )
    .all();
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const run = getRunWithLines(req.params.id);
  if (!run) return res.status(404).json({ error: "not found" });
  res.json(run);
});

router.post("/", (req, res) => {
  const { formula_id, run_date, quantity, component_prices = {}, service_costs = [], description = "" } = req.body;
  if (!formula_id || !run_date || !quantity || Number(quantity) <= 0) {
    return res.status(400).json({ error: "فرمول، تاریخ و تعداد تولید الزامی است." });
  }
  
  // Validate quantity is a positive number
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: "تعداد تولید باید یک عدد مثبت باشد." });
  }
  
  // Validate component prices are non-negative
  for (const itemId in component_prices) {
    const price = Number(component_prices[itemId]);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: "قیمت قطعات نمی‌تواند منفی باشد." });
    }
  }
  
  // Validate service costs are non-negative
  for (const svc of service_costs) {
    const cost = Number(svc.cost);
    if (isNaN(cost) || cost < 0) {
      return res.status(400).json({ error: "هزینه خدمات نمی‌تواند منفی باشد." });
    }
  }

  const formula = db.prepare("SELECT * FROM production_formulas WHERE id = ?").get(formula_id);
  if (!formula) return res.status(400).json({ error: "فرمول یافت نشد." });
  const components = db.prepare("SELECT * FROM production_formula_components WHERE formula_id = ?").all(formula_id);
  if (!components.length) return res.status(400).json({ error: "این فرمول هیچ قطعه‌ای ندارد." });

  try {
    const tx = db.transaction(() => {
      const needs = components.map((c) => {
        const node = db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(c.item_id);
        const neededQty = c.quantity * Number(quantity);
        const price = Number(component_prices[c.item_id]) || node.avg_cost || 0;
        if (neededQty > node.qty_on_hand) {
          throw new Error(`موجودی «${node.name}» کافی نیست (لازم: ${neededQty}, موجود: ${node.qty_on_hand} ${node.unit || ""}).`);
        }
        return { item_id: c.item_id, name: node.name, unit: node.unit, quantity: neededQty, unit_price: price, line_total: neededQty * price };
      });

      const componentsCost = needs.reduce((s, n) => s + n.line_total, 0);
      const servicesCost = service_costs.reduce((s, sv) => s + (Number(sv.cost) || 0), 0);
      const totalCost = componentsCost + servicesCost;
      const unitCost = totalCost / Number(quantity);

      for (const n of needs) {
        db.prepare("UPDATE inventory_nodes SET qty_on_hand = qty_on_hand - ? WHERE id = ?").run(n.quantity, n.item_id);
      }

      const outputNode = db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(formula.output_item_id);
      const oldQty = outputNode.qty_on_hand || 0;
      const oldAvg = outputNode.avg_cost || 0;
      const newQty = oldQty + Number(quantity);
      const newAvg = newQty > 0 ? (oldQty * oldAvg + Number(quantity) * unitCost) / newQty : 0;
      db.prepare("UPDATE inventory_nodes SET qty_on_hand = ?, avg_cost = ? WHERE id = ?").run(newQty, newAvg, formula.output_item_id);

      const info = db
        .prepare(
          `INSERT INTO production_runs (formula_id, formula_name, run_date, quantity, total_cost, unit_cost, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(formula_id, formula.name, run_date, quantity, totalCost, unitCost, description);
      const runId = info.lastInsertRowid;

      const insertComp = db.prepare(
        "INSERT INTO production_run_components (run_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)"
      );
      for (const n of needs) insertComp.run(runId, n.item_id, n.quantity, n.unit_price, n.line_total);

      const insertSvc = db.prepare("INSERT INTO production_run_services (run_id, name, cost) VALUES (?, ?, ?)");
      for (const sv of service_costs) insertSvc.run(runId, sv.name, Number(sv.cost) || 0);

      return runId;
    });

    const runId = tx();
    res.status(201).json(getRunWithLines(runId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reverses quantities only (adds components back, removes produced output)
// — does NOT undo the avg_cost blend it caused, for the same reason
// purchase invoices don't: reversing a historical weighted-average blend
// after the fact isn't generally sound. Runs also can't be edited, only
// deleted and re-entered, to keep this logic honest and simple.
router.delete("/:id", (req, res) => {
  const run = db.prepare("SELECT * FROM production_runs WHERE id = ?").get(req.params.id);
  if (!run) return res.status(404).json({ error: "not found" });
  
  const components = db.prepare("SELECT * FROM production_run_components WHERE run_id = ?").all(req.params.id);
  const formula = run.formula_id ? db.prepare("SELECT * FROM production_formulas WHERE id = ?").get(run.formula_id) : null;

  try {
    const tx = db.transaction(() => {
      // Check if output item has sufficient quantity to deduct before reversing
      if (formula) {
        const outputNode = db.prepare("SELECT name, qty_on_hand, unit FROM inventory_nodes WHERE id = ?").get(formula.output_item_id);
        if (outputNode && run.quantity > outputNode.qty_on_hand) {
          throw new Error(
            `نمی‌توان این فرایند تولید را حذف کرد — موجودی کالای تولیدی «${outputNode.name}» کافی نیست ` +
            `(لازم: ${run.quantity}, موجود: ${outputNode.qty_on_hand} ${outputNode.unit || ""}).`
          );
        }
      }
      
      // Reverse the production: add components back, remove output
    for (const c of components) {
      db.prepare("UPDATE inventory_nodes SET qty_on_hand = qty_on_hand + ? WHERE id = ?").run(c.quantity, c.item_id);
    }
    if (formula) {
      db.prepare("UPDATE inventory_nodes SET qty_on_hand = qty_on_hand - ? WHERE id = ?").run(run.quantity, formula.output_item_id);
    }
    db.prepare("DELETE FROM production_runs WHERE id = ?").run(req.params.id);
  });

  tx();
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
