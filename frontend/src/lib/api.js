const BASE = "/api";

import { getStoredToken } from "./authContext.jsx";

async function request(path, options = {}) {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
    ...options,
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event("tas-unauthorized"));
  }
  if (!res.ok) {
    let msg = `API error ${res.status}: ${path}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });
const put = (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) });
const del = (path) => request(path, { method: "DELETE" });

export const api = {
  kpis: () => get("/dashboard/kpis"),
  sales: (range) => get(`/dashboard/sales?range=${range}`),
  events: () => get("/dashboard/events"),
  lowStock: () => get("/dashboard/low-stock"),
  chequesDue: () => get("/dashboard/cheques-due"),

  inventoryTree: (parentId) => get(`/inventory/tree?parentId=${parentId ?? "null"}`),
  inventorySearch: (q, opts = {}) => get(`/inventory/search?q=${encodeURIComponent(q)}${opts.inStockOnly ? "&inStockOnly=1" : ""}`),
  inventoryCategories: () => get("/inventory/categories"),
  inventoryCreateItem: (data) => post("/inventory/items", data),
  inventoryUpdateItem: (id, data) => put(`/inventory/items/${id}`, data),
  inventoryDeleteItem: (id) => del(`/inventory/items/${id}`),
  inventoryCreateGroup: (data) => post("/inventory/groups", data),
  inventoryUpdateGroup: (id, data) => put(`/inventory/groups/${id}`, data),
  inventoryDeleteGroup: (id) => del(`/inventory/groups/${id}`),
  inventoryCreateCategory: (data) => post("/inventory/categories", data),
  inventoryUpdateCategory: (id, data) => put(`/inventory/categories/${id}`, data),
  inventoryDeleteCategory: (id) => del(`/inventory/categories/${id}`),

  reportsSummary: () => get("/reports/summary"),
  trialBalance: () => get("/reports/trial-balance"),
  incomeStatement: () => get("/reports/income-statement"),
  balanceSheet: () => get("/reports/balance-sheet"),
  ledger: (params="") => get(`/reports/ledger${params ? `?${params}` : ""}`),
  partyLedger: (party="") => get(`/reports/party-ledger?party=${encodeURIComponent(party)}`),
  cashFlow: () => get("/reports/cash-flow"),
  inventoryMovement: (itemId="") => get(`/reports/inventory-movement${itemId ? `?item_id=${itemId}` : ""}`),
  grossProfit: () => get("/reports/gross-profit"),

  company: {
    get: () => get("/company"),
    update: (data) => put("/company", data),
  },
  bankAccounts: {
    list: () => get("/bank-accounts"),
    create: (data) => post("/bank-accounts", data),
    update: (id, data) => put(`/bank-accounts/${id}`, data),
    remove: (id) => del(`/bank-accounts/${id}`),
  },
  warehouses: {
    list: () => get("/warehouses"),
    create: (data) => post("/warehouses", data),
    update: (id, data) => put(`/warehouses/${id}`, data),
    remove: (id) => del(`/warehouses/${id}`),
  },
  parties: {
    list: () => get("/parties"),
    create: (data) => post("/parties", data),
    update: (id, data) => put(`/parties/${id}`, data),
    remove: (id) => del(`/parties/${id}`),
  },
  chartOfAccounts: {
    tree: (parentId) => get(`/chart-of-accounts/tree?parentId=${parentId ?? "null"}`),
    search: (q) => get(`/chart-of-accounts/search?q=${encodeURIComponent(q)}`),
    createGroup: (data) => post("/chart-of-accounts/groups", data),
    updateGroup: (id, data) => put(`/chart-of-accounts/groups/${id}`, data),
    removeGroup: (id) => del(`/chart-of-accounts/groups/${id}`),
    createAccount: (data) => post("/chart-of-accounts/accounts", data),
    updateAccount: (id, data) => put(`/chart-of-accounts/accounts/${id}`, data),
    removeAccount: (id) => del(`/chart-of-accounts/accounts/${id}`),
  },
  journalVouchers: {
    list: () => get("/journal-vouchers"),
    get: (id) => get(`/journal-vouchers/${id}`),
    create: (data) => post("/journal-vouchers", data),
    update: (id, data) => put(`/journal-vouchers/${id}`, data),
    remove: (id) => del(`/journal-vouchers/${id}`),
  },
  invoices: {
    list: () => get("/sales-purchase"),
    get: (id) => get(`/sales-purchase/${id}`),
    create: (data) => post("/sales-purchase", data),
    update: (id, data) => put(`/sales-purchase/${id}`, data),
    remove: (id) => del(`/sales-purchase/${id}`),
  },
  system: {
    stats: () => get("/system/stats"),
    errors: () => get("/system/errors"),
  },
  backup: {
    exportUrl: `${BASE}/backup/export`,
    async import(file) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE}/backup/import`, { method: "POST", body: formData, credentials: "include", cache: "no-store" });
      if (!res.ok) {
        let msg = "بازیابی اطلاعات ناموفق بود.";
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch (_) {}
        throw new Error(msg);
      }
      return res.json();
    },
  },
  resetFinancialData: () => del("/backup/reset-financial-data"),
};

// Generic CRUD client for the simple data-entry modules (each backed by a
// createCrudRouter route on the server): list / create / update / remove.
export function crudApi(resource) {
  return {
    list: () => get(`/${resource}`),
    create: (data) => post(`/${resource}`, data),
    update: (id, data) => put(`/${resource}/${id}`, data),
    remove: (id) => del(`/${resource}/${id}`),
  };
}

export const authApi = {
  login: (username, password) => post("/auth/login", { username, password }),
  me: () => get("/auth/me"),
};

export const auditLogApi = { list: (limit=100) => get(`/audit-log?limit=${limit}`) };

export const financialPeriodsApi = {
  list: () => get("/financial-periods"),
  create: (data) => post("/financial-periods", data),
  close: (id) => post(`/financial-periods/${id}/close`, {}),
};

export const accountingSettingsApi = {
  get: () => get("/accounting-settings"),
  update: (data) => put("/accounting-settings", data),
};

export const exchangeRatesApi = {
  get: () => get("/exchange-rates"),
};

export const modayanRemindersApi = {
  list: () => get("/modayan-reminders"),
  dismiss: (id) => put(`/modayan-reminders/${id}/dismiss`, {}),
};

export const productionFormulasApi = {
  list: () => get("/production-formulas"),
  get: (id) => get(`/production-formulas/${id}`),
  create: (data) => post("/production-formulas", data),
  update: (id, data) => put(`/production-formulas/${id}`, data),
  remove: (id) => del(`/production-formulas/${id}`),
};

export const productionRunsApi = {
  list: () => get("/production-runs"),
  get: (id) => get(`/production-runs/${id}`),
  create: (data) => post("/production-runs", data),
  remove: (id) => del(`/production-runs/${id}`),
};

export const stockAdjustmentsApi = {
  list: () => get("/stock-adjustments"),
  get: (id) => get(`/stock-adjustments/${id}`),
  create: (data) => post("/stock-adjustments", data),
  update: (id, data) => put(`/stock-adjustments/${id}`, data),
  remove: (id) => del(`/stock-adjustments/${id}`),
};
