const db = require('../db');

function money(value, label = 'مبلغ') {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error(`${label} باید یک عدد صحیح و غیرمنفی بر حسب ریال باشد.`);
  return n;
}

function positiveMoney(value, label = 'مبلغ') {
  const n = money(value, label);
  if (n <= 0) throw new Error(`${label} باید بیشتر از صفر باشد.`);
  return n;
}

function getSettings() { return db.prepare('SELECT * FROM accounting_settings WHERE id=1').get() || {}; }

function accountByCode(code) { return db.prepare('SELECT id,code,name FROM chart_of_accounts WHERE code=?').get(code); }

function requireAccount(id, label) {
  if (!id) throw new Error(`حساب ${label} تنظیم نشده است.`);
  const row = db.prepare('SELECT id,code,name FROM chart_of_accounts WHERE id=?').get(id);
  if (!row) throw new Error(`حساب ${label} یافت نشد.`);
  return row.id;
}

function resolveAccount(id, fallbackCode, label) {
  return requireAccount(id || accountByCode(fallbackCode)?.id, label);
}

function assertPeriodOpen(date) {
  const periods = db.prepare('SELECT * FROM financial_periods ORDER BY start_date').all();
  if (!periods.length) return;
  const p = periods.find(x => String(date) >= String(x.start_date) && String(date) <= String(x.end_date));
  if (!p) throw new Error(`تاریخ ${date} داخل هیچ دوره مالی تعریف‌شده‌ای نیست.`);
  if (p.status === 'closed') throw new Error(`دوره مالی «${p.name}» بسته است و ثبت/ویرایش مالی در آن مجاز نیست.`);
}

function postVoucher({date, description, sourceType, sourceId, lines}) {
  assertPeriodOpen(date);
  if (!Array.isArray(lines) || lines.length < 2) throw new Error('سند حسابداری باید حداقل دو ردیف داشته باشد.');
  let d=0,c=0;
  for (const l of lines) {
    const debit=money(l.debit||0,'بدهکار'); const credit=money(l.credit||0,'بستانکار');
    if ((debit>0 && credit>0) || (debit===0 && credit===0)) throw new Error('هر ردیف سند باید دقیقاً یکی از بدهکار یا بستانکار را داشته باشد.');
    requireAccount(l.account_id, 'انتخاب‌شده'); d+=debit; c+=credit;
  }
  if (d!==c) throw new Error(`سند تراز نیست: بدهکار ${d} و بستانکار ${c}.`);
  if (sourceType && sourceId != null) db.prepare('DELETE FROM journal_vouchers WHERE source_type=? AND source_id=?').run(sourceType, sourceId);
  const info=db.prepare(`INSERT INTO journal_vouchers(voucher_date,description,status,source_type,source_id) VALUES(?,?,\'permanent\',?,?)`).run(date,description||'',sourceType||null,sourceId||null);
  const ins=db.prepare('INSERT INTO journal_voucher_lines(voucher_id,account_id,debit,credit,description) VALUES(?,?,?,?,?)');
  for(const l of lines) ins.run(info.lastInsertRowid,l.account_id,money(l.debit||0),money(l.credit||0),l.description||description||'');
  return Number(info.lastInsertRowid);
}

function deleteSourceVoucher(sourceType, sourceId) { db.prepare('DELETE FROM journal_vouchers WHERE source_type=? AND source_id=?').run(sourceType, sourceId); }

function recomputeBankBalances() {
  const banks=db.prepare('SELECT id,initial_balance FROM bank_accounts').all();
  const tx=db.prepare(`SELECT bank_account_id,type,total_amount FROM sales_purchase_invoices WHERE bank_account_id IS NOT NULL`).all();
  const rp=db.prepare(`SELECT bank_account_id,type,amount FROM receipts_payments WHERE bank_account_id IS NOT NULL`).all();
  const settled=db.prepare(`SELECT bank_account_id,type,amount FROM cheques WHERE bank_account_id IS NOT NULL AND status IN ('وصول شده','پرداخت شده')`).all();
  const totals=new Map(banks.map(b=>[b.id,Number(b.initial_balance)||0]));
  for(const r of tx){const sign=r.type==='sale'?1:-1; totals.set(r.bank_account_id,(totals.get(r.bank_account_id)||0)+sign*Number(r.total_amount));}
  for(const r of rp){const sign=r.type==='receipt'?1:-1; totals.set(r.bank_account_id,(totals.get(r.bank_account_id)||0)+sign*Number(r.amount));}
  for(const r of settled){const sign=r.type==='received'?1:-1; totals.set(r.bank_account_id,(totals.get(r.bank_account_id)||0)+sign*Number(r.amount));}
  const up=db.prepare('UPDATE bank_accounts SET current_balance=? WHERE id=?');
  for(const [id,balance] of totals) up.run(balance,id);
}

module.exports={money,positiveMoney,getSettings,accountByCode,resolveAccount,assertPeriodOpen,postVoucher,deleteSourceVoucher,recomputeBankBalances};
