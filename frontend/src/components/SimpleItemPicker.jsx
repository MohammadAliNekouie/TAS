import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../lib/api.js";
import { toFa } from "../lib/persian.js";

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

/** value: { id, name, unit, code } | null */
export default function SimpleItemPicker({ value, onChange, placeholder }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.inventorySearch(query).then((r) => {
        setResults(r);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function select(item) {
    onChange({ id: item.id, name: item.name, unit: item.unit, code: item.code });
    setOpen(false);
    setQuery("");
  }

  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...inputStyle }}>
        <span>{value.name} <span style={{ color: "var(--ink-soft)", fontSize: 11 }}>({value.unit})</span></span>
        <button type="button" onClick={() => onChange(null)} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", fontSize: 11, cursor: "pointer" }}>
          تغییر
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, ...inputStyle }}>
        <Search size={13} color="var(--ink-soft)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder={placeholder || "جستجوی کالا با نام یا کد..."}
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
          {results.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-soft)" }}>کالایی یافت نشد</div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item)}
                style={{ display: "block", width: "100%", textAlign: "right", padding: "9px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit", color: "var(--ink)", borderBottom: "1px solid var(--border)" }}
              >
                {item.name} <span style={{ color: "var(--ink-soft)", fontSize: 11 }}>· کد {item.code} · موجودی {toFa(item.qty_on_hand)} {item.unit}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
