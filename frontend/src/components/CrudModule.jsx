import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { crudApi, api } from "../lib/api.js";
import { toFa, rial } from "../lib/persian.js";
import PartyPicker from "./PartyPicker.jsx";
import RialInput from "./RialInput.jsx";
import JalaliDatePicker from "./JalaliDatePicker.jsx";

/**
 * columns: [{ key, label, format?: 'rial' | 'faNumber' | (value, row) => string }]
 * formFields: [{ name, label, type: 'text'|'number'|'date'|'select'|'textarea', options?: [{value,label}], required?: bool }]
 */
export default function CrudModule({ title, description, resource, columns, formFields, emptyValues }) {
  const client = crudApi(resource);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // row being edited, or null for "add new"
  const [values, setValues] = useState(emptyValues);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);

  function load() {
    setLoading(true);
    client
      .list()
      .then(setItems)
      .finally(() => setLoading(false));
  }

  useEffect(load, [resource]);
  useEffect(() => { if (formFields.some(f => f.type === "bank")) api.bankAccounts.list().then(setBankAccounts).catch(() => {}); }, []);

  function openAdd() {
    setEditing(null);
    setValues(emptyValues);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setValues({ ...emptyValues, ...row });
    setFormError(null);
    setFormOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await client.update(editing.id, values);
      } else {
        await client.create(values);
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id) {
    setDeleteError(null);
    try {
      await client.remove(id);
      setConfirmDeleteId(null);
      load();
    } catch (err) {
      setDeleteError(err.message);
      setConfirmDeleteId(null);
    }
  }

  function renderCell(col, row) {
    const raw = row[col.key];
    if (col.format === "rial") return rial(raw || 0);
    if (col.format === "faNumber") return toFa(raw ?? "");
    if (typeof col.format === "function") return col.format(raw, row);
    return raw ?? "—";
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{title}</h1>
          {description && <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0", maxWidth: 520 }}>{description}</p>}
        </div>
        <button
          onClick={openAdd}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9,
            padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
          }}
        >
          <Plus size={16} />
          افزودن جدید
        </button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {deleteError && (
          <div style={{ padding: "12px 16px", color: "var(--brick)", fontSize: 12.5, borderBottom: "1px solid var(--border)" }}>{deleteError}</div>
        )}
        {loading ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>هنوز موردی ثبت نشده است.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--ink-soft)", textAlign: "right", background: "var(--bg)" }}>
                {columns.map((c) => (
                  <th key={c.key} style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>{c.label}</th>
                ))}
                <th style={{ width: 96 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ padding: "12px 16px" }}>{renderCell(c, row)}</td>
                  ))}
                  <td style={{ padding: "8px 16px" }}>
                    {confirmDeleteId === row.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                        <span style={{ color: "var(--brick)" }}>حذف شود؟</span>
                        <button onClick={() => confirmDelete(row.id)} style={miniBtnStyle("var(--brick)")}>بله</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={miniBtnStyle("var(--ink-soft)")}>خیر</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(row)} title="ویرایش" style={iconBtnStyle}>
                          <Pencil size={14} color="var(--ink-soft)" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(row.id)} title="حذف" style={iconBtnStyle}>
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
        <div
          onClick={() => setFormOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "var(--overlay)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", borderRadius: 16, padding: 24, width: 440, maxHeight: "85vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editing ? "ویرایش رکورد" : "افزودن رکورد جدید"}</h2>
              <button onClick={() => setFormOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X size={18} color="var(--ink-soft)" />
              </button>
            </div>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {formFields.map((f) => (
                <label key={f.name} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
                  {f.label}
                  {f.type === "money" ? (
                    <RialInput
                      required={f.required}
                      value={values[f.name] ?? ""}
                      onChange={(v) => setValues((vv) => ({ ...vv, [f.name]: v }))}
                    />
                  ) : f.type === "date" ? (
                    <JalaliDatePicker
                      value={values[f.name] ?? ""}
                      onChange={(v) => setValues((vv) => ({ ...vv, [f.name]: v }))}
                    />
                  ) : f.type === "party" ? (
                    <PartyPicker
                      value={values[f.name] ?? ""}
                      onChange={(v) => setValues((vv) => ({ ...vv, [f.name]: v }))}
                    />
                  ) : f.type === "bank" ? (
                    <select required={f.required} value={values[f.name] ?? ""} onChange={(e) => setValues(v => ({ ...v, [f.name]: e.target.value || null }))} style={inputStyle}>
                      <option value="">انتخاب حساب بانکی</option>
                      {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name} — {rial(b.current_balance)}</option>)}
                    </select>
                  ) : f.type === "select" ? (
                    <select
                      required={f.required}
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      style={inputStyle}
                    >
                      <option value="" disabled={f.required}>{f.placeholder || "انتخاب کنید"}</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      rows={3}
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "password" ? "password" : "text"}
                      required={f.required}
                      placeholder={f.placeholder}
                      value={values[f.name] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.name]: f.type === "number" ? e.target.valueAsNumber || "" : e.target.value }))
                      }
                      style={inputStyle}
                    />
                  )}
                </label>
              ))}

              {formError && <div style={{ color: "var(--brick)", fontSize: 12.5 }}>{formError}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ flex: 1, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
                >
                  {saving ? "در حال ذخیره..." : editing ? "ذخیره تغییرات" : "افزودن"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 0", fontSize: 13.5, cursor: "pointer" }}
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13.5,
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--ink)",
  width: "100%",
  minWidth: 0,
};

const iconBtnStyle = {
  border: "1px solid var(--border)",
  background: "var(--surface)",
  borderRadius: 7,
  padding: 6,
  cursor: "pointer",
  display: "flex",
};

function miniBtnStyle(color) {
  return { border: "none", background: "transparent", color, cursor: "pointer", fontWeight: 700, padding: 0 };
}
