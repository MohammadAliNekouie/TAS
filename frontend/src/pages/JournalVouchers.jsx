import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, AlertTriangle } from "lucide-react";
import { api } from "../lib/api.js";
import { toFa, rial } from "../lib/persian.js";
import JalaliDatePicker from "../components/JalaliDatePicker.jsx";
import RialInput from "../components/RialInput.jsx";
import AccountPicker from "../components/AccountPicker.jsx";

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

const emptyLine = () => ({
  _key: Math.random().toString(36).slice(2), account: null, debit: "", credit: "", description: "",
});

function VoucherForm({ editingVoucher, onClose, onSaved }) {
  const [voucherDate, setVoucherDate] = useState(editingVoucher?.voucher_date || "");
  const [description, setDescription] = useState(editingVoucher?.description || "");
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(!!editingVoucher);

  useEffect(() => {
    if (!editingVoucher) return;
    api.journalVouchers.get(editingVoucher.id).then((full) => {
      setLines(
        full.lines.map((l) => ({
          _key: Math.random().toString(36).slice(2),
          account: { id: l.account_id, code: l.account_code, name: l.account_name },
          debit: l.debit || "",
          credit: l.credit || "",
          description: l.description || "",
        }))
      );
      setLoadingDetail(false);
    });
  }, [editingVoucher]);

  function updateLine(key, patch) {
    setLines((rows) => rows.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }
  function removeLine(key) {
    setLines((rows) => (rows.length > 2 ? rows.filter((r) => r._key !== key) : rows));
  }
  function addLine() {
    setLines((rows) => [...rows, emptyLine()]);
  }

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.5;

  async function submit(e) {
    e.preventDefault();
    const validLines = lines.filter((l) => l.account && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) {
      setError("سند باید حداقل دو ردیف کامل (حساب + مبلغ) داشته باشد.");
      return;
    }
    if (!balanced) {
      setError("جمع بدهکار و بستانکار باید برابر باشند.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        voucher_date: voucherDate,
        description,
        lines: validLines.map((l) => ({
          account_id: l.account.id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description,
        })),
      };
      if (editingVoucher) await api.journalVouchers.update(editingVoucher.id, payload);
      else await api.journalVouchers.create(payload);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 24, width: 720, maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{editingVoucher ? "ویرایش سند حسابداری" : "سند حسابداری جدید"}</h2>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={18} color="var(--ink-soft)" />
          </button>
        </div>

        {loadingDetail ? (
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>در حال بارگذاری...</div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
                تاریخ سند
                <JalaliDatePicker value={voucherDate} onChange={setVoucherDate} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
                شرح سند
                <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
              </label>
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-soft)" }}>ردیف‌های سند</span>
                <button type="button" onClick={addLine} style={{ border: "1px solid var(--border)", background: "transparent", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", color: "var(--teal)" }}>
                  + افزودن ردیف
                </button>
              </div>

              {lines.map((line) => (
                <div key={line._key} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ flex: 2 }}>
                    <AccountPicker value={line.account} onChange={(a) => updateLine(line._key, { account: a })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <RialInput
                      placeholder="بدهکار"
                      value={line.debit}
                      onChange={(v) => updateLine(line._key, { debit: v, credit: v ? "" : line.credit })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <RialInput
                      placeholder="بستانکار"
                      value={line.credit}
                      onChange={(v) => updateLine(line._key, { credit: v, debit: v ? "" : line.debit })}
                    />
                  </div>
                  <button type="button" onClick={() => removeLine(line._key)} style={{ border: "none", background: "transparent", cursor: "pointer", padding: 8 }}>
                    <X size={15} color="var(--brick)" />
                  </button>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px",
                borderRadius: 10, background: balanced ? "var(--teal-soft)" : "var(--brick-soft)",
              }}
            >
              <div style={{ display: "flex", gap: 18, fontSize: 12.5 }}>
                <span>جمع بدهکار: <strong>{rial(totalDebit)}</strong></span>
                <span>جمع بستانکار: <strong>{rial(totalCredit)}</strong></span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: balanced ? "var(--teal-dark)" : "var(--brick)" }}>
                {balanced ? <Check size={15} /> : <AlertTriangle size={15} />}
                {balanced ? "سند تراز است" : "سند تراز نیست"}
              </div>
            </div>

            {error && <div style={{ color: "var(--brick)", fontSize: 12.5 }}>{error}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                disabled={saving || !balanced}
                style={{
                  flex: 1, background: balanced ? "var(--accent-solid)" : "var(--border)", color: "#fff", border: "none",
                  borderRadius: 9, padding: "11px 0", fontSize: 13.5, fontWeight: 700, cursor: balanced ? "pointer" : "not-allowed",
                }}
              >
                {saving ? "در حال ذخیره..." : editingVoucher ? "ذخیره تغییرات" : "ثبت سند"}
              </button>
              <button type="button" onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", borderRadius: 9, padding: "11px 0", fontSize: 13.5, cursor: "pointer" }}>
                انصراف
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function JournalVouchers() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  function load() {
    setLoading(true);
    api.journalVouchers.list().then(setVouchers).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function doDelete(id) {
    await api.journalVouchers.remove(id);
    setConfirmDeleteId(null);
    load();
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>اسناد حسابداری</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0", maxWidth: 560 }}>
            ثبت دستی سند بر اساس کدینگ حسابداری — هر سند باید حداقل دو ردیف داشته باشد و جمع بدهکار و بستانکار برابر باشد.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          <Plus size={16} /> سند جدید
        </button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>
        ) : vouchers.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>هنوز سندی ثبت نشده است.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--ink-soft)", textAlign: "right", background: "var(--bg)" }}>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>تاریخ</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>شرح</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>تعداد ردیف</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>مبلغ سند</th>
                <th style={{ width: 96 }} />
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>{v.voucher_date}</td>
                  <td style={{ padding: "12px 16px", color: "var(--ink-soft)" }}>{v.description || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>{toFa(v.line_count)}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700 }}>{rial(v.total_amount)}</td>
                  <td style={{ padding: "8px 16px" }}>
                    {confirmDeleteId === v.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                        <span style={{ color: "var(--brick)" }}>حذف شود؟</span>
                        <button onClick={() => doDelete(v.id)} style={{ border: "none", background: "transparent", color: "var(--brick)", cursor: "pointer", fontWeight: 700 }}>بله</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700 }}>خیر</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => { setEditing(v); setFormOpen(true); }} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 6, cursor: "pointer" }}>
                          <Pencil size={14} color="var(--ink-soft)" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(v.id)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 6, cursor: "pointer" }}>
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
        <VoucherForm
          editingVoucher={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
        />
      )}
    </div>
  );
}
