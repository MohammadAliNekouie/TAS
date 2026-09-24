import React from "react";
import { Routes, Route } from "react-router-dom";
import AppLayout from "./layout/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inventory from "./pages/Inventory.jsx";
import SalesPurchase from "./pages/SalesPurchase.jsx";
import ReceiptsPayments from "./pages/ReceiptsPayments.jsx";
import Cheques from "./pages/Cheques.jsx";
import PettyCash from "./pages/PettyCash.jsx";
import MultiCurrency from "./pages/MultiCurrency.jsx";
import Production from "./pages/Production.jsx";
import Modayan from "./pages/Modayan.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import Parties from "./pages/Parties.jsx";
import ChartOfAccounts from "./pages/ChartOfAccounts.jsx";
import JournalVouchers from "./pages/JournalVouchers.jsx";
import Users from "./pages/Users.jsx";
import ProductionFormulas from "./pages/ProductionFormulas.jsx";
import ProductionRuns from "./pages/ProductionRuns.jsx";
import StockAdjustments from "./pages/StockAdjustments.jsx";
import FinancialPeriods from "./pages/FinancialPeriods.jsx";
import AuditLog from "./pages/AuditLog.jsx";
import AppErrorBoundary from "./components/AppErrorBoundary.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/warehouse" element={<Inventory />} />
        <Route path="/sales-purchase" element={<SalesPurchase />} />
        <Route path="/receipts-payments" element={<ReceiptsPayments />} />
        <Route path="/cheques" element={<Cheques />} />
        <Route path="/petty-cash" element={<PettyCash />} />
        <Route path="/multi-currency" element={<MultiCurrency />} />
        <Route path="/production" element={<Production />} />
        <Route path="/production-formulas" element={<ProductionFormulas />} />
        <Route path="/production-runs" element={<ProductionRuns />} />
        <Route path="/stock-adjustments" element={<StockAdjustments />} />
        <Route path="/modayan" element={<Modayan />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/parties" element={<Parties />} />
        <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
        <Route path="/journal-vouchers" element={<JournalVouchers />} />
        <Route path="/financial-periods" element={<AppErrorBoundary><FinancialPeriods /></AppErrorBoundary>} />
        <Route path="/audit-log" element={<AuditLog />} />
        <Route path="/users" element={<Users />} />
      </Route>
    </Routes>
  );
}
