const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/summary", (req, res) => {
  const sumWhere = (table, col, whereCol, whereVal) =>
    db.prepare(`SELECT COALESCE(SUM(${col}), 0) AS total FROM ${table} WHERE ${whereCol} = ?`).get(whereVal).total;

  const totalSales = sumWhere("sales_purchase_invoices", "total_amount", "type", "sale");
  const totalPurchases = sumWhere("sales_purchase_invoices", "total_amount", "type", "purchase");
  const totalReceipts = sumWhere("receipts_payments", "amount", "type", "receipt");
  const totalPayments = sumWhere("receipts_payments", "amount", "type", "payment");
  const totalPettyTopup = sumWhere("petty_cash", "amount", "type", "topup");
  const totalPettyExpense = sumWhere("petty_cash", "amount", "type", "expense");
  const chequesOutstanding = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM cheques WHERE status != 'وصول شده'")
    .get().total;
  const productionOrderCount = db.prepare("SELECT COUNT(*) AS c FROM production_orders").get().c;
  const modayanPending = db
    .prepare("SELECT COUNT(*) AS c FROM modayan_submissions WHERE status NOT IN ('تایید شده')")
    .get().c;

  res.json({
    totalSales,
    totalPurchases,
    grossMargin: totalSales - totalPurchases,
    totalReceipts,
    totalPayments,
    netCashFlow: totalReceipts - totalPayments,
    pettyCashBalance: totalPettyTopup - totalPettyExpense,
    chequesOutstanding,
    productionOrderCount,
    modayanPending,
  });
});

// GL group codes: 1=دارایی جاری 2=دارایی غیرجاری 3=بدهی جاری 4=بدهی بلندمدت
// 5=حقوق صاحبان سهام 6=درآمدها 7=هزینه‌ها 9=انتظامی (excluded from statements)
function accountBalances() {
  return db
    .prepare(
      `SELECT a.id, a.code, a.name, g.code AS group_code, g.name AS group_name,
              COALESCE(SUM(l.debit), 0) AS total_debit, COALESCE(SUM(l.credit), 0) AS total_credit
       FROM chart_of_accounts a
       JOIN chart_of_accounts g2 ON g2.id = a.parent_id
       JOIN chart_of_accounts g ON g.id = g2.parent_id
       LEFT JOIN journal_voucher_lines l ON l.account_id = a.id
       WHERE a.level = 3
       GROUP BY a.id
       HAVING total_debit != 0 OR total_credit != 0
       ORDER BY a.code`
    )
    .all();
}

// GET /api/reports/trial-balance -> every account with any activity, its
// total debit/credit, and net balance (debit-side groups net debit-positive,
// credit-side groups net credit-positive).
router.get("/trial-balance", (req, res) => {
  const rows = accountBalances().map((r) => ({
    ...r,
    balance: r.total_debit - r.total_credit,
  }));
  res.json(rows);
});

// GET /api/reports/income-statement -> revenue (group 6) minus expenses
// (group 7), for a real (if simplified) P&L.
router.get("/income-statement", (req, res) => {
  const rows = accountBalances();
  const revenue = rows.filter((r) => r.group_code === "6");
  const expenses = rows.filter((r) => r.group_code === "7");
  const totalRevenue = revenue.reduce((s, r) => s + (r.total_credit - r.total_debit), 0);
  const totalExpenses = expenses.reduce((s, r) => s + (r.total_debit - r.total_credit), 0);
  res.json({
    revenue: revenue.map((r) => ({ code: r.code, name: r.name, amount: r.total_credit - r.total_debit })),
    expenses: expenses.map((r) => ({ code: r.code, name: r.name, amount: r.total_debit - r.total_credit })),
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
  });
});

// GET /api/reports/balance-sheet -> assets (1,2) vs liabilities (3,4) +
// equity (5), plus current-period net income folded into equity so the
// sheet actually balances without a separate period-close step.
router.get("/balance-sheet", (req, res) => {
  const rows = accountBalances();
  const pick = (codes) => rows.filter((r) => codes.includes(r.group_code));

  const assets = pick(["1", "2"]).map((r) => ({ code: r.code, name: r.name, amount: r.total_debit - r.total_credit }));
  const liabilities = pick(["3", "4"]).map((r) => ({ code: r.code, name: r.name, amount: r.total_credit - r.total_debit }));
  const equity = pick(["5"]).map((r) => ({ code: r.code, name: r.name, amount: r.total_credit - r.total_debit }));

  const revenue = rows.filter((r) => r.group_code === "6").reduce((s, r) => s + (r.total_credit - r.total_debit), 0);
  const expenses = rows.filter((r) => r.group_code === "7").reduce((s, r) => s + (r.total_debit - r.total_credit), 0);
  const netIncome = revenue - expenses;

  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0) + netIncome;

  res.json({
    assets, liabilities, equity,
    currentPeriodNetIncome: netIncome,
    totalAssets, totalLiabilities, totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
  });
});

module.exports = router;
