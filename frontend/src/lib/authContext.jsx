import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "tas-auth";

function loadStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

// A plain module-level variable (not React state) holding the current
// token. api.js reads this synchronously on every request. Critically,
// `persist()` below updates this the instant login/logout happens — not
// inside a useEffect — so there is no window where a component has already
// re-rendered as "authenticated" but a fetch still goes out tokenless.
let currentToken = loadStored()?.token || null;

function persist(auth) {
  currentToken = auth?.token || null;
  if (auth) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  else window.localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(loadStored);

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
    setAuth({ token, user });
  }
  function logout() {
    setAuth(null);
  }

  return (
    <AuthContext.Provider value={{ token: auth?.token || null, user: auth?.user || null, isAuthenticated: !!auth?.token, login, logout }}>
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
