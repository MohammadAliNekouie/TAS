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

/**
 * value: the selected account object ({ id, code, name }) or null.
 * onChange: called with the full account object on selection, or null when cleared.
 */
export default function AccountPicker({ value, onChange, placeholder }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.chartOfAccounts.search(query).then((r) => {
        setResults(r);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function select(account) {
    onChange(account);
    setOpen(false);
    setQuery("");
  }

  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...inputStyle }}>
        <span style={{ fontSize: 12.5 }}>
          <span style={{ color: "var(--ink-soft)" }}>{value.code}</span> — {value.name}
        </span>
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
          placeholder={placeholder || "جستجوی حساب با کد یا نام..."}
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
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink-soft)" }}>حسابی یافت نشد</div>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => select(a)}
                style={{ display: "block", width: "100%", textAlign: "right", padding: "9px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12.5, fontFamily: "inherit", color: "var(--ink)", borderBottom: "1px solid var(--border)" }}
              >
                <span style={{ color: "var(--ink-soft)" }}>{a.code}</span> — {a.name}
                {a.breadcrumb?.length > 0 && (
                  <div style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>{a.breadcrumb.join(" › ")}</div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
