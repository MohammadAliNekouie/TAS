import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authApi } from "../lib/api.js";
import { useAuth } from "../lib/authContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token, user } = await authApi.login(username, password);
      login(token, user);
      const from = location.state?.from || "/";
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)", direction: "rtl", padding: 20,
      }}
    >
      <div style={{ width: 360, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="/logo.png" alt="تاس" style={{ width: 56, height: 56, objectFit: "contain", marginBottom: 10 }} />
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--teal-dark)" }}>تاس</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 2 }}>نرم‌افزار حسابداری</div>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
            نام کاربری
            <input
              required autoFocus value={username} onChange={(e) => setUsername(e.target.value)}
              style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", background: "var(--bg)", color: "var(--ink)" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "var(--ink-soft)" }}>
            رمز عبور
            <input
              required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", background: "var(--bg)", color: "var(--ink)" }}
            />
          </label>

          {error && <div style={{ color: "var(--brick)", fontSize: 12.5 }}>{error}</div>}

          <button
            type="submit" disabled={loading}
            style={{ background: "var(--accent-solid)", color: "#fff", border: "none", borderRadius: 9, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 6 }}
          >
            {loading ? "در حال ورود..." : "ورود"}
          </button>
        </form>

        <p style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 18, textAlign: "center", lineHeight: 1.8 }}>
          در اولین اجرای برنامه، نام کاربری و رمز عبور مدیر سیستم در کنسول سرور (ترمینال) نمایش داده شده است.
        </p>
      </div>
    </div>
  );
}
