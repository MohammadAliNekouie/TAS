import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { stockAdjustmentsApi } from "../lib/api.js";
import { toFa } from "../lib/persian.js";
import SimpleItemPicker from "../components/SimpleItemPicker.jsx";
import JalaliDatePicker from "../components/JalaliDatePicker.jsx";

const inputStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--ink)",
};

const emptyLine = () => ({ _key: Math.random().toString(36).slice(2), item: null, quantity: "" });

function AdjustmentForm({ editing, onClose, onSaved }) {
  const [adjustmentDate, setAdjustmentDate] = useState(editing?.adjustment_date || "");
  const [direction, setDirection] = useState(editing?.direction || "out");
  const [description, setDescription] = useState(editing?.description || "");
  const [isConsignment, setIsConsignment] = useState(!!editing?.is_consignment);
  const [items, setItems] = useState(
    editing?.items?.length
      ? editing.items.map((it) => ({ _key: Math.random().toString(36).slice(2), item: { id: it.item_id, name: it.item_name, unit: it.item_unit }, quantity: it.quantity }))
      : [emptyLine()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function updateLine(key, patch) {
    setItems((rows) => rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  async function submit(e) {
    e.preventDefault();
    const validItems = items.filter((it) => it.item && Number(it.quantity) > 0);
    if (!description.trim()) return setError("شرح سند الزامی است.");
    if (validItems.length === 0) return setError("حداقل یک ردیف کالا با تعداد معتبر لازم است.");

    setSaving(true);
    setError(null);
    try {
      const payload = {
        adjustment_date: adjustmentDate, direction, description, is_consignment: isConsignment,
        items: validItems.map((it) => ({ item_id: it.item.id, quantity: it.quantity })),
      };
      if (editing) await stockAdjustmentsApi.update(editing.id, payload);
      else await stockAdjustmentsApi.create(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 24, width: 620, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editing ? "ویرایش سند کالا در گردش" : "سند کالا در گردش جدید"}</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={18} color="var(--ink-soft)" />
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              نوع سند
              <select value={direction} onChange={(e) => setDirection(e.target.value)} style={inputStyle}>
                <option value="out">خروج از انبار</option>
                <option value="in">ورود به انبار</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              تاریخ
              <JalaliDatePicker value={adjustmentDate} onChange={setAdjustmentDate} />
            </label>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
            شرح سند (الزامی — این سند برای فرایندی بدون فرمول مشخص است، توضیح کامل بدهید)
            <textarea required rows={2} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-soft)", cursor: "pointer" }}>
            <input type="checkbox" checked={isConsignment} onChange={(e) => setIsConsignment(e.target.checked)} style={{ cursor: "pointer" }} />
            کالای امانی (خروج/ورود بدون تسویه مالی)
          </label>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>اقلام</span>
              <button type="button" onClick={() => setItems((r) => [...r, emptyLine()])} style={{ border: "1px solid var(--border)", background: "transparent", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "var(--teal)" }}>
                + افزودن ردیف
              </button>
            </div>
            {items.map((it) => (
              <div key={it._key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 2 }}><SimpleItemPicker value={it.item} onChange={(item) => updateLine(it._key, { item })} /></div>
                <input type="number" placeholder="تعداد" value={it.quantity} onChange={(e) => updateLine(it._key, { quantity: e.target.valueAsNumber || "" })} style={{ ...inputStyle, width: 100 }} />
                <button type="button" onClick={() => setItems((r) => (r.length > 1 ? r.filter((x) => x._key !== it._key) : r))} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 8 }}>
                  <X size={15} color="var(--brick)" />
                </button>
              </div>
            ))}
          </div>

          {error && <div style={{ color: "var(--brick)", fontSize: 12.5 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              {saving ? "در حال ذخیره..." : editing ? "ذخیره تغییرات" : "ثبت سند"}
            </button>
            <button type="button" onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 0", fontSize: 13.5, cursor: "pointer" }}>
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StockAdjustments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [rowError, setRowError] = useState(null);

  function load() {
    setLoading(true);
    stockAdjustmentsApi.list().then(setRows).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function openEdit(row) {
    const full = await stockAdjustmentsApi.get(row.id);
    setEditing(full);
    setFormOpen(true);
  }

  async function doDelete(id) {
    setRowError(null);
    try {
      await stockAdjustmentsApi.remove(id);
      setConfirmDeleteId(null);
      load();
    } catch (err) {
      setRowError(err.message);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>کالا در گردش</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0", maxWidth: 560 }}>
            برای خروج/ورود کالا در فرایندهایی که فرمول تولید مشخصی ندارند یا یکباره انجام نمی‌شوند، یا برای خروج کالای امانی.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setFormOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          <Plus size={16} /> سند جدید
        </button>
      </div>

      {rowError && <div style={{ color: "var(--brick)", fontSize: 12.5, marginBottom: 12 }}>{rowError}</div>}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>هنوز سندی ثبت نشده است.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--ink-soft)", textAlign: "right", background: "var(--bg)" }}>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>تاریخ</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>نوع</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>شرح</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>تعداد اقلام</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>امانی</th>
                <th style={{ width: 96 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>{row.adjustment_date}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11.5, background: row.direction === "in" ? "var(--teal-soft)" : "var(--brick-soft)", color: row.direction === "in" ? "var(--teal-dark)" : "var(--brick)" }}>
                      {row.direction === "in" ? "ورود" : "خروج"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--ink-soft)", maxWidth: 300 }}>{row.description}</td>
                  <td style={{ padding: "12px 16px" }}>{toFa(row.item_count)}</td>
                  <td style={{ padding: "12px 16px" }}>{row.is_consignment ? "بله" : "—"}</td>
                  <td style={{ padding: "8px 16px" }}>
                    {confirmDeleteId === row.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <AdjustmentForm
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
        />
      )}
    </div>
  );
}
