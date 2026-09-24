const express = require("express");
const db = require("../db");
const { rebuildInventory } = require("../lib/inventoryLedger");
const { resolveAccount, postVoucher, deleteSourceVoucher, assertPeriodOpen, money } = require("../lib/accounting");

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

  const formula = db.prepare("SELECT * FROM production_formulas WHERE id = ?").get(formula_id);
  if (!formula) return res.status(400).json({ error: "فرمول یافت نشد." });
  const components = db.prepare("SELECT * FROM production_formula_components WHERE formula_id = ?").all(formula_id);
  if (!components.length) return res.status(400).json({ error: "این فرمول هیچ قطعه‌ای ندارد." });

  try {
    const tx = db.transaction(() => {
      const needs = components.map((c) => {
        const node = db.prepare("SELECT * FROM inventory_nodes WHERE id = ?").get(c.item_id);
        const neededQty = c.quantity * Number(quantity);
        const supplied = component_prices[c.item_id]; const price = supplied === undefined || supplied === '' ? Number(node.avg_cost || 0) : money(supplied, 'بهای واحد مواد');
        if (neededQty > node.qty_on_hand) {
          throw new Error(`موجودی «${node.name}» کافی نیست (لازم: ${neededQty}, موجود: ${node.qty_on_hand} ${node.unit || ""}).`);
        }
        return { item_id: c.item_id, name: node.name, unit: node.unit, quantity: neededQty, unit_price: price, line_total: Math.round(neededQty * price) };
      });

      const componentsCost = needs.reduce((s, n) => s + n.line_total, 0);
      const servicesCost = service_costs.reduce((s, sv) => s + money(sv.cost || 0, 'هزینه خدمات تولید'), 0);
      const totalCost = Math.round(componentsCost + servicesCost);
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

      rebuildInventory();
      const settings = db.prepare('SELECT * FROM accounting_settings WHERE id=1').get() || {};
      const outputAccount = resolveAccount(settings.inventory_account_id, '1701', 'موجودی کالای تولیدی');
      const componentAccount = resolveAccount(settings.inventory_account_id, '1701', 'موجودی مواد');
      const serviceAccount = resolveAccount(settings.other_payable_account_id, '3301', 'بستانکار خدمات تولید');
      const lines = [{account_id: outputAccount, debit: totalCost, credit: 0}];
      for (const n of needs) lines.push({account_id: componentAccount, debit: 0, credit: n.line_total});
      if (servicesCost > 0) lines.push({account_id: serviceAccount, debit: 0, credit: servicesCost});
      postVoucher({date: run_date, description: `تولید شماره ${runId} — ${formula.name}`, sourceType: 'production_run', sourceId: runId, lines});
      return runId;
    });

    const runId = tx();
    res.status(201).json(getRunWithLines(runId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Production runs are source events for inventory and accounting. Deleting a run
// removes its source voucher and rebuilds the inventory ledger from history.
router.delete("/:id", (req, res) => {
  const run = db.prepare("SELECT * FROM production_runs WHERE id = ?").get(req.params.id);
  if (!run) return res.status(404).json({ error: "not found" });
  const components = db.prepare("SELECT * FROM production_run_components WHERE run_id = ?").all(req.params.id);
  const formula = run.formula_id ? db.prepare("SELECT * FROM production_formulas WHERE id = ?").get(run.formula_id) : null;

  assertPeriodOpen(run.run_date);
  const tx = db.transaction(() => {
    deleteSourceVoucher('production_run', run.id);
    for (const c of components) {
      db.prepare("UPDATE inventory_nodes SET qty_on_hand = qty_on_hand + ? WHERE id = ?").run(c.quantity, c.item_id);
    }
    if (formula) {
      db.prepare("UPDATE inventory_nodes SET qty_on_hand = qty_on_hand - ? WHERE id = ?").run(run.quantity, formula.output_item_id);
    }
    db.prepare("DELETE FROM production_runs WHERE id = ?").run(req.params.id);
    rebuildInventory();
  });

  tx();
  res.status(204).end();
});

module.exports = router;
