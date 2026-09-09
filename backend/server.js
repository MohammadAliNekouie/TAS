const path = require("path");
const express = require("express");
const cors = require("cors");
const errorLog = require("./lib/errorLog");
const terminalLog = require("./lib/terminalLog");

// Every console.log/console.error call anywhere in the backend gets
// captured into two places: the full raw history goes to a rolling
// 1000-line debug file (terminalLog — for troubleshooting only, never
// shown in the UI); console.error specifically also feeds the small
// in-memory list the dashboard's "recent errors" panel reads from.
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);

console.log = (...args) => {
  originalConsoleLog(...args);
  terminalLog.write("log", args);
};

console.error = (...args) => {
  originalConsoleError(...args);
  terminalLog.write("error", args);
  try {
    errorLog.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
  } catch (_) {
    // never let logging itself crash the process
  }
};

process.on("uncaughtException", (err) => {
  console.error("\n❌ Backend crashed with an uncaught exception:\n", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("\n❌ Backend crashed with an unhandled promise rejection:\n", err);
  process.exit(1);
});

const dashboardRoutes = require("./routes/dashboard");
const inventoryRoutes = require("./routes/inventory");
const salesPurchaseRoutes = require("./routes/sales-purchase");
const receiptsPaymentsRoutes = require("./routes/receipts-payments");
const chequesRoutes = require("./routes/cheques");
const pettyCashRoutes = require("./routes/petty-cash");
const multiCurrencyRoutes = require("./routes/multi-currency");
const productionRoutes = require("./routes/production");
const modayanRoutes = require("./routes/modayan");
const reportsRoutes = require("./routes/reports");
const companyRoutes = require("./routes/company");
const bankAccountsRoutes = require("./routes/bank-accounts");
const partiesRoutes = require("./routes/parties");
const warehousesRoutes = require("./routes/warehouses");
const systemRoutes = require("./routes/system");
const backupRoutes = require("./routes/backup");
const chartOfAccountsRoutes = require("./routes/chart-of-accounts");
const journalVouchersRoutes = require("./routes/journal-vouchers");
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const accountingSettingsRoutes = require("./routes/accounting-settings");
const exchangeRatesRoutes = require("./routes/exchange-rates");
const modayanRemindersRoutes = require("./routes/modayan-reminders");
const productionFormulasRoutes = require("./routes/production-formulas");
const productionRunsRoutes = require("./routes/production-runs");
const stockAdjustmentsRoutes = require("./routes/stock-adjustments");
const exchangeRates = require("./lib/exchangeRates");
const { requireAuth, blockViewerWrites, requireAdmin } = require("./lib/authMiddleware");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);

// Everything below requires a valid login. blockViewerWrites additionally
// stops the 'viewer' role from mutating anything, enforced server-side
// (not just hidden in the UI).
app.use("/api", requireAuth, blockViewerWrites);

app.use("/api/users", usersRoutes); // requireAdmin is applied inside this router
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales-purchase", salesPurchaseRoutes);
app.use("/api/receipts-payments", receiptsPaymentsRoutes);
app.use("/api/cheques", chequesRoutes);
app.use("/api/petty-cash", pettyCashRoutes);
app.use("/api/multi-currency", multiCurrencyRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/modayan", modayanRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/bank-accounts", bankAccountsRoutes);
app.use("/api/parties", partiesRoutes);
app.use("/api/warehouses", warehousesRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/backup", requireAdmin, backupRoutes); // export/import/wipe: admin only
app.use("/api/chart-of-accounts", chartOfAccountsRoutes);
app.use("/api/journal-vouchers", journalVouchersRoutes);
app.use("/api/accounting-settings", accountingSettingsRoutes);
app.use("/api/exchange-rates", exchangeRatesRoutes);
app.use("/api/modayan-reminders", modayanRemindersRoutes);
app.use("/api/production-formulas", productionFormulasRoutes);
app.use("/api/production-runs", productionRunsRoutes);
app.use("/api/stock-adjustments", stockAdjustmentsRoutes);

// In production, serve the built React app from ../frontend/dist
const frontendDist = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(frontendDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) next();
  });
});

// Catch-all JSON error handler: anything thrown (or passed to next(err))
// by a route ends up here instead of Express's default HTML error page,
// so the frontend's fetch wrapper can always parse an { error } message.
app.use((err, req, res, next) => {
  console.error(err.message || err);
  res.status(500).json({ error: err.message || "خطای غیرمنتظره‌ای در سرور رخ داد." });
});

const server = app.listen(PORT, () => {
  console.log(`✅ Accounting backend running on http://localhost:${PORT}`);
  exchangeRates.start();
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} is already in use by another process.`);
    console.error(`   Either stop whatever is using it, or run with a different port:`);
    console.error(`     PORT=4001 npm run start   (and update frontend/vite.config.js proxy target to match)\n`);
  } else {
    console.error("\n❌ Backend failed to start:\n", err);
  }
  process.exit(1);
});
