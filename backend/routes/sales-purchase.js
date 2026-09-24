const express=require('express');
const db=require('../db');
const {normalizePersian}=require('../lib/persian');
const {rebuildInventory}=require('../lib/inventoryLedger');
const {money,resolveAccount,postVoucher,deleteSourceVoucher,recomputeBankBalances,assertPeriodOpen}=require('../lib/accounting');
const router=express.Router();

function getInvoiceWithItems(id){
 const invoice=db.prepare(`SELECT i.*,b.name bank_account_name FROM sales_purchase_invoices i LEFT JOIN bank_accounts b ON b.id=i.bank_account_id WHERE i.id=?`).get(id); if(!invoice)return null;
 const items=db.prepare(`SELECT ii.*,n.name item_name,n.unit item_unit,n.code item_code FROM invoice_items ii JOIN inventory_nodes n ON n.id=ii.inventory_item_id WHERE ii.invoice_id=? ORDER BY ii.id`).all(id);
 return {...invoice,items};
}
function settings(){return db.prepare('SELECT * FROM accounting_settings WHERE id=1').get()||{};}
function partyAccount(type,party){
 const row=db.prepare('SELECT legal_status FROM parties WHERE name_normalized=?').get(normalizePersian(party));
 return row?.legal_status==='individual' ? (type==='sale'?'1412':'3202') : (type==='sale'?'1411':'3201');
}
function assertStock(items){for(const it of items){const n=db.prepare('SELECT name,qty_on_hand,unit FROM inventory_nodes WHERE id=?').get(it.inventory_item_id);if(!n)throw new Error('کالای انتخاب‌شده یافت نشد.');if(Number(it.quantity)<=0)throw new Error('تعداد باید بیشتر از صفر باشد.');if(Number(it.quantity)>Number(n.qty_on_hand)+1e-9)throw new Error(`موجودی «${n.name}» کافی نیست (موجودی: ${n.qty_on_hand} ${n.unit||''}).`);}}
function validateInvoiceBody(body){
 const {type,party,invoice_date,items=[]}=body;
 if(!['sale','purchase'].includes(type))throw new Error('نوع فاکتور نامعتبر است.');
 if(!party||!invoice_date||!Array.isArray(items)||!items.length)throw new Error('نوع، طرف حساب، تاریخ و حداقل یک قلم الزامی است.');
 const discount=money(body.discount_amount||0,'تخفیف'); const taxRate=Number(body.tax_rate||0); if(!Number.isFinite(taxRate)||taxRate<0||taxRate>100)throw new Error('نرخ مالیات باید بین صفر تا صد باشد.');
 for(const it of items){if(!Number.isInteger(Number(it.inventory_item_id))||Number(it.inventory_item_id)<=0||!Number.isFinite(Number(it.quantity))||Number(it.quantity)<=0||!Number.isInteger(Number(it.unit_price))||Number(it.unit_price)<0)throw new Error('تعداد و قیمت ردیف‌های فاکتور نامعتبر است.');}
 const subtotal=Math.round(items.reduce((s,it)=>s+Number(it.quantity)*Number(it.unit_price),0)); if(discount>subtotal)throw new Error('تخفیف نمی‌تواند بیشتر از مبلغ ناخالص باشد.');
 const tax=Math.round((subtotal-discount)*taxRate/100); return {subtotal,discount,taxRate,tax,total:Math.round(subtotal-discount+tax)};
}
function deleteInvoiceVoucher(id){deleteSourceVoucher('sales_purchase_invoice',id);}
function maybeReminder(id,type,party){db.prepare('DELETE FROM modayan_reminders WHERE invoice_id=?').run(id);const p=db.prepare('SELECT legal_status FROM parties WHERE name_normalized=?').get(normalizePersian(party));if(!p)return;let reason=null;if(type==='sale'&&p.legal_status==='individual')reason=`فروش به شخص حقیقی «${party}» — بررسی ثبت در سامانه مودیان.`;if(type==='purchase'&&p.legal_status==='legal')reason=`خرید از شخص حقوقی «${party}» — بررسی ثبت در سامانه مودیان.`;if(reason)db.prepare('INSERT INTO modayan_reminders(invoice_id,reason) VALUES(?,?)').run(id,reason);}

function invoiceCogs(invoiceId, costs){const inv=db.prepare('SELECT invoice_kind,type FROM sales_purchase_invoices WHERE id=?').get(invoiceId);if(!inv||inv.type!=='sale')return 0;if(inv.invoice_kind==='return')return Math.round(Number(db.prepare("SELECT COALESCE(SUM(quantity_in*unit_cost),0) v FROM inventory_ledger WHERE source_type='invoice' AND source_id=?").get(invoiceId).v||0));const c=costs.get(invoiceId);return c?Math.round(Array.from(c.values()).reduce((a,b)=>a+b,0)):0;}
function repostAllInvoices(costs){for(const inv of db.prepare('SELECT * FROM sales_purchase_invoices ORDER BY invoice_date,id').all()){postInvoiceGL(inv,invoiceCogs(inv.id,costs));maybeReminder(inv.id,inv.type,inv.party);}}

function postInvoiceGL(inv,cogs){
 const s=settings();
 const moneyAccount=inv.bank_account_id ? db.prepare('SELECT coa_account_id FROM bank_accounts WHERE id=?').get(inv.bank_account_id)?.coa_account_id : null;
 const counterpart=moneyAccount || db.prepare(`SELECT id FROM chart_of_accounts WHERE code=?`).get(partyAccount(inv.type,inv.party))?.id;
 if(!counterpart)throw new Error('حساب طرف حساب/بانک برای ثبت سند پیدا نشد.');
 const salesId=resolveAccount(s.sales_account_id,'6101','فروش');
 const invId=resolveAccount(s.inventory_account_id,'1701','موجودی کالا');
 const cogsId=resolveAccount(s.cogs_account_id,'7307','بهای تمام‌شده');
 const vatId=resolveAccount(s.vat_account_id,'1510','مالیات بر ارزش افزوده');
 const arap=counterpart;
 const desc=`${inv.invoice_kind==='return'?'برگشت ':''}${inv.type==='sale'?'فروش':'خرید'} شماره ${inv.id} — ${inv.party}`;
 const lines=[]; const sign=inv.invoice_kind==='return'?-1:1;
 if(inv.type==='sale'){
   if(sign===1){lines.push({account_id:arap,debit:inv.total_amount,credit:0});lines.push({account_id:salesId,debit:0,credit:inv.subtotal-inv.discount_amount});if(inv.tax_amount)lines.push({account_id:vatId,debit:0,credit:inv.tax_amount});}
   else {lines.push({account_id:salesId,debit:inv.subtotal-inv.discount_amount,credit:0});if(inv.tax_amount)lines.push({account_id:vatId,debit:inv.tax_amount,credit:0});lines.push({account_id:arap,debit:0,credit:inv.total_amount});}
   const cost=Number(cogs||0);if(cost){if(sign===1){lines.push({account_id:cogsId,debit:cost,credit:0});lines.push({account_id:invId,debit:0,credit:cost});}else{lines.push({account_id:invId,debit:cost,credit:0});lines.push({account_id:cogsId,debit:0,credit:cost});}}
 } else {
   if(sign===1){lines.push({account_id:invId,debit:inv.subtotal-inv.discount_amount,credit:0});if(inv.tax_amount)lines.push({account_id:vatId,debit:inv.tax_amount,credit:0});lines.push({account_id:arap,debit:0,credit:inv.total_amount});}
   else {lines.push({account_id:arap,debit:inv.total_amount,credit:0});lines.push({account_id:invId,debit:0,credit:inv.subtotal-inv.discount_amount});if(inv.tax_amount)lines.push({account_id:vatId,debit:0,credit:inv.tax_amount});}
 }
 return postVoucher({date:inv.invoice_date,description:desc,sourceType:'sales_purchase_invoice',sourceId:inv.id,lines});
}

router.get('/',(req,res)=>res.json(db.prepare(`SELECT i.*,b.name bank_account_name,(SELECT COUNT(*) FROM invoice_items WHERE invoice_id=i.id) item_count FROM sales_purchase_invoices i LEFT JOIN bank_accounts b ON b.id=i.bank_account_id ORDER BY i.id DESC`).all()));
router.get('/:id',(req,res)=>{const x=getInvoiceWithItems(req.params.id);if(!x)return res.status(404).json({error:'not found'});res.json(x);});

router.post('/',(req,res)=>{try{
 const body=req.body; const calc=validateInvoiceBody(body); assertPeriodOpen(body.invoice_date); if(body.invoice_kind==='return'&& !body.original_invoice_id)throw new Error('برای برگشت، فاکتور اصلی الزامی است.');
 if(body.invoice_kind==='return'){const orig=db.prepare('SELECT * FROM sales_purchase_invoices WHERE id=?').get(body.original_invoice_id);if(!orig||orig.type!==body.type||orig.invoice_kind==='return'||normalizePersian(orig.party)!==normalizePersian(body.party))throw new Error('فاکتور اصلی برگشت معتبر نیست یا طرف حساب آن متفاوت است.');for(const it of body.items){const origLine=db.prepare('SELECT COALESCE(SUM(quantity),0) q FROM invoice_items WHERE invoice_id=? AND inventory_item_id=?').get(orig.id,it.inventory_item_id);if(!origLine.q)throw new Error('کالای برگشتی در فاکتور اصلی وجود ندارد.');const returned=db.prepare(`SELECT COALESCE(SUM(ii.quantity),0) q FROM invoice_items ii JOIN sales_purchase_invoices r ON r.id=ii.invoice_id WHERE r.original_invoice_id=? AND r.invoice_kind='return' AND r.id<>? AND ii.inventory_item_id=?`).get(orig.id,0,it.inventory_item_id);if(Number(it.quantity)+Number(returned.q)>Number(origLine.q)+1e-9)throw new Error('مقدار برگشتی بیشتر از مقدار فاکتور اصلی است.');}}
 if((body.type==='sale'&&body.invoice_kind!=='return')||(body.type==='purchase'&&body.invoice_kind==='return'))assertStock(body.items);
 const tx=db.transaction(()=>{
   const info=db.prepare(`INSERT INTO sales_purchase_invoices(type,party,invoice_date,bank_account_id,total_amount,description,invoice_kind,original_invoice_id,subtotal,discount_amount,tax_rate,tax_amount) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(body.type,body.party,body.invoice_date,body.bank_account_id||null,calc.total,body.description||'',body.invoice_kind||'normal',body.original_invoice_id||null,calc.subtotal,calc.discount,calc.taxRate,calc.tax);
   const id=Number(info.lastInsertRowid);const ins=db.prepare('INSERT INTO invoice_items(invoice_id,inventory_item_id,quantity,unit_price,line_total) VALUES(?,?,?,?,?)');for(const it of body.items)ins.run(id,it.inventory_item_id,it.quantity,it.unit_price,Number(it.quantity)*Number(it.unit_price));
   if(body.invoice_kind==='return'&&body.original_invoice_id)db.prepare(`INSERT INTO invoice_links(invoice_id,linked_invoice_id,relation_type) VALUES(?,?,?)`).run(id,body.original_invoice_id,'return_of');
   const costs=rebuildInventory(); repostAllInvoices(costs); recomputeBankBalances();return id;
 });
 res.status(201).json(getInvoiceWithItems(tx()));
 }catch(e){res.status(400).json({error:e.message});}});

router.put('/:id',(req,res)=>{try{
 const existing=db.prepare('SELECT * FROM sales_purchase_invoices WHERE id=?').get(req.params.id);if(!existing)return res.status(404).json({error:'not found'});const body=req.body;const calc=validateInvoiceBody(body);assertPeriodOpen(body.invoice_date);if(body.invoice_kind==='return'){const orig=db.prepare('SELECT * FROM sales_purchase_invoices WHERE id=?').get(body.original_invoice_id);if(!orig||orig.type!==body.type||orig.invoice_kind==='return'||normalizePersian(orig.party)!==normalizePersian(body.party))throw new Error('فاکتور اصلی برگشت معتبر نیست یا طرف حساب آن متفاوت است.');for(const it of body.items){const origLine=db.prepare('SELECT COALESCE(SUM(quantity),0) q FROM invoice_items WHERE invoice_id=? AND inventory_item_id=?').get(orig.id,it.inventory_item_id);const returned=db.prepare(`SELECT COALESCE(SUM(ii.quantity),0) q FROM invoice_items ii JOIN sales_purchase_invoices r ON r.id=ii.invoice_id WHERE r.original_invoice_id=? AND r.invoice_kind='return' AND r.id<>? AND ii.inventory_item_id=?`).get(orig.id,req.params.id,it.inventory_item_id);if(!origLine.q||Number(it.quantity)+Number(returned.q)>Number(origLine.q)+1e-9)throw new Error('مقدار برگشتی بیشتر از مقدار فاکتور اصلی است.');}}if((body.type==='sale'&&body.invoice_kind!=='return')||(body.type==='purchase'&&body.invoice_kind==='return'))assertStock(body.items);
 const tx=db.transaction(()=>{
  deleteInvoiceVoucher(existing.id);db.prepare('DELETE FROM invoice_items WHERE invoice_id=?').run(existing.id);db.prepare('DELETE FROM invoice_links WHERE invoice_id=?').run(existing.id);
  db.prepare(`UPDATE sales_purchase_invoices SET type=?,party=?,invoice_date=?,bank_account_id=?,total_amount=?,description=?,invoice_kind=?,original_invoice_id=?,subtotal=?,discount_amount=?,tax_rate=?,tax_amount=? WHERE id=?`).run(body.type,body.party,body.invoice_date,body.bank_account_id||null,calc.total,body.description||'',body.invoice_kind||'normal',body.original_invoice_id||null,calc.subtotal,calc.discount,calc.taxRate,calc.tax,existing.id);
  const ins=db.prepare('INSERT INTO invoice_items(invoice_id,inventory_item_id,quantity,unit_price,line_total) VALUES(?,?,?,?,?)');for(const it of body.items)ins.run(existing.id,it.inventory_item_id,it.quantity,it.unit_price,Number(it.quantity)*Number(it.unit_price));
  if(body.invoice_kind==='return'&&body.original_invoice_id)db.prepare(`INSERT INTO invoice_links(invoice_id,linked_invoice_id,relation_type) VALUES(?,?,?)`).run(existing.id,body.original_invoice_id,'return_of');
  const costs=rebuildInventory(); repostAllInvoices(costs); recomputeBankBalances();
 });tx();res.json(getInvoiceWithItems(existing.id));
 }catch(e){res.status(400).json({error:e.message});}});
router.delete('/:id',(req,res)=>{try{const inv=db.prepare('SELECT * FROM sales_purchase_invoices WHERE id=?').get(req.params.id);if(!inv)return res.status(404).json({error:'not found'});assertPeriodOpen(inv.invoice_date);const tx=db.transaction(()=>{deleteInvoiceVoucher(inv.id);db.prepare('DELETE FROM sales_purchase_invoices WHERE id=?').run(inv.id);const costs=rebuildInventory();repostAllInvoices(costs);recomputeBankBalances();});tx();res.status(204).end();}catch(e){res.status(400).json({error:e.message});}});
module.exports=router;
