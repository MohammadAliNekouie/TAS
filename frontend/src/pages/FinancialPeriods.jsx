import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { financialPeriodsApi } from "../lib/api.js";

const input = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13,
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--ink)",
  width: "100%",
  boxSizing: "border-box",
};

function apiMessage(error) {
  if (!error) return "خطای نامشخصی رخ داد.";
  return error instanceof Error ? error.message : String(error);
}

export default function FinancialPeriods() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closingId, setClosingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await financialPeriodsApi.list();
      setRows(Array.isArray(result) ? result : []);
      if (!Array.isArray(result)) {
        setError("پاسخ نامعتبر از سرور دریافت شد. لطفاً سرویس backend را بررسی کنید.");
      }
    } catch (err) {
      setRows([]);
      setError(apiMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await financialPeriodsApi.create(form);
      setForm({ name: "", start_date: "", end_date: "" });
      await load();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function close(id) {
    if (!window.confirm("دوره بسته شود؟ بعد از بستن، ثبت مالی در آن بازه ممنوع خواهد شد.")) return;
    setError("");
    setClosingId(id);
    try {
      await financialPeriodsApi.close(id);
      await load();
    } catch (err) {
      setError(apiMessage(err));
    } finally {
      setClosingId(null);
    }
  }

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>دوره‌های مالی</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "8px 0 0" }}>
            دوره را تعریف کنید و پس از کنترل گزارش‌ها، سند اختتامیه را ایجاد و دوره را ببندید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", borderRadius: 8, padding: "8px 13px", cursor: "pointer" }}
        >
          بازگشت
        </button>
      </div>

      {error && (
        <div style={{ margin: "14px 0", padding: "11px 13px", borderRadius: 9, border: "1px solid var(--brick)", background: "color-mix(in srgb, var(--brick) 8%, var(--surface))", color: "var(--brick)", fontSize: 12 }}>
          {error}
          <button type="button" onClick={load} style={{ marginRight: 12, border: "1px solid currentColor", background: "transparent", color: "inherit", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>تلاش مجدد</button>
        </div>
      )}

      <form onSubmit={create} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 18, display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 18 }}>
        <label style={{ fontSize: 12 }}>نام<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} /></label>
        <label style={{ fontSize: 12 }}>از تاریخ<input required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} style={input} placeholder="1405-01-01" /></label>
        <label style={{ fontSize: 12 }}>تا تاریخ<input required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} style={input} placeholder="1405-12-29" /></label>
        <button disabled={saving} style={{ background: "var(--accent-solid)", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 700, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.65 : 1 }}>{saving ? "در حال ثبت…" : "ایجاد"}</button>
      </form>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "var(--bg)", textAlign: "right" }}><th style={{ padding: 12 }}>نام</th><th>شروع</th><th>پایان</th><th>وضعیت</th><th /></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--ink-soft)" }}>در حال دریافت دوره‌های مالی…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--ink-soft)" }}>هنوز دوره مالی ثبت نشده است.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: 12 }}>{r.name}</td><td>{r.start_date}</td><td>{r.end_date}</td><td>{r.status === "open" ? "باز" : "بسته"}</td>
                <td style={{ padding: 12 }}>{r.status === "open" && <button disabled={closingId === r.id} onClick={() => close(r.id)} style={{ border: "1px solid var(--border)", background: "transparent", borderRadius: 7, padding: "6px 10px", cursor: "pointer", opacity: closingId === r.id ? 0.6 : 1 }}>{closingId === r.id ? "در حال صدور…" : "صدور سند اختتامیه و بستن"}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
