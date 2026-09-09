import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import { useTheme } from "../lib/theme.js";

export default function AppLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{ display: "flex", height: "100vh", direction: "rtl" }}>
      <Sidebar theme={theme} onToggleTheme={toggleTheme} />
      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
        <Outlet />
      </main>
    </div>
  );
}
