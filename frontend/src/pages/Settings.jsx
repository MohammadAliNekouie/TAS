import React, { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, Landmark, Download, Upload, AlertTriangle, ShieldAlert, Link2 } from "lucide-react";
import { api, accountingSettingsApi } from "../lib/api.js";
import { rial } from "../lib/persian.js";
import RialInput from "../components/RialInput.jsx";
import AccountPicker from "../components/AccountPicker.jsx";

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

function CompanyInfoForm() {
  const [values, setValues] = useState({ name: "", legal_id: "", economic_code: "", address: "", phone: "", preferred_currency: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    api.company.get().then((c) => {
      setValues({
        name: c.name || "", legal_id: c.legal_id || "", economic_code: c.economic_code || "",
        address: c.address || "", phone: c.phone || "", preferred_currency: c.preferred_currency || "",
      });
      setLoading(false);
    });
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.company.update({ ...values, preferred_currency: values.preferred_currency || null });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { name: "name", label: "نام شرکت" },
    { name: "legal_id", label: "شناسه ملی" },
    { name: "economic_code", label: "کد اقتصادی" },
    { name: "phone", label: "تلفن" },
    { name: "address", label: "آدرس", fullWidth: true },
  ];

  if (loading) return <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>در حال بارگذاری...</div>;

  return (
    <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {fields.map((f) => (
        <label
          key={f.name}
          style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)", gridColumn: f.fullWidth ? "span 2" : "auto" }}
        >
          {f.label}
          <input
            value={values[f.name]}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            style={inputStyle}
          />
        </label>
      ))}
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
        ارز ترجیحی (نمایش قیمت کالاها به این ارز در کنار ریال)
        <select
          value={values.preferred_currency}
          onChange={(e) => setValues((v) => ({ ...v, preferred_currency: e.target.value }))}
          style={inputStyle}
        >
          <option value="">بدون ارز ترجیحی</option>
          <option value="usd">دلار آمریکا (USD)</option>
          <option value="eur">یورو (EUR)</option>
          <option value="cny">یوان چین (CNY)</option>
        </select>
      </label>
      <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={saving}
          style={{ background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
        >
          {saving ? "در حال ذخیره..." : "ذخیره اطلاعات شرکت"}
        </button>
        {savedAt && <span style={{ fontSize: 12, color: "var(--teal)" }}>ذخیره شد ✓</span>}
      </div>
    </form>
  );
}

function BankAccounts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState({ name: "", bank_name: "", sheba: "", initial_balance: "", coa_account: null });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.bankAccounts.list().then(setItems).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openAdd() {
    setEditing(null);
    setValues({ name: "", bank_name: "", sheba: "", initial_balance: "", coa_account: null });
    setFormError(null);
    setFormOpen(true);
  }
  function openEdit(row) {
    setEditing(row);
    setValues({
      name: row.name, bank_name: row.bank_name || "", sheba: row.sheba || "", initial_balance: row.initial_balance,
      coa_account: row.coa_account_id ? { id: row.coa_account_id, code: row.coa_account_code, name: row.coa_account_name } : null,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...values,
        initial_balance: values.initial_balance === "" ? 0 : values.initial_balance,
        coa_account_id: values.coa_account?.id || null,
      };
      if (editing) await api.bankAccounts.update(editing.id, payload);
      else await api.bankAccounts.create(payload);
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(id) {
    setDeleteError(null);
    try {
      await api.bankAccounts.remove(id);
      setConfirmDeleteId(null);
      load();
    } catch (err) {
      setDeleteError(err.message);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: 0, maxWidth: 460 }}>
          موجودی اولیه فقط هنگام تعریف حساب تنظیم می‌شود؛ موجودی فعلی از این پس صرفاً از طریق ثبت فاکتورها و اسناد تغییر می‌کند.
        </p>
        <button
          onClick={openAdd}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          <Plus size={15} /> افزودن حساب بانکی
        </button>
      </div>

      {deleteError && <div style={{ color: "var(--brick)", fontSize: 12.5, marginBottom: 10 }}>{deleteError}</div>}

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>هنوز حساب بانکی تعریف نشده است.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--ink-soft)", textAlign: "right", background: "var(--bg)" }}>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>نام حساب</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>بانک</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>شبا</th>
                <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>موجودی فعلی</th>
                <th style={{ width: 96 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>{row.name}</td>
                  <td style={{ padding: "12px 16px", color: "var(--ink-soft)" }}>{row.bank_name || "—"}</td>
                  <td style={{ padding: "12px 16px", color: "var(--ink-soft)" }}>{row.sheba || "—"}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 700, color: row.current_balance < 0 ? "var(--brick)" : "var(--ink)" }}>
                    {rial(row.current_balance)}
                  </td>
                  <td style={{ padding: "8px 16px" }}>
                    {confirmDeleteId === row.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                        <span style={{ color: "var(--brick)" }}>حذف شود؟</span>
                        <button onClick={() => doDelete(row.id)} style={{ border: "none", background: "transparent", color: "var(--brick)", cursor: "pointer", fontWeight: 700 }}>بله</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: "transparent", color: "var(--ink-soft)", cursor: "pointer", fontWeight: 700 }}>خیر</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(row)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 6, cursor: "pointer" }}>
                          <Pencil size={14} color="var(--ink-soft)" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(row.id)} style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 7, padding: 6, cursor: "pointer" }}>
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
        <div onClick={() => setFormOpen(false)} style={{ position: "fixed", inset: 0, background: "var(--overlay)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 16, padding: 24, width: 400 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{editing ? "ویرایش حساب بانکی" : "حساب بانکی جدید"}</h3>
              <button onClick={() => setFormOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <X size={18} color="var(--ink-soft)" />
              </button>
            </div>
            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
                نام حساب
                <input required value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
                نام بانک
                <input value={values.bank_name} onChange={(e) => setValues((v) => ({ ...v, bank_name: e.target.value }))} style={inputStyle} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
                شماره شبا
                <input value={values.sheba} onChange={(e) => setValues((v) => ({ ...v, sheba: e.target.value }))} style={inputStyle} placeholder="IR..." />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
                موجودی اولیه (ریال)
                <RialInput
                  disabled={!!editing}
                  value={values.initial_balance}
                  onChange={(v) => setValues((vv) => ({ ...vv, initial_balance: v }))}
                  style={{ opacity: editing ? 0.6 : 1 }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
                حساب معین متصل (برای ثبت خودکار سند)
                <AccountPicker value={values.coa_account} onChange={(a) => setValues((v) => ({ ...v, coa_account: a }))} />
              </label>
              {formError && <div style={{ color: "var(--brick)", fontSize: 12.5 }}>{formError}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="submit" disabled={saving} style={{ flex: 1, background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "در حال ذخیره..." : editing ? "ذخیره تغییرات" : "افزودن"}
                </button>
                <button type="button" onClick={() => setFormOpen(false)} style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 0", fontSize: 13.5, cursor: "pointer" }}>
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

function BackupRestore() {
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setMessage(null);
    setError(null);
  }

  function cancelRestore() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function doImport() {
    if (!pendingFile) return;
    setImporting(true);
    setError(null);
    try {
      await api.backup.import(pendingFile);
      setMessage("اطلاعات با موفقیت بازیابی شد. در حال بارگذاری مجدد...");
      cancelRestore();
      setTimeout(() => window.location.reload(), 1200);
      return;
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 14 }}>
        از تمام اطلاعات نرم‌افزار (فاکتورها، انبار، اسناد، طرف‌های حساب، تنظیمات) یک فایل اکسل کامل دانلود کنید، یا از یک فایل بکاپ قبلی بازیابی کنید.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href={api.backup.exportUrl}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent-solid)", color: "#fff", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          <Download size={15} /> دانلود بکاپ (Excel)
        </a>
        <label style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "var(--ink)" }}>
          <Upload size={15} /> انتخاب فایل بازیابی
          <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileChosen} style={{ display: "none" }} />
        </label>
      </div>

      {pendingFile && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "var(--brick-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--brick)", fontSize: 12.5, fontWeight: 700 }}>
            <AlertTriangle size={16} />
            فایل «{pendingFile.name}» تمام اطلاعات فعلی را جایگزین می‌کند — این عملیات غیرقابل بازگشت است.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={doImport} disabled={importing} style={{ background: "var(--brick-solid)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {importing ? "در حال بازیابی..." : "بله، جایگزین کن"}
            </button>
            <button onClick={cancelRestore} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer" }}>
              انصراف
            </button>
          </div>
        </div>
      )}

      {message && <div style={{ marginTop: 12, color: "var(--teal)", fontSize: 12.5 }}>{message}</div>}
      {error && <div style={{ marginTop: 12, color: "var(--brick)", fontSize: 12.5 }}>{error}</div>}
    </div>
  );
}

function DangerZone() {
  const REQUIRED = "پاک کن";
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  async function doWipe() {
    setBusy(true);
    setError(null);
    try {
      await api.resetFinancialData();
      setMessage("همه اطلاعات مالی پاک شد. در حال بارگذاری مجدد...");
      setOpen(false);
      setConfirmText("");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 14 }}>
        این عملیات تمام فاکتورها، اسناد حسابداری (شامل اسناد خودکار)، دریافت/پرداخت، چک‌ها، تنخواه، اسناد ارزی، فرمول و فرایند تولید، کالا در گردش، طرف‌های حساب، کالاها/دسته‌بندی‌های انبار، و گروه‌های کل و معین کدینگ حسابداری (سطح ۲ و ۳) را برای همیشه حذف می‌کند. اطلاعات شرکت، حساب‌های بانکی (با موجودی بازنشانی‌شده به مقدار اولیه)، انبارها، اتصال حسابداری، گروه‌های اصلی کدینگ (سطح ۱)، و کاربران حذف نمی‌شوند.
      </p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--brick-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          <ShieldAlert size={15} /> پاک‌سازی همه اطلاعات مالی
        </button>
      ) : (
        <div style={{ padding: 14, borderRadius: 10, background: "var(--brick-soft)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ color: "var(--brick)", fontSize: 12.5, fontWeight: 700 }}>
            این عملیات غیرقابل بازگشت است. برای تایید، عبارت «{REQUIRED}» را در کادر زیر تایپ کنید:
          </div>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} style={inputStyle} placeholder={REQUIRED} />
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={doWipe}
              disabled={confirmText !== REQUIRED || busy}
              style={{
                background: confirmText === REQUIRED ? "var(--brick-solid)" : "var(--border)", color: "#fff", border: "none",
                borderRadius: 8, padding: "8px 16px", fontSize: 12.5, fontWeight: 700,
                cursor: confirmText === REQUIRED ? "pointer" : "not-allowed",
              }}
            >
              {busy ? "در حال پاک‌سازی..." : "پاک‌سازی قطعی"}
            </button>
            <button
              onClick={() => { setOpen(false); setConfirmText(""); }}
              style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 12.5, cursor: "pointer" }}
            >
              انصراف
            </button>
          </div>
        </div>
      )}
      {message && <div style={{ marginTop: 12, color: "var(--teal)", fontSize: 12.5 }}>{message}</div>}
      {error && <div style={{ marginTop: 12, color: "var(--brick)", fontSize: 12.5 }}>{error}</div>}
    </div>
  );
}

function AccountingMapping() {
  const FIELDS = [
    { key: "sales_account_id", label: "حساب فروش" },
    { key: "cogs_account_id", label: "حساب بهای تمام‌شده کالای فروش‌رفته" },
    { key: "inventory_account_id", label: "حساب موجودی کالا" },
    { key: "ar_account_id", label: "حساب دریافتنی تجاری (پیش‌فرض، فروش نسیه)" },
    { key: "ap_account_id", label: "حساب پرداختنی تجاری (پیش‌فرض، خرید نسیه)" },
    { key: "cash_account_id", label: "حساب صندوق" },
    { key: "petty_cash_account_id", label: "حساب تنخواه" },
    { key: "vat_account_id", label: "حساب مالیات بر ارزش افزوده" },
    { key: "expense_account_id", label: "حساب هزینه/کسری و اضافی انبار" },
    { key: "other_payable_account_id", label: "حساب بستانکار خدمات و تعدیلات" },
    { key: "cheque_receivable_account_id", label: "حساب اسناد دریافتنی" },
    { key: "cheque_payable_account_id", label: "حساب اسناد پرداختنی" },
    { key: "retained_earnings_account_id", label: "حساب سود و زیان انباشته" },
    { key: "opening_closing_account_id", label: "حساب تراز افتتاحیه/اختتامیه" },
  ];
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    accountingSettingsApi.get().then((s) => {
      const initial = {};
      for (const f of FIELDS) {
        const accountKey = f.key.replace("_id", "");
        initial[f.key] = s[accountKey] ? { id: s[accountKey].id, code: s[accountKey].code, name: s[accountKey].name } : null;
      }
      setValues(initial);
      setLoading(false);
    });
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {};
      for (const f of FIELDS) payload[f.key] = values[f.key]?.id || null;
      await accountingSettingsApi.update(payload);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>در حال بارگذاری...</div>;

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: 0, maxWidth: 560 }}>
        با تکمیل این نگاشت، ثبت هر فاکتور خرید/فروش، دریافت/پرداخت، چک، تنخواه، تعدیل و تولید به‌صورت خودکار یک سند حسابداری واقعی (بدهکار/بستانکار) در کدینگ حسابداری ایجاد می‌کند.
        بدون تکمیل این بخش، فاکتورها همچنان ثبت می‌شوند اما سندی خودکار ساخته نمی‌شود.
      </p>
      {FIELDS.map((f) => (
        <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
          {f.label}
          <AccountPicker value={values[f.key]} onChange={(a) => setValues((v) => ({ ...v, [f.key]: a }))} />
        </label>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="submit" disabled={saving}
          style={{ background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
        >
          {saving ? "در حال ذخیره..." : "ذخیره اتصال حسابداری"}
        </button>
        {savedAt && <span style={{ fontSize: 12, color: "var(--teal)" }}>ذخیره شد ✓</span>}
      </div>
    </form>
  );
}

export default function Settings() {
  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>تنظیمات اولیه</h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0" }}>اطلاعات حقوقی شرکت و حساب‌های بانکی پایه در این بخش تعریف می‌شود.</p>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>اطلاعات شرکت</h2>
        <CompanyInfoForm />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <Landmark size={16} color="var(--teal)" /> حساب‌های بانکی
        </h2>
        <div style={{ marginTop: 12 }}>
          <BankAccounts />
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <Link2 size={16} color="var(--teal)" /> اتصال حسابداری
        </h2>
        <div style={{ marginTop: 12 }}>
          <AccountingMapping />
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
          <Download size={16} color="var(--teal)" /> پشتیبان‌گیری و بازیابی اطلاعات
        </h2>
        <div style={{ marginTop: 12 }}>
          <BackupRestore />
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--brick)", borderRadius: 14, padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8, color: "var(--brick)" }}>
          <ShieldAlert size={16} /> منطقه خطر
        </h2>
        <div style={{ marginTop: 12 }}>
          <DangerZone />
        </div>
      </div>
    </div>
  );
}
