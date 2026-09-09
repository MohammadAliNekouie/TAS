import React, { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, Folder, BookOpen, X, Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../lib/api.js";

const inputStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 13.5,
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--ink)",
};

function Breadcrumb({ path, onJump }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)", flexWrap: "wrap" }}>
      <button onClick={() => onJump(-1)} style={crumbBtnStyle}>گروه‌های اصلی</button>
      {path.map((node, i) => (
        <React.Fragment key={node.id}>
          <ChevronLeft size={13} />
          <button onClick={() => onJump(i)} style={crumbBtnStyle}>{node.name}</button>
        </React.Fragment>
      ))}
    </div>
  );
}
const crumbBtnStyle = { background: "transparent", border: "none", cursor: "pointer", color: "inherit", fontSize: 13, padding: 0 };

function NameModal({ title, initialName, onClose, onSubmit }) {
  const [name, setName] = useState(initialName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(name);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 22, width: 360 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={17} color="var(--ink-soft)" />
          </button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="نام" style={inputStyle} />
          {error && <div style={{ color: "var(--brick)", fontSize: 12 }}>{error}</div>}
          <button type="submit" disabled={saving} style={{ background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "در حال ذخیره..." : "ذخیره"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ChartOfAccounts() {
  const [path, setPath] = useState([]); // [] = root (level-1 groups)
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [nameModal, setNameModal] = useState(null); // { editing } | null
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [rowError, setRowError] = useState(null);

  const level = path.length; // 0 = viewing level-1 list, 1 = viewing level-2 list, 2 = viewing level-3 list
  const currentParentId = path.length ? path[path.length - 1].id : null;

  const loadChildren = useCallback((parentId) => {
    setLoading(true);
    api.chartOfAccounts.tree(parentId).then(setChildren).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadChildren(currentParentId); }, [currentParentId, loadChildren]);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const handle = setTimeout(() => { api.chartOfAccounts.search(query).then(setResults); }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function openNode(node) {
    if (node.level < 3) setPath((p) => [...p, node]);
  }
  function jumpTo(index) {
    setPath((p) => (index < 0 ? [] : p.slice(0, index + 1)));
  }

  async function handleDeleteNode(node) {
    setRowError(null);
    try {
      if (node.level === 2) await api.chartOfAccounts.removeGroup(node.id);
      else await api.chartOfAccounts.removeAccount(node.id);
      setConfirmDeleteId(null);
      loadChildren(currentParentId);
    } catch (err) {
      setRowError(err.message);
      setConfirmDeleteId(null);
    }
  }

  function refreshAndClose() {
    setNameModal(null);
    loadChildren(currentParentId);
  }

  const canAddHere = level === 1 || level === 2; // level 0 = level-1 groups, fixed/read-only
  const addLabel = level === 1 ? "افزودن گروه کل" : "افزودن حساب معین";

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>کدینگ حسابداری</h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0", maxWidth: 560 }}>
          گروه اصلی (سطح ۱) طبقه‌بندی ثابت صورت‌های مالی است و قابل تغییر نیست؛ گروه کل و حساب معین را می‌توانید آزادانه اضافه، ویرایش یا حذف کنید.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, maxWidth: 420 }}>
        <Search size={16} color="var(--ink-soft)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی حساب معین با شناسه، کد یا نام..."
          style={{ border: "none", outline: "none", flex: 1, fontSize: 13, fontFamily: "inherit", background: "transparent" }}
        />
        {query && (
          <button onClick={() => setQuery("")} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={15} color="var(--ink-soft)" />
          </button>
        )}
      </div>

      {rowError && <div style={{ color: "var(--brick)", fontSize: 12.5, marginBottom: 12 }}>{rowError}</div>}

      {results !== null ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 8 }}>
          {results.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>موردی یافت نشد</div>}
          {results.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
              <BookOpen size={16} color="var(--teal)" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{a.breadcrumb.join(" › ")} · کد {a.code}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <Breadcrumb path={path} onJump={jumpTo} />
            {canAddHere && (
              <button
                onClick={() => setNameModal({ editing: null })}
                style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "transparent", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "var(--teal)", cursor: "pointer" }}
              >
                <Plus size={14} /> {addLabel}
              </button>
            )}
          </div>

          {loading && <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>در حال بارگذاری...</div>}
          {!loading && children.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>موردی وجود ندارد</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {children.map((node) => (
              <div key={node.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 10px", borderRadius: 8 }}>
                <button
                  onClick={() => openNode(node)}
                  style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, textAlign: "right", border: "none", background: "transparent", cursor: node.level < 3 ? "pointer" : "default", fontFamily: "inherit", padding: 0 }}
                >
                  {node.level < 3 ? <Folder size={16} color="var(--gold)" /> : <BookOpen size={16} color="var(--teal)" />}
                  <span style={{ fontSize: 13.5 }}>{node.name}</span>
                  <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{node.code}</span>
                </button>

                {node.level === 1 ? (
                  <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>ثابت</span>
                ) : confirmDeleteId === node.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                    <span style={{ color: "var(--brick)" }}>حذف شود؟</span>
                    <button onClick={() => handleDeleteNode(node)} style={{ border: "none", background: "transparent", color: "var(--brick)", cursor: "pointer", fontWeight: 700 }}>بله</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700 }}>خیر</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setNameModal({ editing: node })} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 5, cursor: "pointer" }}>
                      <Pencil size={13} color="var(--ink-soft)" />
                    </button>
                    <button onClick={() => setConfirmDeleteId(node.id)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 5, cursor: "pointer" }}>
                      <Trash2 size={13} color="var(--brick)" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {nameModal && (
        <NameModal
          title={
            nameModal.editing
              ? (nameModal.editing.level === 2 ? "ویرایش گروه کل" : "ویرایش حساب معین")
              : (level === 1 ? "گروه کل جدید" : "حساب معین جدید")
          }
          initialName={nameModal.editing?.name}
          onClose={() => setNameModal(null)}
          onSubmit={async (name) => {
            const isGroupLevel = nameModal.editing ? nameModal.editing.level === 2 : level === 1;
            if (isGroupLevel) {
              if (nameModal.editing) await api.chartOfAccounts.updateGroup(nameModal.editing.id, { name });
              else await api.chartOfAccounts.createGroup({ parent_id: currentParentId, name });
            } else {
              if (nameModal.editing) await api.chartOfAccounts.updateAccount(nameModal.editing.id, { name });
              else await api.chartOfAccounts.createAccount({ parent_id: currentParentId, name });
            }
            refreshAndClose();
          }}
        />
      )}
    </div>
  );
}
