import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "../lib/api.js";

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

const typeLabel = { customer: "مشتری", supplier: "تامین‌کننده", both: "مشتری/تامین‌کننده" };

function QuickAddPartyModal({ prefillName, onClose, onCreated }) {
  const [values, setValues] = useState({ name: prefillName || "", type: "both", phone: "", economic_code: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api.parties.create(values);
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 22, width: 360 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>تعریف طرف حساب جدید</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={17} color="var(--ink-soft)" />
          </button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
            نام
            <input required value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} style={inputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
            نوع
            <select value={values.type} onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))} style={inputStyle}>
              <option value="customer">مشتری</option>
              <option value="supplier">تامین‌کننده</option>
              <option value="both">مشتری و تامین‌کننده</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
            تلفن (اختیاری)
            <input value={values.phone} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} style={inputStyle} />
          </label>
          <button type="submit" disabled={saving} style={{ marginTop: 6, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "در حال ذخیره..." : "افزودن و انتخاب"}
          </button>
          {error && <div style={{ color: "var(--brick)", fontSize: 12 }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}

/**
 * Text field bound to `value` (a plain party-name string, stored directly on
 * the invoice/receipt/etc.) that offers a dropdown of existing parties and a
 * "define new party" shortcut — so names get reused/edited from one place
 * (طرف‌های حساب) instead of being retyped freehand on every document.
 */
export default function PartyPicker({ value, onChange, placeholder }) {
  const [parties, setParties] = useState([]);
  const [open, setOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    api.parties.list().then(setParties);
  }, []);

  const query = value || "";
  const filtered = query.trim()
    ? parties.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : parties;

  function selectParty(p) {
    onChange(p.name);
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        required
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || "نام مشتری یا تامین‌کننده..."}
        style={inputStyle}
      />
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0, left: 0, zIndex: 20,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
            maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          }}
        >
          {filtered.slice(0, 8).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectParty(p)}
              style={{ display: "block", width: "100%", textAlign: "right", padding: "9px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit", color: "var(--ink)", borderBottom: "1px solid var(--border)" }}
            >
              {p.name} <span style={{ color: "var(--ink-soft)", fontSize: 11 }}>· {p.code} · ({typeLabel[p.type] || p.type})</span>
            </button>
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setQuickAddOpen(true);
              setOpen(false);
            }}
            style={{ display: "block", width: "100%", textAlign: "right", padding: "10px 12px", border: "none", background: "var(--teal-soft)", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit", color: "var(--teal-dark)", fontWeight: 700 }}
          >
            + تعریف طرف حساب جدید{query ? `: «${query}»` : ""}
          </button>
        </div>
      )}
      {quickAddOpen && (
        <QuickAddPartyModal
          prefillName={value}
          onClose={() => setQuickAddOpen(false)}
          onCreated={(created) => {
            setParties((ps) => [created, ...ps]);
            onChange(created.name);
            setQuickAddOpen(false);
          }}
        />
      )}
    </div>
  );
}
