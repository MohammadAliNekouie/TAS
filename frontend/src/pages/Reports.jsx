import React, { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, FileCheck, Banknote, Factory, Landmark, Check, AlertTriangle,
} from "lucide-react";
import { api } from "../lib/api.js";
import { rial, toFa } from "../lib/persian.js";

function Stat({ icon: Icon, label, value, tone = "teal" }) {
  const toneColors = {
    teal: { bg: "var(--teal-soft)", fg: "var(--teal-dark)" },
    gold: { bg: "var(--gold-soft)", fg: "var(--gold)" },
    brick: { bg: "var(--brick-soft)", fg: "var(--brick)" },
  }[tone];
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: toneColors.bg, color: toneColors.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} />
        </div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function SummaryTab() {
  const [s, setS] = useState(null);
  useEffect(() => { api.reportsSummary().then(setS); }, []);
  if (!s) return <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16, marginBottom: 16 }}>
        <Stat icon={TrendingUp} label="جمع فروش" value={rial(s.totalSales)} tone="teal" />
        <Stat icon={TrendingDown} label="جمع خرید" value={rial(s.totalPurchases)} tone="brick" />
        <Stat icon={Wallet} label="حاشیه سود ناخالص" value={rial(s.grossMargin)} tone={s.grossMargin >= 0 ? "teal" : "brick"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16, marginBottom: 16 }}>
        <Stat icon={Wallet} label="جمع دریافت‌ها" value={rial(s.totalReceipts)} tone="teal" />
        <Stat icon={Wallet} label="جمع پرداخت‌ها" value={rial(s.totalPayments)} tone="brick" />
        <Stat icon={Wallet} label="جریان نقدی خالص" value={rial(s.netCashFlow)} tone={s.netCashFlow >= 0 ? "teal" : "brick"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 16 }}>
        <Stat icon={Banknote} label="مانده تنخواه" value={rial(s.pettyCashBalance)} tone="gold" />
        <Stat icon={FileCheck} label="چک‌های در جریان" value={rial(s.chequesOutstanding)} tone="gold" />
        <Stat icon={Factory} label="تعداد دستور تولید" value={toFa(s.productionOrderCount)} tone="teal" />
        <Stat icon={Landmark} label="فاکتور در انتظار تایید مودیان" value={toFa(s.modayanPending)} tone="brick" />
      </div>
    </>
  );
}

function TrialBalanceTab() {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.trialBalance().then(setRows); }, []);
  if (!rows) return <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>;

  const totalDebit = rows.reduce((s, r) => s + r.total_debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      {rows.length === 0 ? (
        <div style={{ padding: 28, textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>
          هنوز هیچ سند حسابداری‌ای ثبت نشده — این گزارش با ثبت اولین سند یا فاکتور (پس از تنظیم اتصال حسابداری) پر می‌شود.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--ink-soft)", textAlign: "right", background: "var(--bg)" }}>
              <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>کد</th>
              <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>حساب</th>
              <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>گروه</th>
              <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>جمع بدهکار</th>
              <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>جمع بستانکار</th>
              <th style={{ fontWeight: 600, padding: "12px 16px", fontSize: 12 }}>مانده</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 16px", color: "var(--ink-soft)" }}>{r.code}</td>
                <td style={{ padding: "10px 16px" }}>{r.name}</td>
                <td style={{ padding: "10px 16px", color: "var(--ink-soft)", fontSize: 12 }}>{r.group_name}</td>
                <td style={{ padding: "10px 16px" }}>{r.total_debit ? rial(r.total_debit) : "—"}</td>
                <td style={{ padding: "10px 16px" }}>{r.total_credit ? rial(r.total_credit) : "—"}</td>
                <td style={{ padding: "10px 16px", fontWeight: 700, color: r.balance >= 0 ? "var(--ink)" : "var(--brick)" }}>{rial(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
              <td colSpan={3} style={{ padding: "12px 16px" }}>جمع کل</td>
              <td style={{ padding: "12px 16px" }}>{rial(totalDebit)}</td>
              <td style={{ padding: "12px 16px" }}>{rial(totalCredit)}</td>
              <td style={{ padding: "12px 16px", color: Math.abs(totalDebit - totalCredit) < 1 ? "var(--teal)" : "var(--brick)" }}>
                {Math.abs(totalDebit - totalCredit) < 1 ? "تراز است ✓" : "تراز نیست!"}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

function AmountList({ title, rows, total, toneWhenPositive = "teal" }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px" }}>{title}</h3>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>موردی وجود ندارد.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => (
            <div key={r.code} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span><span style={{ color: "var(--ink-soft)", fontSize: 11.5 }}>{r.code}</span> {r.name}</span>
              <span>{rial(r.amount)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <span>جمع</span>
        <span style={{ color: total >= 0 ? `var(--${toneWhenPositive})` : "var(--brick)" }}>{rial(total)}</span>
      </div>
    </div>
  );
}

function IncomeStatementTab() {
  const [data, setData] = useState(null);
  useEffect(() => { api.incomeStatement().then(setData); }, []);
  if (!data) return <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <AmountList title="درآمدها" rows={data.revenue} total={data.totalRevenue} />
        <AmountList title="هزینه‌ها" rows={data.expenses} total={data.totalExpenses} toneWhenPositive="brick" />
      </div>
      <div style={{ background: "var(--teal-soft)", borderRadius: 14, padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--teal-dark)" }}>سود (زیان) خالص</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: data.netIncome >= 0 ? "var(--teal-dark)" : "var(--brick)" }}>{rial(data.netIncome)}</span>
      </div>
    </div>
  );
}

function BalanceSheetTab() {
  const [data, setData] = useState(null);
  useEffect(() => { api.balanceSheet().then(setData); }, []);
  if (!data) return <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>در حال بارگذاری...</div>;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <AmountList title="دارایی‌ها" rows={data.assets} total={data.totalAssets} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <AmountList title="بدهی‌ها" rows={data.liabilities} total={data.totalLiabilities} toneWhenPositive="brick" />
          <AmountList
            title="حقوق صاحبان سهام (شامل سود دوره جاری)"
            rows={[...data.equity, { code: "—", name: "سود (زیان) دوره جاری", amount: data.currentPeriodNetIncome }]}
            total={data.totalEquity}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderRadius: 14,
          background: data.balanced ? "var(--teal-soft)" : "var(--brick-soft)",
          color: data.balanced ? "var(--teal-dark)" : "var(--brick)", fontWeight: 700, fontSize: 13.5,
        }}
      >
        {data.balanced ? <Check size={16} /> : <AlertTriangle size={16} />}
        {data.balanced
          ? "ترازنامه متوازن است (دارایی = بدهی + حقوق صاحبان سهام)"
          : "ترازنامه متوازن نیست — احتمالاً برخی سندها ناقص یا اتصال حسابداری کامل نشده است."}
      </div>
    </div>
  );
}

function LedgerTab(){const [rows,setRows]=useState(null);useEffect(()=>{api.ledger().then(setRows)},[]);if(!rows)return <div>در حال بارگذاری...</div>;return <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}><thead><tr style={{background:'var(--bg)',textAlign:'right'}}><th style={{padding:10}}>تاریخ</th><th>سند</th><th>کد</th><th>حساب</th><th>بدهکار</th><th>بستانکار</th><th>شرح</th></tr></thead><tbody>{rows.map(r=><tr key={r.line_id} style={{borderTop:'1px solid var(--border)'}}><td style={{padding:10}}>{r.voucher_date}</td><td>#{r.voucher_id}</td><td>{r.code}</td><td>{r.name}</td><td>{r.debit?rial(r.debit):'—'}</td><td>{r.credit?rial(r.credit):'—'}</td><td>{r.line_description||r.description}</td></tr>)}</tbody></table></div>}
function CashFlowTab(){const [rows,setRows]=useState(null);useEffect(()=>{api.cashFlow().then(setRows)},[]);if(!rows)return <div>در حال بارگذاری...</div>;return <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr style={{background:'var(--bg)',textAlign:'right'}}><th style={{padding:12}}>کد</th><th>حساب</th><th>بدهکار</th><th>بستانکار</th><th>خالص</th></tr></thead><tbody>{rows.map(r=><tr key={r.code} style={{borderTop:'1px solid var(--border)'}}><td style={{padding:12}}>{r.code}</td><td>{r.name}</td><td>{rial(r.debit)}</td><td>{rial(r.credit)}</td><td>{rial(r.net)}</td></tr>)}</tbody></table></div>}

function GrossProfitTab(){const [rows,setRows]=useState(null);useEffect(()=>{api.grossProfit().then(setRows)},[]);if(!rows)return <div>در حال بارگذاری...</div>;const total=rows.reduce((s,r)=>s+r.gross_profit,0);return <div><div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}><thead><tr style={{background:'var(--bg)',textAlign:'right'}}><th style={{padding:10}}>فاکتور</th><th>تاریخ</th><th>طرف حساب</th><th>درآمد خالص</th><th>COGS</th><th>سود ناخالص</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} style={{borderTop:'1px solid var(--border)'}}><td style={{padding:10}}>#{r.id}</td><td>{r.invoice_date}</td><td>{r.party}</td><td>{rial(r.revenue)}</td><td>{rial(r.cogs)}</td><td>{rial(r.gross_profit)}</td></tr>)}</tbody><tfoot><tr style={{borderTop:'2px solid var(--border)',fontWeight:700}}><td colSpan={5} style={{padding:10}}>جمع سود ناخالص</td><td>{rial(total)}</td></tr></tfoot></table></div></div>}

const TABS = [
  { key: "summary", label: "خلاصه" },
  { key: "trial-balance", label: "تراز آزمایشی" },
  { key: "income-statement", label: "صورت سود و زیان" },
  { key: "balance-sheet", label: "ترازنامه" },
  { key: "ledger", label: "دفتر کل" },
  { key: "gross-profit", label: "سود ناخالص" },
  { key: "cash-flow", label: "جریان نقدی" },
];

export default function Reports() {
  const [tab, setTab] = useState("summary");

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>گزارش‌گیری</h1>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0", maxWidth: 620 }}>
          این بخش خروجی خواندنی از داده‌های سایر بخش‌هاست. تراز آزمایشی، صورت سود و زیان و ترازنامه از اسناد حسابداری واقعی
          محاسبه می‌شوند — برای اینکه این سه گزارش داده داشته باشند، «اتصال حسابداری» را در تنظیمات اولیه تکمیل کنید.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              border: "none", background: "transparent", cursor: "pointer", padding: "10px 14px", fontSize: 13,
              fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? "var(--teal-dark)" : "var(--ink-soft)",
              borderBottom: tab === t.key ? "2px solid var(--accent-solid)" : "2px solid transparent", marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" && <SummaryTab />}
      {tab === "trial-balance" && <TrialBalanceTab />}
      {tab === "income-statement" && <IncomeStatementTab />}
      {tab === "balance-sheet" && <BalanceSheetTab />}
      {tab === "ledger" && <LedgerTab />}
      {tab === "gross-profit" && <GrossProfitTab />}
      {tab === "cash-flow" && <CashFlowTab />}
    </div>
  );
}
