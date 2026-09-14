import React, { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, Folder, Package, X, Plus, Pencil, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { api } from "../lib/api.js";
import { toFa, rial } from "../lib/persian.js";
import { usePreferredCurrencyDisplay } from "../lib/currency.js";

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

function Breadcrumb({ path, onJump }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)", flexWrap: "wrap" }}>
      <button onClick={() => onJump(-1)} style={crumbBtnStyle}>همه گروه‌ها</button>
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

// ---------- Warehouses management ----------

function WarehousesPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.warehouses.list().then(setItems).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openAdd() { setEditing(null); setName(""); setError(null); setFormOpen(true); }
  function openEdit(w) { setEditing(w); setName(w.name); setError(null); setFormOpen(true); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) await api.warehouses.update(editing.id, { name });
      else await api.warehouses.create({ name });
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(id) {
    setError(null);
    try {
      await api.warehouses.remove(id);
      setConfirmDeleteId(null);
      load();
    } catch (err) {
      setError(err.message);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 18 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", border: "none", background: "transparent", cursor: "pointer" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700 }}>
          <WarehouseIcon size={16} color="var(--teal)" /> انبارها {loading ? "" : `(${toFa(items.length)})`}
        </span>
        <ChevronLeft size={15} style={{ transform: open ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform .15s" }} />
      </button>
      {open && (
        <div style={{ padding: "0 18px 18px" }}>
          {error && <div style={{ color: "var(--brick)", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {items.map((w) => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, background: "var(--bg)" }}>
                <span style={{ fontSize: 13 }}>{w.name}</span>
                {confirmDeleteId === w.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                    <span style={{ color: "var(--brick)" }}>حذف شود؟</span>
                    <button onClick={() => doDelete(w.id)} style={{ border: "none", background: "transparent", color: "var(--brick)", cursor: "pointer", fontWeight: 700 }}>بله</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700 }}>خیر</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openEdit(w)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 5, cursor: "pointer" }}>
                      <Pencil size={13} color="var(--ink-soft)" />
                    </button>
                    <button onClick={() => setConfirmDeleteId(w.id)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 5, cursor: "pointer" }}>
                      <Trash2 size={13} color="var(--brick)" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button onClick={openAdd} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "transparent", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, color: "var(--teal)", cursor: "pointer" }}>
            <Plus size={14} /> افزودن انبار جدید
          </button>
        </div>
      )}
      {formOpen && (
        <div onClick={() => setFormOpen(false)} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 22, width: 340 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{editing ? "ویرایش انبار" : "انبار جدید"}</h3>
              <button onClick={() => setFormOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X size={17} color="var(--ink-soft)" />
              </button>
            </div>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="نام انبار" style={inputStyle} />
              <button type="submit" disabled={saving} style={{ background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                {saving ? "در حال ذخیره..." : "ذخیره"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- generic small name-only modal (group / subcategory) ----------

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
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 22, width: 340 }}>
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

// ---------- item add/edit modal ----------

function ItemModal({ item, parentId, onClose, onSaved }) {
  const [warehouses, setWarehouses] = useState([]);
  const [values, setValues] = useState({
    name: item?.name || "", unit: item?.unit || "", warehouse_id: item?.warehouse_id || "",
    min_qty: item?.min_qty ?? 0, qty_on_hand: item?.qty_on_hand ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.warehouses.list().then((rows) => {
      setWarehouses(rows);
      if (!item && rows.length) setValues((v) => ({ ...v, warehouse_id: rows[0].id }));
    });
  }, [item]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (item) await api.inventoryUpdateItem(item.id, values);
      else await api.inventoryCreateItem({ ...values, parent_id: parentId });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 22, width: 380 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{item ? "ویرایش کالا" : "کالای جدید"}</h3>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={17} color="var(--ink-soft)" />
          </button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
            نام کالا
            <input required value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} style={inputStyle} />
          </label>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              واحد
              <input value={values.unit} onChange={(e) => setValues((v) => ({ ...v, unit: e.target.value }))} placeholder="عدد" style={inputStyle} />
            </label>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              انبار
              <select value={values.warehouse_id} onChange={(e) => setValues((v) => ({ ...v, warehouse_id: e.target.value }))} style={inputStyle}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              موجودی فعلی
              <input type="number" value={values.qty_on_hand} onChange={(e) => setValues((v) => ({ ...v, qty_on_hand: e.target.valueAsNumber || 0 }))} style={inputStyle} />
            </label>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--ink-soft)" }}>
              حداقل موجودی
              <input type="number" value={values.min_qty} onChange={(e) => setValues((v) => ({ ...v, min_qty: e.target.valueAsNumber || 0 }))} style={inputStyle} />
            </label>
          </div>
          {error && <div style={{ color: "var(--brick)", fontSize: 12 }}>{error}</div>}
          <button type="submit" disabled={saving} style={{ background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "در حال ذخیره..." : "ذخیره"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------- main page ----------

export default function Inventory() {
  const { format: formatPreferredCurrency } = usePreferredCurrencyDisplay();
  const [path, setPath] = useState([]);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [rowError, setRowError] = useState(null);
  const [nameModal, setNameModal] = useState(null); // {mode: 'group'|'category', editing?: node}
  const [itemModal, setItemModal] = useState(null); // {editing?: node} | null

  const currentParentId = path.length ? path[path.length - 1].id : null;
  const level = path.length; // 0 = groups, 1 = subcategories, 2 = items

  const loadChildren = useCallback((parentId) => {
    setLoading(true);
    api.inventoryTree(parentId).then(setChildren).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadChildren(currentParentId); }, [currentParentId, loadChildren]);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const handle = setTimeout(() => { api.inventorySearch(query).then(setResults); }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function openNode(node) { if (node.level < 3) setPath((p) => [...p, node]); }
  function jumpTo(index) { setPath((p) => (index < 0 ? [] : p.slice(0, index + 1))); }

  async function handleDeleteNode(node) {
    setRowError(null);
    try {
      if (node.level === 1) await api.inventoryDeleteGroup(node.id);
      else if (node.level === 2) await api.inventoryDeleteCategory(node.id);
      else await api.inventoryDeleteItem(node.id);
      setConfirmDeleteId(null);
      loadChildren(currentParentId);
    } catch (err) {
      setRowError(err.message);
      setConfirmDeleteId(null);
    }
  }

  function refreshAndClose() {
    setNameModal(null);
    setItemModal(null);
    loadChildren(currentParentId);
  }

  const addLabel = level === 0 ? "افزودن گروه" : level === 1 ? "افزودن زیردسته" : "افزودن کالا";
  function handleAddClick() {
    if (level === 2) setItemModal({ editing: null });
    else setNameModal({ mode: level === 0 ? "group" : "category", editing: null });
  }
  function handleEditClick(node) {
    if (node.level === 3) setItemModal({ editing: node });
    else setNameModal({ mode: node.level === 1 ? "group" : "category", editing: node });
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>انبارداری</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0" }}>کدینگ سه‌سطحی کالا — گروه، زیرگروه، کالا</p>
        </div>
      </div>

      <WarehousesPanel />

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, maxWidth: 420 }}>
        <Search size={16} color="var(--ink-soft)" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو با شناسه، کد یا بخشی از نام کالا..."
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
          {results.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Package size={16} color="var(--teal)" />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{item.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{item.breadcrumb.join(" › ")} · کد {item.code}</div>
                </div>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12.5, color: item.qty_on_hand < item.min_qty ? "var(--brick)" : "var(--ink-soft)" }}>
                  {toFa(item.qty_on_hand)} {item.unit}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                  {rial(item.avg_cost || 0)}
                  {formatPreferredCurrency(item.avg_cost || 0) ? ` (${formatPreferredCurrency(item.avg_cost || 0)})` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <Breadcrumb path={path} onJump={jumpTo} />
            <button
              onClick={handleAddClick}
              style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", background: "transparent", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "var(--teal)", cursor: "pointer" }}
            >
              <Plus size={14} /> {addLabel}
            </button>
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
                  {node.level < 3 ? <Folder size={16} color="var(--gold)" /> : <Package size={16} color="var(--teal)" />}
                  <span style={{ fontSize: 13.5 }}>{node.name}</span>
                  <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{node.code}</span>
                  {node.level === 3 && (
                    <span style={{ fontSize: 12, color: node.qty_on_hand < node.min_qty ? "var(--brick)" : "var(--ink-soft)" }}>
                      {toFa(node.qty_on_hand)} / حداقل {toFa(node.min_qty)} {node.unit} · {node.warehouse_name || "بدون انبار"}
                    </span>
                  )}
                </button>

                {confirmDeleteId === node.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                    <span style={{ color: "var(--brick)" }}>حذف شود؟</span>
                    <button onClick={() => handleDeleteNode(node)} style={{ border: "none", background: "transparent", color: "var(--brick)", cursor: "pointer", fontWeight: 700 }}>بله</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700 }}>خیر</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleEditClick(node)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 5, cursor: "pointer" }}>
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
              ? (nameModal.mode === "group" ? "ویرایش گروه" : "ویرایش زیردسته")
              : (nameModal.mode === "group" ? "گروه جدید" : "زیردسته جدید")
          }
          initialName={nameModal.editing?.name}
          onClose={() => setNameModal(null)}
          onSubmit={async (name) => {
            if (nameModal.mode === "group") {
              if (nameModal.editing) await api.inventoryUpdateGroup(nameModal.editing.id, { name });
              else await api.inventoryCreateGroup({ name });
            } else {
              if (nameModal.editing) await api.inventoryUpdateCategory(nameModal.editing.id, { name });
              else await api.inventoryCreateCategory({ parent_id: currentParentId, name });
            }
            refreshAndClose();
          }}
        />
      )}

      {itemModal && (
        <ItemModal
          item={itemModal.editing}
          parentId={currentParentId}
          onClose={() => setItemModal(null)}
          onSaved={refreshAndClose}
        />
      )}
    </div>
  );
}
