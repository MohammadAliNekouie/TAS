import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Wallet, Receipt, CreditCard, TrendingUp, TrendingDown, AlertTriangle,
  PackageX, Clock, FileCheck, Landmark, Search, Bell, ChevronLeft,
  ShoppingCart, Boxes, Factory, Banknote, Coins, BarChart3, Cpu, MemoryStick, Bug,
} from "lucide-react";
import { api, exchangeRatesApi, modayanRemindersApi } from "../lib/api.js";
import { toFa, rial } from "../lib/persian.js";
import { CURRENCY_LABELS, CURRENCY_SYMBOLS } from "../lib/currency.js";

const iconMap = {
  trendingUp: TrendingUp,
  receipt: Receipt,
  creditCard: CreditCard,
  wallet: Wallet,
  fileCheck: FileCheck,
  landmark: Landmark,
  alertTriangle: AlertTriangle,
};

const toneMap = {
  teal: { bg: "var(--teal-soft)", fg: "var(--teal-dark)" },
  gold: { bg: "var(--gold-soft)", fg: "var(--gold)" },
  brick: { bg: "var(--brick-soft)", fg: "var(--brick)" },
};

const quickAccessGroups = [
  {
    title: "معاملات",
    items: [
      { to: "/sales-purchase", label: "خرید و فروش", icon: ShoppingCart },
      { to: "/receipts-payments", label: "دریافت و پرداخت", icon: Wallet },
    ],
  },
  {
    title: "انبار و تولید",
    items: [
      { to: "/warehouse", label: "انبارداری", icon: Boxes },
      { to: "/production", label: "مدیریت تولید", icon: Factory },
    ],
  },
  {
    title: "مالی",
    items: [
      { to: "/cheques", label: "مدیریت چک", icon: FileCheck },
      { to: "/petty-cash", label: "تنخواه‌گردان", icon: Banknote },
      { to: "/multi-currency", label: "حسابداری چند ارزی", icon: Coins },
    ],
  },
  {
    title: "گزارش و تطبیق مالیاتی",
    items: [
      { to: "/reports", label: "گزارش‌گیری", icon: BarChart3 },
      { to: "/modayan", label: "سامانه مودیان", icon: Landmark },
    ],
  },
];

function KpiCard({ label, value, delta, up, icon }) {
  const Icon = iconMap[icon] || TrendingUp;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--teal-soft)", color: "var(--teal-dark)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} />
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, margin: "10px 0" }}>{rial(value)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: up ? "var(--teal)" : "var(--brick)" }}>
        {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        <span>{toFa(Math.abs(delta).toFixed(1))}٪ نسبت به دیروز</span>
      </div>
    </div>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--ink)", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, direction: "rtl" }}>
      <div style={{ opacity: 0.7, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{toFa(payload[0].value)} میلیون ریال</div>
    </div>
  );
}

function Gauge({ label, percent, valueLabel, tone }) {
  const color = percent >= 85 ? "var(--brick)" : tone;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
        <span style={{ color: "var(--ink-soft)" }}>{label}</span>
        <span style={{ fontWeight: 700 }}>{toFa(percent)}٪</span>
      </div>
      <div style={{ height: 8, borderRadius: 5, background: "var(--bg)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(percent, 100)}%`, background: color, borderRadius: 5, transition: "width .3s ease" }} />
      </div>
      {valueLabel && <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>{valueLabel}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [kpis, setKpis] = useState([]);
  const [range, setRange] = useState("7");
  const [sales, setSales] = useState([]);
  const [events, setEvents] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [systemStats, setSystemStats] = useState(null);
  const [exchangeRates, setExchangeRates] = useState(null);
  const [modayanReminders, setModayanReminders] = useState([]);
  const [recentErrors, setRecentErrors] = useState([]);

  function loadReminders() {
    modayanRemindersApi.list().then(setModayanReminders);
  }

  async function dismissReminder(id) {
    await modayanRemindersApi.dismiss(id);
    loadReminders();
  }

  useEffect(() => {
    api.kpis().then(setKpis);
    api.events().then(setEvents);
    api.lowStock().then(setLowStock);
    api.chequesDue().then(setCheques);
    loadReminders();
  }, []);

  useEffect(() => {
    api.sales(range).then(setSales);
  }, [range]);

  // Server resource usage + recent error log, refreshed every 3 seconds as
  // requested — a lightweight poll rather than a websocket, since a few
  // extra requests every 3s is negligible for a single-server deployment.
  useEffect(() => {
    function poll() {
      api.system.stats().then(setSystemStats).catch(() => {});
      api.system.errors().then(setRecentErrors).catch(() => {});
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  // Exchange rates only change server-side every 30 minutes, so polling
  // every 5 minutes here is enough to reflect that without hammering the
  // (rate-limited, free) upstream source through the backend.
  useEffect(() => {
    function pollRates() {
      exchangeRatesApi.get().then(setExchangeRates).catch(() => {});
    }
    pollRates();
    const id = setInterval(pollRates, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>داشبورد حسابداری</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0" }}>شنبه، ۱۴ شهریور ۱۴۰۵ — خوش آمدید</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 14px", minWidth: 220 }}>
            <Search size={16} color="var(--ink-soft)" />
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>جستجوی فاکتور، مشتری...</span>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <Bell size={16} color="var(--ink-soft)" />
            <span style={{ position: "absolute", top: 6, left: 8, width: 7, height: 7, borderRadius: "50%", background: "var(--brick)" }} />
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginBottom: 20 }}>
        {kpis.map((k) => (
          <KpiCard key={k.key} {...k} />
        ))}
      </div>

      {modayanReminders.length > 0 && (
        <div style={{ background: "var(--gold-soft)", border: "1px solid var(--gold)", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "var(--gold)", fontWeight: 700, fontSize: 13.5 }}>
            <Landmark size={16} />
            یادآوری بررسی سامانه مودیان ({toFa(modayanReminders.length)} مورد)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {modayanReminders.map((r) => (
              <label key={r.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 12.5, cursor: "pointer" }}>
                <input type="checkbox" onChange={() => dismissReminder(r.id)} style={{ marginTop: 3, cursor: "pointer" }} />
                <span>
                  {r.reason}
                  <span style={{ color: "var(--ink-soft)", fontSize: 11 }}> — فاکتور شماره {toFa(r.invoice_id)}، {r.invoice_date}، مبلغ {rial(r.total_amount)}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* chart + events */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
        <SectionCard
          title="روند فروش"
          action={
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              {[["7", "۷ روز"], ["30", "۳۰ روز"]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setRange(val)}
                  style={{
                    border: "none", cursor: "pointer", padding: "5px 12px", fontSize: 12.5,
                    background: range === val ? "var(--accent-solid)" : "transparent",
                    color: range === val ? "#fff" : "var(--ink-soft)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <div style={{ height: 240, direction: "ltr" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--teal)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="label" reversed tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} interval={range === "30" ? 3 : 0} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" stroke="var(--teal)" strokeWidth={2} fill="url(#salesFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="رویدادهای اخیر">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {events.map((e, i) => {
              const tone = toneMap[e.tone] || toneMap.teal;
              const Icon = iconMap[e.icon] || Receipt;
              return (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 30, height: 30, minWidth: 30, borderRadius: 8, background: tone.bg, color: tone.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={15} />
                  </div>
                  <p style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>{e.text}</p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* low stock + cheques */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <SectionCard
          title="هشدار کمبود موجودی"
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--brick)", fontSize: 12 }}>
              <PackageX size={14} />
              <span>{toFa(lowStock.length)} کالا</span>
            </div>
          }
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ color: "var(--ink-soft)", textAlign: "right" }}>
                <th style={{ fontWeight: 500, paddingBottom: 10 }}>کالا</th>
                <th style={{ fontWeight: 500, paddingBottom: 10 }}>انبار</th>
                <th style={{ fontWeight: 500, paddingBottom: 10 }}>موجودی</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((s) => (
                <tr key={s.code} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "9px 0" }}>{s.name}</td>
                  <td style={{ padding: "9px 0", color: "var(--ink-soft)" }}>{s.warehouse}</td>
                  <td style={{ padding: "9px 0" }}>
                    <span style={{ background: "var(--brick-soft)", color: "var(--brick)", borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>
                      {toFa(s.qty_on_hand)} {s.unit}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        <SectionCard
          title="چک‌های نزدیک به سررسید"
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--gold)", fontSize: 12 }}>
              <Clock size={14} />
              <span>{toFa(cheques.length)} فقره</span>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cheques.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "var(--bg)" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{c.party}</p>
                  <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>سررسید: {toFa(c.due_date)}</span>
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{rial(c.amount)}</p>
                  <span style={{ fontSize: 10.5, background: "var(--gold-soft)", color: "var(--gold)", padding: "2px 8px", borderRadius: 6 }}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* server health + recent errors + exchange rates */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <SectionCard title="نرخ ارز (به ریال)">
          {exchangeRates?.error && !exchangeRates.usd ? (
            <div style={{ fontSize: 12, color: "var(--brick)" }}>{exchangeRates.error}</div>
          ) : exchangeRates?.usd ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["usd", "eur", "cny"].map((code) => (
                  <div key={code} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span style={{ color: "var(--ink-soft)" }}>{CURRENCY_SYMBOLS[code]} {CURRENCY_LABELS[code]}</span>
                    <span style={{ fontWeight: 700 }}>{rial(exchangeRates[code])}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 10 }}>
                {exchangeRates.error ? "⚠ آخرین به‌روزرسانی موفق: " : "به‌روزرسانی: "}
                {exchangeRates.updatedAt ? new Date(exchangeRates.updatedAt).toLocaleString("fa-IR") : "—"}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>در حال دریافت نرخ ارز...</div>
          )}
        </SectionCard>

        <SectionCard title="منابع سرور">
          {systemStats ? (
            <>
              <Gauge
                label={<span style={{ display: "flex", alignItems: "center", gap: 6 }}><Cpu size={13} /> پردازنده (CPU)</span>}
                percent={systemStats.cpuPercent}
                tone="var(--teal)"
              />
              <Gauge
                label={<span style={{ display: "flex", alignItems: "center", gap: 6 }}><MemoryStick size={13} /> حافظه (RAM)</span>}
                percent={systemStats.memPercent}
                valueLabel={`${toFa(systemStats.memUsedMB.toLocaleString("en-US"))} از ${toFa(systemStats.memTotalMB.toLocaleString("en-US"))} مگابایت`}
                tone="var(--gold)"
              />
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>هر ۳ ثانیه به‌روزرسانی می‌شود</div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>در حال دریافت اطلاعات سرور...</div>
          )}
        </SectionCard>

        <SectionCard
          title="آخرین خطاهای نرم‌افزار"
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: recentErrors.length ? "var(--brick)" : "var(--ink-soft)", fontSize: 12 }}>
              <Bug size={14} />
              <span>{toFa(recentErrors.length)} مورد</span>
            </div>
          }
        >
          {recentErrors.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>خطایی ثبت نشده است.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentErrors.map((e, i) => (
                <div key={i} style={{ padding: "10px 12px", borderRadius: 9, background: "var(--brick-soft)" }}>
                  <p style={{ fontSize: 12, margin: 0, color: "var(--brick)", fontFamily: "monospace", direction: "ltr", textAlign: "right", wordBreak: "break-word" }}>
                    {e.message}
                  </p>
                  <span style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>{new Date(e.time).toLocaleString("fa-IR")}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* quick access grouped menu */}
      <SectionCard title="دسترسی سریع به بخش‌ها">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
          {quickAccessGroups.map((group) => (
            <div key={group.title}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10 }}>{group.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border)",
                      textDecoration: "none", color: "var(--ink)", fontSize: 13,
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <item.icon size={15} color="var(--teal)" />
                      {item.label}
                    </span>
                    <ChevronLeft size={14} color="var(--ink-soft)" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
