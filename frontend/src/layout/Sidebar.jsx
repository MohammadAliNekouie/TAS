import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Wallet, Boxes, Factory, FileCheck,
  Banknote, Coins, BarChart3, Landmark, ChevronDown, Settings, Sun, Moon, Users, BookOpen, ClipboardList, LogOut, UserCog,
  FlaskConical, ArrowLeftRight,
} from "lucide-react";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/authContext.jsx";

const groups = [
  {
    title: "حسابداری",
    items: [
      { to: "/chart-of-accounts", label: "کدینگ حسابداری", icon: BookOpen },
      { to: "/journal-vouchers", label: "اسناد حسابداری", icon: ClipboardList },
      { to: "/financial-periods", label: "دوره‌های مالی", icon: ClipboardList },
    ],
  },
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
      { to: "/production-formulas", label: "فرمول تولید", icon: FlaskConical },
      { to: "/production-runs", label: "فرایند تولید", icon: Factory },
      { to: "/stock-adjustments", label: "کالا در گردش", icon: ArrowLeftRight },
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

const roleLabel = { admin: "مدیر سیستم", accountant: "حسابدار", viewer: "مشاهده‌گر" };

function NavItem({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 9,
        fontSize: 13.5,
        color: isActive ? "#fff" : "var(--ink-soft)",
        background: isActive ? "var(--accent-solid)" : "transparent",
        textDecoration: "none",
      })}
    >
      <Icon size={16} />
      <span>{label}</span>
    </NavLink>
  );
}

function Group({ title, items }) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "10px 12px",
          fontSize: 11.5,
          fontWeight: 700,
          color: "var(--ink-soft)",
          letterSpacing: 0.2,
        }}
      >
        <span>{title}</span>
        <ChevronDown
          size={14}
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s" }}
        />
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 6px" }}>
          {items.map((it) => (
            <NavItem key={it.to} {...it} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ theme, onToggleTheme }) {
  const [companyName, setCompanyName] = useState("");
  const { user, logout } = useAuth();

  useEffect(() => {
    api.company.get().then((c) => setCompanyName(c.name || ""));
  }, []);

  return (
    <aside
      style={{
        width: 236,
        minWidth: 236,
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "16px 10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.png" alt="تاس" style={{ width: 32, height: 32, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--teal-dark)" }}>تاس</div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              {companyName || "نام شرکت تعریف نشده"}
            </div>
          </div>
        </div>
        <button
          onClick={onToggleTheme}
          title={theme === "light" ? "حالت تیره" : "حالت روشن"}
          style={{
            width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          {theme === "light" ? <Moon size={14} color="var(--ink-soft)" /> : <Sun size={14} color="var(--gold)" />}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <NavItem to="/" label="داشبورد" icon={LayoutDashboard} />
        <div style={{ height: 12 }} />

        {groups.map((g) => (
          <Group key={g.title} {...g} />
        ))}
      </div>

      <div style={{ paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 2 }}>
        <NavItem to="/parties" label="طرف‌های حساب" icon={Users} />
        {user?.role === "admin" && <NavItem to="/settings" label="تنظیمات اولیه" icon={Settings} />}
        {user?.role === "admin" && <NavItem to="/audit-log" label="گزارش رویدادها" icon={ClipboardList} />}
        {user?.role === "admin" && <NavItem to="/users" label="کاربران و دسترسی" icon={UserCog} />}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px 2px", marginTop: 6 }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{user?.full_name}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>{roleLabel[user?.role] || user?.role}</div>
          </div>
          <button
            onClick={logout}
            title="خروج"
            style={{ border: "1px solid var(--border)", background: "var(--bg)", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <LogOut size={14} color="var(--brick)" />
          </button>
        </div>
      </div>
    </aside>
  );
}
