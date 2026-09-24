import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "tas-user";

function loadStored() { return null; }
// A plain module-level variable (not React state) holding the current
// token. api.js reads this synchronously on every request. Critically,
// `persist()` below updates this the instant login/logout happens — not
// inside a useEffect — so there is no window where a component has already
// re-rendered as "authenticated" but a fetch still goes out tokenless.
let currentToken = null;

function persist(auth) {
  currentToken = null;
  if (auth?.user) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth.user));
  else window.sessionStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(() => { try { const u=window.sessionStorage.getItem(STORAGE_KEY); return u ? { user: JSON.parse(u) } : null; } catch (_) { return null; } });

  function setAuth(newAuth) {
    persist(newAuth); // synchronous — happens before React re-renders children
    setAuthState(newAuth);
  }

  // Called by api.js whenever a request comes back 401, so an expired/
  // invalid token clears itself out everywhere, not just on the next
  // manual page load.
  useEffect(() => {
    function handleUnauthorized() {
      setAuth(null);
    }
    window.addEventListener("tas-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("tas-unauthorized", handleUnauthorized);
  }, []);

  function login(token, user) {
    setAuth({ user });
  }
  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch (_) {}
    setAuth(null);
  }

  return (
    <AuthContext.Provider value={{ token: null, user: auth?.user || null, isAuthenticated: !!auth?.user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Read synchronously (outside React) by api.js, since fetch calls happen
// from a plain module, not a component. Always in sync with React state
// because persist() above is the only writer to `currentToken`, and it
// runs synchronously inside setAuth (not deferred to an effect).
export function getStoredToken() {
  return currentToken;
}
