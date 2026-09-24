import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("TAS UI error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100%", padding: 32, direction: "rtl", fontFamily: "inherit" }}>
        <div style={{ maxWidth: 760, margin: "40px auto", padding: 24, border: "1px solid var(--brick)", borderRadius: 14, background: "var(--surface)" }}>
          <h2 style={{ marginTop: 0 }}>خطا در نمایش این صفحه</h2>
          <p style={{ color: "var(--ink-soft)", lineHeight: 1.9 }}>برنامه متوقف نشده است؛ فقط این صفحه با خطا مواجه شده است. می‌توانید دوباره تلاش کنید یا به داشبورد برگردید.</p>
          <pre style={{ whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left", fontSize: 12, background: "var(--bg)", padding: 12, borderRadius: 8, overflow: "auto" }}>{this.state.error?.message || String(this.state.error)}</pre>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => window.location.reload()} style={{ padding: "9px 14px", border: 0, borderRadius: 8, background: "var(--accent-solid)", color: "#fff", cursor: "pointer" }}>تلاش مجدد</button>
            <button onClick={() => { window.location.href = "/"; }} style={{ padding: "9px 14px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", cursor: "pointer" }}>داشبورد</button>
          </div>
        </div>
      </div>
    );
  }
}
