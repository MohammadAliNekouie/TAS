import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { productionFormulasApi } from "../lib/api.js";
import { toFa } from "../lib/persian.js";
import SimpleItemPicker from "../components/SimpleItemPicker.jsx";

const inputStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--ink)",
};

const emptyComponent = () => ({ _key: Math.random().toString(36).slice(2), item: null, quantity: "", description: "" });
const emptyService = () => ({ _key: Math.random().toString(36).slice(2), name: "", description: "" });

function FormulaForm({ editing, onClose, onSaved }) {
  const [name, setName] = useState(editing?.name || "");
  const [outputItem, setOutputItem] = useState(editing ? { id: editing.output_item_id, name: editing.output_item_name, unit: editing.output_item_unit } : null);
  const [description, setDescription] = useState(editing?.description || "");
  const [components, setComponents] = useState(
    editing?.components?.length
      ? editing.components.map((c) => ({ _key: Math.random().toString(36).slice(2), item: { id: c.item_id, name: c.item_name, unit: c.item_unit }, quantity: c.quantity, description: c.description || "" }))
      : [emptyComponent()]
  );
  const [services, setServices] = useState(editing?.services?.length ? editing.services.map((s) => ({ _key: Math.random().toString(36).slice(2), name: s.name, description: s.description || "" })) : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function updateComponent(key, patch) {
    setComponents((rows) => rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }
  function updateService(key, patch) {
    setServices((rows) => rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  async function submit(e) {
    e.preventDefault();
    const validComponents = components.filter((c) => c.item && Number(c.quantity) > 0);
    if (!outputItem) return setError("انتخاب کالای خروجی الزامی است.");
    if (validComponents.length === 0) return setError("حداقل یک قطعه با تعداد معتبر لازم است.");

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name, output_item_id: outputItem.id, description,
        components: validComponents.map((c) => ({ item_id: c.item.id, quantity: c.quantity, description: c.description })),
        services: services.filter((s) => s.name.trim()).map((s) => ({ name: s.name, description: s.description })),
      };
      if (editing) await productionFormulasApi.update(editing.id, payload);
      else await productionFormulasApi.create(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 24, width: 640, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editing ? "ویرایش فرمول تولید" : "فرمول تولید جدید"}</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={18} color="var(--ink-soft)" />
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              نام فرمول (مثال: هواپیما مدل ۳۲)
              <input required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              کالای خروجی (محصول نهایی)
              <SimpleItemPicker value={outputItem} onChange={setOutputItem} />
            </label>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>قطعات لازم (به ازای هر یک واحد خروجی)</span>
              <button type="button" onClick={() => setComponents((r) => [...r, emptyComponent()])} style={{ border: "1px solid var(--border)", background: "transparent", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "var(--teal)" }}>
                + افزودن قطعه
              </button>
            </div>
            {components.map((c) => (
              <div key={c._key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 2 }}><SimpleItemPicker value={c.item} onChange={(item) => updateComponent(c._key, { item })} /></div>
                <input type="number" placeholder="تعداد" value={c.quantity} onChange={(e) => updateComponent(c._key, { quantity: e.target.valueAsNumber || "" })} style={{ ...inputStyle, width: 90 }} />
                <input placeholder="توضیح (اختیاری)" value={c.description} onChange={(e) => updateComponent(c._key, { description: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={() => setComponents((r) => (r.length > 1 ? r.filter((x) => x._key !== c._key) : r))} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 8 }}>
                  <X size={15} color="var(--brick)" />
                </button>
              </div>
            ))}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>خدمات (مونتاژ، برش‌کاری و ...) — بدون قیمت، فقط تعریف نام</span>
              <button type="button" onClick={() => setServices((r) => [...r, emptyService()])} style={{ border: "1px solid var(--border)", background: "transparent", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "var(--teal)" }}>
                + افزودن خدمت
              </button>
            </div>
            {services.length === 0 && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>خدمتی افزوده نشده — اختیاری است.</div>}
            {services.map((s) => (
              <div key={s._key} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input placeholder="نام خدمت (مثال: مونتاژ)" value={s.name} onChange={(e) => updateService(s._key, { name: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                <input placeholder="توضیح (اختیاری)" value={s.description} onChange={(e) => updateService(s._key, { description: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={() => setServices((r) => r.filter((x) => x._key !== s._key))} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 8 }}>
                  <X size={15} color="var(--brick)" />
                </button>
              </div>
            ))}
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
            توضیحات فرمول
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
          </label>

          {error && <div style={{ color: "var(--brick)", fontSize: 12.5 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              {saving ? "در حال ذخیره..." : editing ? "ذخیره تغییرات" : "ثبت فرمول"}
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

export default function ProductionFormulas() {
  const [formulas, setFormulas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [rowError, setRowError] = useState(null);

  function load() {
    setLoading(true);
    productionFormulasApi.list().then(setFormulas).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function openEdit(row) {
    const full = await productionFormulasApi.get(row.id);
    setEditing(full);
    setFormOpen(true);
  }

  async function doDelete(id) {
    setRowError(null);
    try {
      await productionFormulasApi.remove(id);
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
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>فرمول تولید</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0", maxWidth: 560 }}>
            برای هر محصول، قطعات لازم و خدمات جانبی را تعریف کنید. قیمت قطعات و هزینه خدمات اینجا ثبت نمی‌شود — آن‌ها در «فرایند تولید» و در لحظه اجرا وارد می‌شوند.
          </p>
        </div>
        <button onClick={() => { setEditing(null); setFormOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          <Plus size={16} /> فرمول جدید
        </button>
      </div>

      {rowError && <div style={{ color: "var(--brick)", fontSize: 12.5, marginBottom: 12 }}>{rowError}</div>}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>
        ) : formulas.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>هنوز فرمولی تعریف نشده است.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--ink-soft)", textAlign: "right", background: "var(--bg)" }}>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>نام فرمول</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>کالای خروجی</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>تعداد قطعات</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>تعداد خدمات</th>
                <th style={{ width: 96 }} />
              </tr>
            </thead>
            <tbody>
              {formulas.map((f) => (
                <tr key={f.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 700 }}>{f.name}</td>
                  <td style={{ padding: "12px 16px" }}>{f.output_item_name}</td>
                  <td style={{ padding: "12px 16px" }}>{toFa(f.component_count)}</td>
                  <td style={{ padding: "12px 16px" }}>{toFa(f.service_count)}</td>
                  <td style={{ padding: "8px 16px" }}>
                    {confirmDeleteId === f.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                        <span style={{ color: "var(--brick)" }}>حذف شود؟</span>
                        <button onClick={() => doDelete(f.id)} style={{ border: "none", background: "transparent", color: "var(--brick)", cursor: "pointer", fontWeight: 700 }}>بله</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700 }}>خیر</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(f)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 6, cursor: "pointer" }}>
                          <Pencil size={14} color="var(--ink-soft)" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(f.id)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 6, cursor: "pointer" }}>
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
        <FormulaForm
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
        />
      )}
    </div>
  );
}
