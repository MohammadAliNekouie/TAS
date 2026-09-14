import React, { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { productionFormulasApi, productionRunsApi } from "../lib/api.js";
import { toFa, rial } from "../lib/persian.js";
import RialInput from "../components/RialInput.jsx";
import JalaliDatePicker from "../components/JalaliDatePicker.jsx";

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

function RunForm({ onClose, onSaved }) {
  const [formulas, setFormulas] = useState([]);
  const [formulaId, setFormulaId] = useState("");
  const [formula, setFormula] = useState(null); // full detail once selected
  const [runDate, setRunDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [componentPrices, setComponentPrices] = useState({}); // item_id -> price
  const [serviceCosts, setServiceCosts] = useState({}); // service name -> cost
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { productionFormulasApi.list().then(setFormulas); }, []);

  useEffect(() => {
    if (!formulaId) {
      setFormula(null);
      return;
    }
    productionFormulasApi.get(formulaId).then((f) => {
      setFormula(f);
      const prices = {};
      f.components.forEach((c) => { prices[c.item_id] = ""; }); // user fills in today's price
      setComponentPrices(prices);
      const costs = {};
      f.services.forEach((s) => { costs[s.name] = ""; });
      setServiceCosts(costs);
    });
  }, [formulaId]);

  const qty = Number(quantity) || 0;
  const componentRows = formula
    ? formula.components.map((c) => ({
        ...c,
        neededQty: c.quantity * qty,
        price: Number(componentPrices[c.item_id]) || 0,
      }))
    : [];
  const componentsTotal = componentRows.reduce((s, c) => s + c.neededQty * c.price, 0);
  const servicesTotal = formula ? formula.services.reduce((s, sv) => s + (Number(serviceCosts[sv.name]) || 0), 0) : 0;
  const totalCost = componentsTotal + servicesTotal;
  const unitCost = qty > 0 ? totalCost / qty : 0;

  const insufficientItems = componentRows.filter((c) => c.neededQty > 0 && c.neededQty > (c.item_qty_on_hand ?? Infinity));

  async function submit(e) {
    e.preventDefault();
    if (!formulaId || !runDate || qty <= 0) return setError("انتخاب فرمول، تاریخ و تعداد الزامی است.");
    setSaving(true);
    setError(null);
    try {
      await productionRunsApi.create({
        formula_id: formulaId,
        run_date: runDate,
        quantity: qty,
        component_prices: componentPrices,
        service_costs: Object.entries(serviceCosts).map(([name, cost]) => ({ name, cost: Number(cost) || 0 })),
        description,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 24, width: 680, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>فرایند تولید جدید</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={18} color="var(--ink-soft)" />
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              فرمول تولید
              <select required value={formulaId} onChange={(e) => setFormulaId(e.target.value)} style={inputStyle}>
                <option value="" disabled>انتخاب کنید</option>
                {formulas.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.output_item_name})</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              تاریخ
              <JalaliDatePicker value={runDate} onChange={setRunDate} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              تعداد تولید
              <input required type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle} />
            </label>
          </div>

          {formula && (
            <>
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>قطعات لازم — قیمت امروز هر قطعه را وارد کنید</span>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                  {componentRows.map((c) => (
                    <div key={c.item_id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 2, fontSize: 12.5 }}>{c.item_name} <span style={{ color: "var(--ink-soft)", fontSize: 11 }}>({toFa(c.neededQty)} {c.item_unit} لازم)</span></div>
                      <div style={{ flex: 1 }}>
                        <RialInput placeholder="قیمت واحد" value={componentPrices[c.item_id]} onChange={(v) => setComponentPrices((p) => ({ ...p, [c.item_id]: v }))} />
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: "var(--ink-soft)" }}>{rial(c.neededQty * c.price)}</div>
                    </div>
                  ))}
                </div>
                {insufficientItems.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--brick)" }}>
                    موجودی ناکافی برای: {insufficientItems.map((c) => c.item_name).join("، ")}
                  </div>
                )}
              </div>

              {formula.services.length > 0 && (
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>خدمات — هزینه امروز هر خدمت را وارد کنید</span>
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    {formula.services.map((s) => (
                      <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 2, fontSize: 12.5 }}>{s.name}</div>
                        <div style={{ flex: 1 }}>
                          <RialInput placeholder="هزینه" value={serviceCosts[s.name]} onChange={(v) => setServiceCosts((p) => ({ ...p, [s.name]: v }))} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 10, background: "var(--teal-soft)" }}>
                <span style={{ fontSize: 12.5, color: "var(--teal-dark)" }}>بهای تمام‌شده کل / هر واحد</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--teal-dark)" }}>{rial(totalCost)} / {rial(unitCost)}</span>
              </div>
            </>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
            توضیحات (اختیاری)
            <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
          </label>

          {error && <div style={{ color: "var(--brick)", fontSize: 12.5 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={saving || insufficientItems.length > 0} style={{ flex: 1, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              {saving ? "در حال ثبت..." : "اجرای تولید"}
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

export default function ProductionRuns() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  function load() {
    setLoading(true);
    productionRunsApi.list().then(setRuns).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function doDelete(id) {
    await productionRunsApi.remove(id);
    setConfirmDeleteId(null);
    load();
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>فرایند تولید</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0", maxWidth: 560 }}>
            با انتخاب فرمول و تعداد، موجودی قطعات بررسی می‌شود؛ در صورت کفایت، قطعات از انبار کسر و محصول با بهای تمام‌شده واقعی به انبار اضافه می‌شود.
          </p>
        </div>
        <button onClick={() => setFormOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          <Plus size={16} /> فرایند جدید
        </button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>
        ) : runs.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>هنوز فرایند تولیدی ثبت نشده است.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--ink-soft)", textAlign: "right", background: "var(--bg)" }}>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>تاریخ</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>فرمول</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>محصول</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>تعداد</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>بهای واحد</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>بهای کل</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>{r.run_date}</td>
                  <td style={{ padding: "12px 16px" }}>{r.formula_name}</td>
                  <td style={{ padding: "12px 16px", color: "var(--ink-soft)" }}>{r.output_item_name || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>{toFa(r.quantity)}</td>
                  <td style={{ padding: "12px 16px" }}>{rial(r.unit_cost)}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700 }}>{rial(r.total_cost)}</td>
                  <td style={{ padding: "8px 16px" }}>
                    {confirmDeleteId === r.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                        <button onClick={() => doDelete(r.id)} style={{ border: "none", background: "transparent", color: "var(--brick)", cursor: "pointer", fontWeight: 700 }}>بله</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700 }}>خیر</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(r.id)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 6, cursor: "pointer" }}>
                        <Trash2 size={14} color="var(--brick)" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && <RunForm onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load(); }} />}
    </div>
  );
}
