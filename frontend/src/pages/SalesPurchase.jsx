import React, { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, Search } from "lucide-react";
import { api } from "../lib/api.js";
import { toFa, rial } from "../lib/persian.js";
import PartyPicker from "../components/PartyPicker.jsx";
import RialInput from "../components/RialInput.jsx";
import JalaliDatePicker from "../components/JalaliDatePicker.jsx";
import { usePreferredCurrencyDisplay } from "../lib/currency.js";

const inputStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--ink)",
  width: "100%",
  minWidth: 0,
};

const emptyHeader = { type: "sale", invoice_kind: "normal", original_invoice_id: "", party: "", invoice_date: "", bank_account_id: "", discount_amount: "", tax_rate: "", description: "" };
const emptyRow = () => ({ _key: Math.random().toString(36).slice(2), inventory_item_id: null, item_name: "", item_unit: "", available_qty: null, quantity: "", unit_price: "" });

function ItemRow({ row, invoiceType, formatPreferredCurrency, onChange, onRemove, onRequestQuickAdd }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const inStockOnly = invoiceType === "sale";
  const allowCreate = invoiceType === "purchase";

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.inventorySearch(query, { inStockOnly }).then((r) => {
        setResults(r);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query, inStockOnly]);

  function selectItem(item) {
    onChange({ inventory_item_id: item.id, item_name: item.name, item_unit: item.unit, available_qty: item.qty_on_hand });
    setOpen(false);
    setQuery("");
  }

  const lineTotal = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0);
  const overStock = inStockOnly && row.available_qty != null && Number(row.quantity) > row.available_qty;

  return (
    <div style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{ flex: 1, position: "relative" }} ref={boxRef}>
        {row.inventory_item_id ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...inputStyle }}>
            <span>{row.item_name} <span style={{ color: "var(--ink-soft)", fontSize: 11.5 }}>({row.item_unit})</span></span>
            <button
              type="button"
              onClick={() => onChange({ inventory_item_id: null, item_name: "", item_unit: "", available_qty: null })}
              style={{ border: "none", background: "transparent", color: "var(--ink-soft)", fontSize: 11, cursor: "pointer" }}
            >
              تغییر
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, ...inputStyle }}>
              <Search size={13} color="var(--ink-soft)" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => query && setOpen(true)}
                placeholder={inStockOnly ? "جستجو در کالاهای دارای موجودی..." : "جستجوی کالا با نام یا کد..."}
                style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontFamily: "inherit", fontSize: 13, color: "var(--ink)" }}
              />
            </div>
            {open && query && (
              <div
                style={{
                  position: "absolute", top: "calc(100% + 4px)", right: 0, left: 0, zIndex: 20,
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                  maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
                }}
              >
                {results.map((item) => {
                  const foreign = formatPreferredCurrency ? formatPreferredCurrency(item.avg_cost || 0) : null;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectItem(item)}
                      style={{ display: "block", width: "100%", textAlign: "right", padding: "9px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit", color: "var(--ink)", borderBottom: "1px solid var(--border)" }}
                    >
                      {item.name} <span style={{ color: "var(--ink-soft)", fontSize: 11 }}>· کد {item.code} · موجودی {toFa(item.qty_on_hand)} {item.unit} · {rial(item.avg_cost || 0)}{foreign ? ` (${foreign})` : ""}</span>
                    </button>
                  );
                })}
                {results.length === 0 && (
                  <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-soft)" }}>
                    {inStockOnly ? "کالایی با موجودی مثبت یافت نشد." : "کالایی یافت نشد."}
                  </div>
                )}
                {allowCreate && (
                  <button
                    type="button"
                    onClick={() => { onRequestQuickAdd(query); setOpen(false); }}
                    style={{ display: "block", width: "100%", textAlign: "right", padding: "10px 12px", border: "none", background: "var(--teal-soft)", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit", color: "var(--teal-dark)", fontWeight: 700 }}
                  >
                    + تعریف کالای جدید در انبار: «{query}»
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <input
        type="number" placeholder="تعداد" value={row.quantity}
        onChange={(e) => onChange({ quantity: e.target.valueAsNumber || "" })}
        style={{ ...inputStyle, width: 80, borderColor: overStock ? "var(--brick)" : "var(--border)" }}
      />
      <div style={{ width: 150 }}>
        <RialInput value={row.unit_price} onChange={(v) => onChange({ unit_price: v })} placeholder="قیمت واحد" />
      </div>
      <div style={{ ...inputStyle, width: 140, background: "var(--bg)", color: "var(--ink-soft)", textAlign: "left" }}>
        {rial(lineTotal)}
      </div>
      <button type="button" onClick={onRemove} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 8 }}>
        <X size={15} color="var(--brick)" />
      </button>
    </div>
    {row.inventory_item_id && inStockOnly && row.available_qty != null && (
      <div style={{ fontSize: 11, color: overStock ? "var(--brick)" : "var(--ink-soft)", marginTop: 3, marginRight: 2 }}>
        موجودی قابل فروش: {toFa(row.available_qty)} {row.item_unit}
        {overStock && " — تعداد وارد شده بیشتر از موجودی است"}
      </div>
    )}
    </div>
  );
}

function QuickAddCategoryModal({ onClose, onCreated }) {
  const [groups, setGroups] = useState([]);
  const [mode, setMode] = useState("existing"); // "existing" | "new"
  const [groupId, setGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { api.inventoryTree(null).then(setGroups); }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let parentId = groupId;
      if (mode === "new") {
        const group = await api.inventoryCreateGroup({ name: newGroupName });
        parentId = group.id;
      }
      if (!parentId) throw new Error("انتخاب یا تعریف گروه اصلی الزامی است.");
      const category = await api.inventoryCreateCategory({ parent_id: parentId, name: categoryName });
      onCreated(category);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 22, width: 360 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>دسته‌بندی جدید</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={17} color="var(--ink-soft)" />
          </button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <button type="button" onClick={() => setMode("existing")} style={{ flex: 1, border: "none", padding: "7px 0", fontSize: 12, cursor: "pointer", background: mode === "existing" ? "var(--accent-solid)" : "transparent", color: mode === "existing" ? "#fff" : "var(--ink-soft)" }}>
              گروه موجود
            </button>
            <button type="button" onClick={() => setMode("new")} style={{ flex: 1, border: "none", padding: "7px 0", fontSize: 12, cursor: "pointer", background: mode === "new" ? "var(--accent-solid)" : "transparent", color: mode === "new" ? "#fff" : "var(--ink-soft)" }}>
              گروه جدید
            </button>
          </div>

          {mode === "existing" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              گروه اصلی
              <select required value={groupId} onChange={(e) => setGroupId(e.target.value)} style={inputStyle}>
                <option value="" disabled>انتخاب کنید</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              نام گروه اصلی جدید
              <input required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} style={inputStyle} />
            </label>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
            نام دسته‌بندی (زیرگروه)
            <input required value={categoryName} onChange={(e) => setCategoryName(e.target.value)} style={inputStyle} />
          </label>

          {error && <div style={{ color: "var(--brick)", fontSize: 12 }}>{error}</div>}

          <button type="submit" disabled={saving} style={{ background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "در حال ذخیره..." : "افزودن و انتخاب"}
          </button>
        </form>
      </div>
    </div>
  );
}

function QuickAddItemModal({ prefillName, onClose, onCreated }) {
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [values, setValues] = useState({ parent_id: "", name: prefillName || "", unit: "", warehouse_id: "", min_qty: 0, qty_on_hand: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.inventoryCategories().then(setCategories);
    api.warehouses.list().then((rows) => {
      setWarehouses(rows);
      if (rows.length) setValues((v) => ({ ...v, warehouse_id: rows[0].id }));
    });
  }, []);

  function handleCategoryCreated(category) {
    api.inventoryCategories().then((cats) => {
      setCategories(cats);
      setValues((v) => ({ ...v, parent_id: category.id }));
    });
    setCategoryModalOpen(false);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api.inventoryCreateItem(values);
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 22, width: 380 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>تعریف کالای جدید در انبار</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={17} color="var(--ink-soft)" />
          </button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
            دسته‌بندی (زیرگروه)
            <div style={{ display: "flex", gap: 6 }}>
              <select required value={values.parent_id} onChange={(e) => setValues((v) => ({ ...v, parent_id: e.target.value }))} style={inputStyle}>
                <option value="" disabled>انتخاب کنید</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.parent_name} › {c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                title="دسته‌بندی جدید"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", background: "var(--bg)", borderRadius: 8, padding: "0 10px", cursor: "pointer", flexShrink: 0 }}
              >
                <Plus size={15} color="var(--teal)" />
              </button>
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
            نام کالا
            <input required value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} style={inputStyle} />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              واحد
              <input value={values.unit} onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))} placeholder="عدد" style={inputStyle} />
            </label>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              انبار
              <select value={values.warehouse_id} onChange={(e) => setValues((v) => ({ ...v, warehouse_id: e.target.value }))} style={inputStyle}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              موجودی اولیه
              <input type="number" value={values.qty_on_hand} onChange={(e) => setValues((v) => ({ ...v, qty_on_hand: e.target.valueAsNumber || 0 }))} style={inputStyle} />
            </label>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              حداقل موجودی
              <input type="number" value={values.min_qty} onChange={(e) => setValues((v) => ({ ...v, min_qty: e.target.valueAsNumber || 0 }))} style={inputStyle} />
            </label>
          </div>
          {error && <div style={{ color: "var(--brick)", fontSize: 12 }}>{error}</div>}
          <button type="submit" disabled={saving} style={{ marginTop: 6, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "در حال ذخیره..." : "افزودن به انبار و انتخاب در فاکتور"}
          </button>
        </form>
      </div>
      {categoryModalOpen && (
        <QuickAddCategoryModal onClose={() => setCategoryModalOpen(false)} onCreated={handleCategoryCreated} />
      )}
    </div>
  );
}

function ExpandedItems({ invoiceId }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.invoices.get(invoiceId).then((inv) => setItems(inv.items));
  }, [invoiceId]);
  if (!items) return <div style={{ padding: "10px 20px", fontSize: 12.5, color: "var(--ink-soft)" }}>در حال بارگذاری اقلام...</div>;
  return (
    <div style={{ padding: "10px 20px 16px", background: "var(--bg)" }}>
      <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "var(--ink-soft)", textAlign: "right" }}>
            <th style={{ fontWeight: 500, padding: "6px 8px" }}>کالا</th>
            <th style={{ fontWeight: 500, padding: "6px 8px" }}>تعداد</th>
            <th style={{ fontWeight: 500, padding: "6px 8px" }}>قیمت واحد</th>
            <th style={{ fontWeight: 500, padding: "6px 8px" }}>جمع</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td style={{ padding: "6px 8px" }}>{it.item_name} ({it.item_unit})</td>
              <td style={{ padding: "6px 8px" }}>{toFa(it.quantity)}</td>
              <td style={{ padding: "6px 8px" }}>{rial(it.unit_price)}</td>
              <td style={{ padding: "6px 8px" }}>{rial(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SalesPurchase() {
  const { format: formatPreferredCurrency } = usePreferredCurrencyDisplay();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [header, setHeader] = useState(emptyHeader);
  const [items, setItems] = useState([emptyRow()]);
  const [quickAddFor, setQuickAddFor] = useState(null); // { rowKey, prefillName } | null
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  function load() {
    setLoading(true);
    api.invoices.list().then(setInvoices).finally(() => setLoading(false));
  }
  useEffect(load, []);
  useEffect(() => { api.bankAccounts.list().then(setBankAccounts); }, []);

  function openAdd() {
    setEditingId(null);
    setHeader(emptyHeader);
    setItems([emptyRow()]);
    setFormError(null);
    setFormOpen(true);
  }

  async function openEdit(row) {
    const full = await api.invoices.get(row.id);
    setEditingId(row.id);
    setHeader({
      type: full.type, invoice_kind: full.invoice_kind || "normal", original_invoice_id: full.original_invoice_id || "", party: full.party, invoice_date: full.invoice_date,
      bank_account_id: full.bank_account_id || "", discount_amount: full.discount_amount || "", tax_rate: full.tax_rate || "", description: full.description || "",
    });
    setItems(full.items.map((it) => ({
      _key: Math.random().toString(36).slice(2),
      inventory_item_id: it.inventory_item_id, item_name: it.item_name, item_unit: it.item_unit,
      quantity: it.quantity, unit_price: it.unit_price,
    })));
    setFormError(null);
    setFormOpen(true);
  }

  function updateRow(key, patch) {
    setItems((rows) => rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key) {
    setItems((rows) => (rows.length > 1 ? rows.filter((r) => r._key !== key) : rows));
  }
  function addRow() {
    setItems((rows) => [...rows, emptyRow()]);
  }

  function handleItemCreated(rowKey, created) {
    updateRow(rowKey, { inventory_item_id: created.id, item_name: created.name, item_unit: created.unit });
    setQuickAddFor(null);
  }

  const subtotal = items.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0);
  const discount = Number(header.discount_amount) || 0;
  const tax = Math.round(Math.max(0, subtotal - discount) * (Number(header.tax_rate) || 0) / 100);
  const total = subtotal - discount + tax;

  async function submit(e) {
    e.preventDefault();
    const validItems = items.filter((r) => r.inventory_item_id && Number(r.quantity) > 0);
    if (validItems.length === 0) {
      setFormError("حداقل یک ردیف کالا با تعداد معتبر لازم است.");
      return;
    }
    if (!header.invoice_date) {
      setFormError("انتخاب تاریخ فاکتور الزامی است.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...header,
        original_invoice_id: header.original_invoice_id || null,
        discount_amount: Number(header.discount_amount) || 0,
        tax_rate: Number(header.tax_rate) || 0,
        bank_account_id: header.bank_account_id || null,
        items: validItems.map((r) => ({ inventory_item_id: r.inventory_item_id, quantity: r.quantity, unit_price: r.unit_price })),
      };
      if (editingId) await api.invoices.update(editingId, payload);
      else await api.invoices.create(payload);
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(id) {
    await api.invoices.remove(id);
    setConfirmDeleteId(null);
    load();
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>خرید و فروش</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0", maxWidth: 560 }}>
            هر فاکتور از چند ردیف کالای انبار تشکیل می‌شود. با ثبت فاکتور، سند حسابداری به مبلغ کل به‌صورت خودکار در حساب بانکی انتخابی ثبت می‌شود.
          </p>
        </div>
        <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          <Plus size={16} /> افزودن جدید
        </button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>هنوز فاکتوری ثبت نشده است.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--ink-soft)", textAlign: "right", background: "var(--bg)" }}>
                <th style={{ width: 30 }} />
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>نوع</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>طرف حساب</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>تاریخ</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>تعداد اقلام</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>مبلغ کل</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>حساب بانکی</th>
                <th style={{ width: 96 }} />
              </tr>
            </thead>
            <tbody>
              {invoices.map((row) => (
                <React.Fragment key={row.id}>
                  <tr style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 8px", textAlign: "center" }}>
                      <button onClick={() => setExpandedId(expandedId === row.id ? null : row.id)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                        {expandedId === row.id ? <ChevronUp size={15} color="var(--ink-soft)" /> : <ChevronDown size={15} color="var(--ink-soft)" />}
                      </button>
                    </td>
                    <td style={{ padding: "12px 16px" }}>{row.type === "sale" ? "فروش" : "خرید"}</td>
                    <td style={{ padding: "12px 16px" }}>{row.party}</td>
                    <td style={{ padding: "12px 16px" }}>{row.invoice_date}</td>
                    <td style={{ padding: "12px 16px" }}>{toFa(row.item_count)}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 700 }}>{rial(row.total_amount)}</td>
                    <td style={{ padding: "12px 16px", color: "var(--ink-soft)" }}>{row.bank_account_name || "—"}</td>
                    <td style={{ padding: "8px 16px" }}>
                      {confirmDeleteId === row.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                          <span style={{ color: "var(--brick)" }}>حذف شود؟</span>
                          <button onClick={() => doDelete(row.id)} style={{ border: "none", background: "transparent", color: "var(--brick)", cursor: "pointer", fontWeight: 700 }}>بله</button>
                          <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700 }}>خیر</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                          <button onClick={() => openEdit(row)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 6, cursor: "pointer" }}>
                            <Pencil size={14} color="var(--ink-soft)" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(row.id)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 6, cursor: "pointer" }}>
                            <Trash2 size={14} color="var(--brick)" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <ExpandedItems invoiceId={row.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <div onClick={() => setFormOpen(false)} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 24, width: 640, maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editingId ? "ویرایش فاکتور" : "فاکتور جدید"}</h2>
              <button onClick={() => setFormOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X size={18} color="var(--ink-soft)" />
              </button>
            </div>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
                  نوع سند
                  <select value={header.type} onChange={(e) => setHeader((h) => ({ ...h, type: e.target.value }))} style={inputStyle}>
                    <option value="sale">فروش</option>
                    <option value="purchase">خرید</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
                  نوع عملیات
                  <select value={header.invoice_kind} onChange={(e) => setHeader((h) => ({ ...h, invoice_kind: e.target.value, original_invoice_id: "" }))} style={inputStyle}>
                    <option value="normal">عادی</option>
                    <option value="return">برگشت</option>
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)", gridColumn: "span 2" }}>
                  طرف حساب
                  <PartyPicker value={header.party} onChange={(v) => setHeader((h) => ({ ...h, party: v }))} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
                  تاریخ
                  <JalaliDatePicker value={header.invoice_date} onChange={(v) => setHeader((h) => ({ ...h, invoice_date: v }))} />
                </label>
              </div>

              {header.invoice_kind === "return" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
                  فاکتور اصلی
                  <select required value={header.original_invoice_id} onChange={(e) => setHeader((h) => ({ ...h, original_invoice_id: e.target.value }))} style={inputStyle}>
                    <option value="">انتخاب فاکتور اصلی</option>
                    {invoices.filter(x => x.type === header.type && (x.invoice_kind || "normal") === "normal").map(x => <option key={x.id} value={x.id}>#{x.id} — {x.party} — {rial(x.total_amount)}</option>)}
                  </select>
                </label>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
                حساب بانکی (برای ثبت خودکار سند حسابداری)
                <select value={header.bank_account_id} onChange={(e) => setHeader((h) => ({ ...h, bank_account_id: e.target.value }))} style={inputStyle}>
                  <option value="">بدون سند بانکی</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} — موجودی فعلی: {rial(b.current_balance)}</option>
                  ))}
                </select>
                {bankAccounts.length === 0 && (
                  <span style={{ color: "var(--brick)", fontSize: 11.5 }}>هنوز حسابی در تنظیمات تعریف نشده — بخش «تنظیمات اولیه» را ببینید.</span>
                )}
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
                  تخفیف (ریال)
                  <RialInput value={header.discount_amount} onChange={(v) => setHeader(h => ({ ...h, discount_amount: v }))} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
                  مالیات بر ارزش افزوده (%)
                  <input type="number" min="0" max="100" step="0.01" value={header.tax_rate} onChange={(e) => setHeader(h => ({ ...h, tax_rate: e.target.value }))} style={inputStyle} />
                </label>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>اقلام فاکتور</span>
                  <button type="button" onClick={addRow} style={{ border: "1px solid var(--border)", background: "transparent", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "var(--teal)" }}>
                    + افزودن ردیف
                  </button>
                </div>
                {items.map((row) => (
                  <ItemRow
                    key={row._key}
                    row={row}
                    invoiceType={header.type}
                    formatPreferredCurrency={formatPreferredCurrency}
                    onChange={(patch) => updateRow(row._key, patch)}
                    onRemove={() => removeRow(row._key)}
                    onRequestQuickAdd={(query) => setQuickAddFor({ rowKey: row._key, prefillName: query })}
                  />
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "grid", gap: 6, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>مبلغ ناخالص</span><span>{rial(subtotal)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>تخفیف</span><span>{rial(discount)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>مالیات</span><span>{rial(tax)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 17 }}><span>مبلغ نهایی</span><span>{rial(total)}</span></div>
              </div>

              {formError && <div style={{ color: "var(--brick)", fontSize: 12.5 }}>{formError}</div>}

              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "ثبت فاکتور"}
                </button>
                <button type="button" onClick={() => setFormOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 0", fontSize: 13.5, cursor: "pointer" }}>
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {quickAddFor && (
        <QuickAddItemModal
          prefillName={quickAddFor.prefillName}
          onClose={() => setQuickAddFor(null)}
          onCreated={(created) => handleItemCreated(quickAddFor.rowKey, created)}
        />
      )}
    </div>
  );
}
