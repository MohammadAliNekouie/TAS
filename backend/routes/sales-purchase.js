const express = require("express");
const db = require("../db");
const { normalizePersian } = require("../lib/persian");

const router = express.Router();

function getInvoiceWithItems(id) {
  const invoice = db
    .prepare(
      `SELECT i.*, b.name AS bank_account_name
       FROM sales_purchase_invoices i
       LEFT JOIN bank_accounts b ON b.id = i.bank_account_id
       WHERE i.id = ?`
    )
    .get(id);
  if (!invoice) return null;
  const items = db
    .prepare(
      `SELECT ii.*, n.name AS item_name, n.unit AS item_unit, n.code AS item_code
       FROM invoice_items ii
       JOIN inventory_nodes n ON n.id = ii.inventory_item_id
       WHERE ii.invoice_id = ?
       ORDER BY ii.id`
    )
    .all(id);
  return { ...invoice, items };
}

// This function MUST be called within a db.transaction() context to ensure
// atomic updates and prevent race conditions on concurrent invoice posting.
function applyBankEffect(bankAccountId, type, amount, sign = 1) {
  if (!bankAccountId) return;
  const delta = (type === "sale" ? 1 : -1) * amount * sign;
  const result = db.prepare("UPDATE bank_accounts SET current_balance = current_balance + ? WHERE id = ?").run(delta, bankAccountId);
  if (result.changes === 0) throw new Error("حساب بانکی یافت نشد.");
}

// Sale: just decrements qty_on_hand (avg_cost is untouched — selling doesn't
// change what remaining stock cost). Purchase: recomputes a new weighted-
// average unit cost blended with whatever's already on hand, THEN updates
// qty_on_hand. Returns, per item, the avg_cost to use for GL/COGS purposes
// (the pre-sale cost for sales; the newly-blended cost for purchases).
function applyStockEffect(items, type, sign = 1) {
  const costByItem = {};
  for (const it of items) {
    const node = db.prepare("SELECT qty_on_hand, avg_cost FROM inventory_nodes WHERE id = ?").get(it.inventory_item_id);
    const qty = Number(it.quantity) * sign;

    if (type === "purchase" && sign > 0) {
      // Only blend cost on a forward-going purchase (not on its reversal —
      // reversing a historical weighted-average blend isn't generally
      // sound, so edits/deletes only ever undo the quantity, not the cost;
      // see README for this known limitation of moving-average costing.
      const oldQty = node?.qty_on_hand || 0;
      const oldAvg = node?.avg_cost || 0;
      const newQty = oldQty + qty;
      const newAvg = newQty > 0 ? (oldQty * oldAvg + qty * Number(it.unit_price)) / newQty : 0;
      db.prepare("UPDATE inventory_nodes SET qty_on_hand = ?, avg_cost = ? WHERE id = ?").run(newQty, newAvg, it.inventory_item_id);
      costByItem[it.inventory_item_id] = newAvg;
    } else {
      const change = type === "sale" ? -qty : qty;
      db.prepare("UPDATE inventory_nodes SET qty_on_hand = qty_on_hand + ? WHERE id = ?").run(change, it.inventory_item_id);
      costByItem[it.inventory_item_id] = node?.avg_cost || 0;
    }
  }
  return costByItem;
}

function assertSufficientStock(items) {
  for (const it of items) {
    const node = db.prepare("SELECT name, qty_on_hand, unit FROM inventory_nodes WHERE id = ?").get(it.inventory_item_id);
    if (!node) throw new Error("کالای انتخاب‌شده در انبار یافت نشد.");
    if (Number(it.quantity) > node.qty_on_hand) {
      throw new Error(`موجودی «${node.name}» کافی نیست (موجودی فعلی: ${node.qty_on_hand} ${node.unit || ""}).`);
    }
  }
}

function getAccountingSettings() {
  return db.prepare("SELECT * FROM accounting_settings WHERE id = 1").get() || {};
}

// Deletes whatever auto-generated voucher is tied to this invoice (if any).
// Lines cascade automatically.
function deleteInvoiceVoucher(invoiceId) {
  db.prepare("DELETE FROM journal_vouchers WHERE source_type = 'sales_purchase_invoice' AND source_id = ?").run(invoiceId);
}

// Since parties are only linked to invoices by name (not a foreign key —
// see README), this looks the party up by normalized name at posting time.
// If no matching party record exists (free-typed name), there's nothing to
// check against, so no reminder is created — that's an acceptable gap given
// the same name-based simplification documented elsewhere.
function maybeCreateModayanReminder(invoiceId, type, party) {
  db.prepare("DELETE FROM modayan_reminders WHERE invoice_id = ?").run(invoiceId);

  const partyRow = db.prepare("SELECT legal_status FROM parties WHERE name_normalized = ?").get(normalizePersian(party));
  if (!partyRow?.legal_status) return;

  let reason = null;
  if (type === "sale" && partyRow.legal_status === "individual") {
    reason = `فروش به شخص حقیقی «${party}» — بررسی و ثبت این فاکتور در سامانه مودیان را فراموش نکنید.`;
  } else if (type === "purchase" && partyRow.legal_status === "legal") {
    reason = `خرید از شخص حقوقی «${party}» — بررسی این فاکتور در سامانه مودیان را فراموش نکنید.`;
  }
  if (reason) {
    db.prepare("INSERT INTO modayan_reminders (invoice_id, reason) VALUES (?, ?)").run(invoiceId, reason);
  }
}

// Builds and inserts a real double-entry journal voucher for this invoice,
// IF the accounting mapping needed for this specific scenario is fully
// configured. Returns a warning string when it's not (invoice still saves
// either way — GL posting is additive, not a hard requirement).
function postInvoiceToLedger({ invoiceId, type, invoiceDate, party, bankAccountId, total, costByItem, items }) {
  const settings = getAccountingSettings();
  const bankAccount = bankAccountId ? db.prepare("SELECT * FROM bank_accounts WHERE id = ?").get(bankAccountId) : null;
  const moneyAccountId = bankAccount?.coa_account_id || (type === "sale" ? settings.ar_account_id : settings.ap_account_id);

  if (!moneyAccountId) {
    return bankAccountId
      ? "سند حسابداری ثبت نشد: حساب بانکی انتخابی به هیچ حساب کل/معینی متصل نیست (در تنظیمات اولیه اصلاح کنید)."
      : `سند حسابداری ثبت نشد: حساب ${type === "sale" ? "دریافتنی" : "پرداختنی"} پیش‌فرض در «اتصال حسابداری» تنظیم نشده است.`;
  }
  if (type === "sale" && !settings.sales_account_id) {
    return "سند حسابداری ثبت نشد: حساب فروش پیش‌فرض در «اتصال حسابداری» تنظیم نشده است.";
  }
  if (type === "purchase" && !settings.inventory_account_id) {
    return "سند حسابداری ثبت نشد: حساب موجودی کالا در «اتصال حسابداری» تنظیم نشده است.";
  }

  const lines = [];
  const desc = `فاکتور ${type === "sale" ? "فروش" : "خرید"} شماره ${invoiceId} — ${party}`;

  if (type === "sale") {
    lines.push({ account_id: moneyAccountId, debit: total, credit: 0, description: desc });
    lines.push({ account_id: settings.sales_account_id, debit: 0, credit: total, description: desc });

    if (settings.cogs_account_id && settings.inventory_account_id) {
      const cogs = items.reduce((s, it) => s + Number(it.quantity) * (costByItem[it.inventory_item_id] || 0), 0);
      if (cogs > 0) {
        lines.push({ account_id: settings.cogs_account_id, debit: cogs, credit: 0, description: `بهای تمام‌شده — ${desc}` });
        lines.push({ account_id: settings.inventory_account_id, debit: 0, credit: cogs, description: `بهای تمام‌شده — ${desc}` });
      }
    }
  } else {
    lines.push({ account_id: settings.inventory_account_id, debit: total, credit: 0, description: desc });
    lines.push({ account_id: moneyAccountId, debit: 0, credit: total, description: desc });
  }

  const info = db
    .prepare("INSERT INTO journal_vouchers (voucher_date, description, status, source_type, source_id) VALUES (?, ?, 'permanent', 'sales_purchase_invoice', ?)")
    .run(invoiceDate, desc, invoiceId);
  const voucherId = info.lastInsertRowid;
  const insertLine = db.prepare(
    `INSERT INTO journal_voucher_lines (voucher_id, account_id, debit, credit, description)
     VALUES (@voucher_id, @account_id, @debit, @credit, @description)`
  );
  for (const l of lines) insertLine.run({ voucher_id: voucherId, ...l });

  return null;
}

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT i.*, b.name AS bank_account_name,
              (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) AS item_count
       FROM sales_purchase_invoices i
       LEFT JOIN bank_accounts b ON b.id = i.bank_account_id
       ORDER BY i.id DESC`
    )
    .all();
  res.json(rows);
});

router.get("/:id", (req, res) => {
  const invoice = getInvoiceWithItems(req.params.id);
  if (!invoice) return res.status(404).json({ error: "not found" });
  res.json(invoice);
});

router.post("/", (req, res) => {
  const { type, party, invoice_date, bank_account_id, description = "", items = [] } = req.body;
  if (!type || !party || !invoice_date) return res.status(400).json({ error: "type, party, invoice_date required" });
  if (!items.length) return res.status(400).json({ error: "at least one invoice item is required" });
  
  // Validate all quantities and prices are positive numbers
  for (const item of items) {
    const qty = Number(item.quantity);
    const price = Number(item.unit_price);
    
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: "تعداد باید یک عدد مثبت باشد." });
    }
    
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: "قیمت واحد نمی‌تواند منفی باشد." });
    }
    
    if (!item.inventory_item_id) {
      return res.status(400).json({ error: "همه ردیف‌ها باید یک کالا انتخاب شده داشته باشند." });
    }
  }

  try {
    let glWarning = null;
    const tx = db.transaction(() => {
      if (type === "sale") assertSufficientStock(items);

      const total = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);

      const info = db
        .prepare(
          `INSERT INTO sales_purchase_invoices (type, party, invoice_date, bank_account_id, total_amount, description)
           VALUES (@type, @party, @invoice_date, @bank_account_id, @total, @description)`
        )
        .run({ type, party, invoice_date, bank_account_id: bank_account_id || null, total, description });

      const invoiceId = info.lastInsertRowid;

      const insertItem = db.prepare(
        `INSERT INTO invoice_items (invoice_id, inventory_item_id, quantity, unit_price, line_total)
         VALUES (@invoice_id, @inventory_item_id, @quantity, @unit_price, @line_total)`
      );
      for (const it of items) {
        insertItem.run({
          invoice_id: invoiceId, inventory_item_id: it.inventory_item_id, quantity: it.quantity, unit_price: it.unit_price,
          line_total: Number(it.quantity) * Number(it.unit_price),
        });
      }

      const costByItem = applyStockEffect(items, type, 1);
      if (bank_account_id) applyBankEffect(bank_account_id, type, total, 1);

      glWarning = postInvoiceToLedger({ invoiceId, type, invoiceDate: invoice_date, party, bankAccountId: bank_account_id, total, costByItem, items });
      maybeCreateModayanReminder(invoiceId, type, party);

      return invoiceId;
    });

    const invoiceId = tx();
    res.status(201).json({ ...getInvoiceWithItems(invoiceId), gl_warning: glWarning });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/:id", (req, res) => {
  const { type, party, invoice_date, bank_account_id, description = "", items = [] } = req.body;
  if (!type || !party || !invoice_date) return res.status(400).json({ error: "type, party, invoice_date required" });
  if (!items.length) return res.status(400).json({ error: "at least one invoice item is required" });
  
  // Validate all quantities and prices are positive numbers
  for (const item of items) {
    const qty = Number(item.quantity);
    const price = Number(item.unit_price);
    
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: "تعداد باید یک عدد مثبت باشد." });
    }
    
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: "قیمت واحد نمی‌تواند منفی باشد." });
    }
    
    if (!item.inventory_item_id) {
      return res.status(400).json({ error: "همه ردیف‌ها باید یک کالا انتخاب شده داشته باشند." });
    }
  }

  const existing = db.prepare("SELECT * FROM sales_purchase_invoices WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const existingItems = db.prepare("SELECT inventory_item_id, quantity FROM invoice_items WHERE invoice_id = ?").all(req.params.id);

  try {
    let glWarning = null;
    const tx = db.transaction(() => {
      applyStockEffect(existingItems, existing.type, -1);
      if (existing.bank_account_id) {
        applyBankEffect(existing.bank_account_id, existing.type, existing.total_amount, -1);
      }
      deleteInvoiceVoucher(req.params.id);

      if (type === "sale") assertSufficientStock(items);

      db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(req.params.id);

      const total = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);

      db.prepare(
        `UPDATE sales_purchase_invoices
         SET type = @type, party = @party, invoice_date = @invoice_date,
             bank_account_id = @bank_account_id, total_amount = @total, description = @description
         WHERE id = @id`
      ).run({ type, party, invoice_date, bank_account_id: bank_account_id || null, total, description, id: req.params.id });

      const insertItem = db.prepare(
        `INSERT INTO invoice_items (invoice_id, inventory_item_id, quantity, unit_price, line_total)
         VALUES (@invoice_id, @inventory_item_id, @quantity, @unit_price, @line_total)`
      );
      for (const it of items) {
        insertItem.run({
          invoice_id: req.params.id, inventory_item_id: it.inventory_item_id, quantity: it.quantity, unit_price: it.unit_price,
          line_total: Number(it.quantity) * Number(it.unit_price),
        });
      }

      const costByItem = applyStockEffect(items, type, 1);
      if (bank_account_id) applyBankEffect(bank_account_id, type, total, 1);

      glWarning = postInvoiceToLedger({ invoiceId: req.params.id, type, invoiceDate: invoice_date, party, bankAccountId: bank_account_id, total, costByItem, items });
      maybeCreateModayanReminder(req.params.id, type, party);
    });

    tx();
    res.json({ ...getInvoiceWithItems(req.params.id), gl_warning: glWarning });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM sales_purchase_invoices WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  const existingItems = db.prepare("SELECT inventory_item_id, quantity FROM invoice_items WHERE invoice_id = ?").all(req.params.id);

  const tx = db.transaction(() => {
    applyStockEffect(existingItems, existing.type, -1);
    if (existing.bank_account_id) {
      applyBankEffect(existing.bank_account_id, existing.type, existing.total_amount, -1);
    }
    deleteInvoiceVoucher(req.params.id);
    db.prepare("DELETE FROM sales_purchase_invoices WHERE id = ?").run(req.params.id);
  });

  tx();
  res.status(204).end();
});

module.exports = router;
