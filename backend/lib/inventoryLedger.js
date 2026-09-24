const db = require('../db');

function rebuildInventory() {
  const itemIds = db.prepare("SELECT id FROM inventory_nodes WHERE level = 3").all().map(r => r.id);
  const results = new Map();
  const insertLedger = db.prepare('INSERT INTO inventory_ledger(item_id,event_date,source_type,source_id,quantity_in,quantity_out,unit_cost) VALUES(?,?,?,?,?,?,?)');

  for (const itemId of itemIds) {
    const events=[];
    const saleCostByInvoiceItem=new Map();
    db.prepare(`SELECT i.invoice_date date,i.id source_id,'invoice' source_type,i.type,i.invoice_kind,i.original_invoice_id,ii.id item_line_id,ii.quantity,ii.unit_price
      FROM invoice_items ii JOIN sales_purchase_invoices i ON i.id=ii.invoice_id WHERE ii.inventory_item_id=?`).all(itemId)
      .forEach(r=>events.push({date:r.date,id:r.source_id,order:1,qty:Number(r.quantity),type:r.type,kind:r.invoice_kind||'normal',originalId:r.original_invoice_id,itemLineId:r.item_line_id,unitCost:Number(r.unit_price)}));
    db.prepare(`SELECT a.adjustment_date date,a.id source_id,'adjustment' source_type,a.direction type,ai.quantity,COALESCE(ai.unit_cost,0) unit_price
      FROM stock_adjustment_items ai JOIN stock_adjustments a ON a.id=ai.adjustment_id WHERE ai.item_id=?`).all(itemId)
      .forEach(r=>events.push({date:r.date,id:r.source_id,order:2,qty:Number(r.quantity),type:r.type==='in'?'adjustment_in':'adjustment_out',unitCost:Number(r.unit_price)}));
    db.prepare(`SELECT r.run_date date,r.id source_id,'production_component' source_type,rc.quantity,rc.unit_price
      FROM production_run_components rc JOIN production_runs r ON r.id=rc.run_id WHERE rc.item_id=?`).all(itemId)
      .forEach(r=>events.push({date:r.date,id:r.source_id,order:3,qty:Number(r.quantity),type:'production_out',unitCost:Number(r.unit_price)}));
    db.prepare(`SELECT r.run_date date,r.id source_id,'production_output' source_type,r.quantity,r.unit_cost
      FROM production_runs r JOIN production_formulas f ON f.id=r.formula_id WHERE f.output_item_id=?`).all(itemId)
      .forEach(r=>events.push({date:r.date,id:r.source_id,order:4,qty:Number(r.quantity),type:'production_in',unitCost:Number(r.unit_cost)}));
    events.sort((a,b)=>String(a.date).localeCompare(String(b.date)) || a.id-b.id || a.order-b.order);
    db.prepare('DELETE FROM inventory_ledger WHERE item_id=?').run(itemId);
    let qty=0,avg=0; const saleCosts=new Map();
    for(const e of events){
      if(e.qty<=0 || !Number.isFinite(e.qty)) continue;
      if(e.type==='sale' && e.kind==='return') {
        // A sales return restores inventory at the historical COGS of the original sale.
        let originalCost=avg;
        const orig=db.prepare(`SELECT id,quantity FROM invoice_items WHERE invoice_id=? AND inventory_item_id=? ORDER BY id LIMIT 1`).get(e.originalId,itemId);
        if(orig && saleCostByInvoiceItem.has(orig.id)) originalCost=saleCostByInvoiceItem.get(orig.id);
        const cost=originalCost||avg; const value=qty*avg+e.qty*cost; qty+=e.qty; avg=qty>0?value/qty:0;
        insertLedger.run(itemId,e.date,'invoice',e.id,e.qty,0,cost); continue;
      }
      if(e.type==='purchase' && e.kind==='return') {
        const cost=Number(e.unitCost)||avg; qty-=e.qty;
        if(qty < -1e-8) throw new Error(`موجودی کالا در تاریخ ${e.date} برای کالا ${itemId} منفی می‌شود.`);
        insertLedger.run(itemId,e.date,'invoice',e.id,0,e.qty,cost); if(Math.abs(qty)<1e-8){qty=0;avg=0;} continue;
      }
      if(e.type==='sale' || e.type==='production_out' || e.type==='adjustment_out') {
        const cost=avg; qty-=e.qty;
        if(e.type==='sale') { saleCosts.set(e.id,(saleCosts.get(e.id)||0)+e.qty*cost); const origLine=db.prepare('SELECT id FROM invoice_items WHERE invoice_id=? AND inventory_item_id=? ORDER BY id LIMIT 1').get(e.id,itemId); if(origLine) saleCostByInvoiceItem.set(origLine.id,cost); }
        if(qty < -1e-8) throw new Error(`موجودی کالا در تاریخ ${e.date} برای کالا ${itemId} منفی می‌شود.`);
        insertLedger.run(itemId,e.date,e.source_type,e.id,0,e.qty,cost);
      } else {
        const cost=e.unitCost||avg; const value=qty*avg+e.qty*cost; qty+=e.qty; avg=qty>0?value/qty:0;
        insertLedger.run(itemId,e.date,e.source_type,e.id,e.qty,0,cost);
      }
      if(Math.abs(qty)<1e-8){qty=0;avg=0;}
    }
    db.prepare('UPDATE inventory_nodes SET qty_on_hand=?,avg_cost=? WHERE id=?').run(qty,avg,itemId);
    results.set(itemId,saleCosts);
  }
  return results;
}
module.exports={rebuildInventory};
