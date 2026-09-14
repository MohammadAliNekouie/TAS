const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const db = require("../db");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Every table, written to one sheet each. Order doesn't matter for
// correctness during import (foreign key checks are disabled for the
// duration — see below), but keeping ids/relationships intact does, which
// is why every column (including primary keys) is preserved verbatim.
const ALL_TABLES = [
  "warehouses", "company_info", "bank_accounts", "parties", "inventory_nodes",
  "chart_of_accounts", "accounting_settings",
  "sales_purchase_invoices", "invoice_items", "journal_vouchers", "journal_voucher_lines",
  "cheques", "receipts_payments", "petty_cash", "fx_transactions",
  "production_formulas", "production_formula_components", "production_formula_services",
  "production_runs", "production_run_components", "production_run_services",
  "stock_adjustments", "stock_adjustment_items",
  "modayan_submissions", "modayan_reminders", "users",
  // legacy tables kept for backward compatibility with older databases —
  // no longer written to by current code, but preserved on backup/restore
  // in case they still hold historical rows.
  "journal_entries", "production_orders",
];

// Subset considered "financial data" for the wipe action — deliberately
// excludes تنظیمات اولیه (company_info, bank_accounts, warehouses,
// accounting_settings, users) and the level-1 (fixed) rows of
// chart_of_accounts, which are setup, not transactional history.
const FINANCIAL_TABLES = [
  "invoice_items", "journal_voucher_lines", "journal_vouchers", "journal_entries",
  "sales_purchase_invoices", "receipts_payments", "cheques", "petty_cash",
  "fx_transactions", "modayan_submissions", "modayan_reminders",
  "production_run_components", "production_run_services", "production_runs",
  "production_formula_components", "production_formula_services", "production_formulas",
  "production_orders", "stock_adjustment_items", "stock_adjustments",
  "inventory_nodes", "parties",
];

// GET /api/backup/export -> full snapshot as a downloadable .xlsx, one sheet
// per table.
router.get("/export", async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    for (const table of ALL_TABLES) {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      const sheet = workbook.addWorksheet(table);
      const cols = rows.length > 0 ? Object.keys(rows[0]) : db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
      sheet.columns = cols.map((key) => ({ header: key, key }));
      rows.forEach((row) => sheet.addRow(row));
    }

    const filename = `tas-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Backup export failed:", err.message);
    res.status(500).json({ error: "تهیه فایل بکاپ با خطا مواجه شد." });
  }
});

// POST /api/backup/import -> wipes every table and reloads it from an
// uploaded .xlsx previously produced by /export.
router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "فایلی ارسال نشده است." });

  // SQLite only allows toggling `foreign_keys` outside an active
  // transaction, so this has to wrap the transaction rather than sit
  // inside it.
  db.pragma("foreign_keys = OFF");
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const tx = db.transaction(() => {
      for (const table of [...ALL_TABLES].reverse()) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
      for (const table of ALL_TABLES) {
        const sheet = workbook.getWorksheet(table);
        if (!sheet || sheet.rowCount < 1) continue;

        const headerRow = sheet.getRow(1).values.slice(1);
        const colNames = headerRow.map((h) => String(h));
        const insert = db.prepare(
          `INSERT INTO ${table} (${colNames.join(", ")}) VALUES (${colNames.map((c) => `@${c}`).join(", ")})`
        );

        for (let r = 2; r <= sheet.rowCount; r++) {
          const rawValues = sheet.getRow(r).values.slice(1);
          if (rawValues.every((v) => v === undefined || v === null)) continue; // skip fully blank rows
          const record = {};
          colNames.forEach((col, i) => {
            record[col] = rawValues[i] === undefined ? null : rawValues[i];
          });
          insert.run(record);
        }
      }
    });

    tx();
    res.json({ ok: true });
  } catch (err) {
    console.error("Backup import failed:", err.message);
    res.status(400).json({ error: `بازیابی اطلاعات ناموفق بود: ${err.message}` });
  } finally {
    db.pragma("foreign_keys = ON");
  }
});

// DELETE /api/backup/reset-financial-data -> wipes documents/invoices,
// accounting vouchers, production history, categories/items, and parties,
// but keeps تنظیمات اولیه intact (company info, bank accounts, warehouses,
// accounting mapping, users) — including the fixed level-1 groups of
// کدینگ حسابداری, since those are a standard classification, not history.
// Bank balances reset to initial_balance since the journal vouchers that
// moved them away from that are being deleted too.
router.delete("/reset-financial-data", (req, res) => {
  db.pragma("foreign_keys = OFF");
  try {
    const tx = db.transaction(() => {
      for (const table of [...FINANCIAL_TABLES].reverse()) {
        db.prepare(`DELETE FROM ${table}`).run();
      }
      db.prepare("DELETE FROM chart_of_accounts WHERE level IN (2, 3)").run();
      db.prepare("UPDATE bank_accounts SET current_balance = initial_balance").run();
    });
    tx();
    res.json({ ok: true });
  } catch (err) {
    console.error("Financial data reset failed:", err.message);
    res.status(500).json({ error: "پاک‌سازی اطلاعات با خطا مواجه شد." });
  } finally {
    db.pragma("foreign_keys = ON");
  }
});

module.exports = router;
