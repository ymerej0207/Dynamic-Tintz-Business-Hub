/* Dynamic Tintz Reports — pure calculations; no mutations to existing records. */
export const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const cents = value => Math.round((value+Number.EPSILON)*100)/100;
export const currency = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n(value));
export function dateOf(value){if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d)}const d=new Date(value);return Number.isFinite(d.getTime())?d:null}
export function cycleAt(value=new Date(), day=7){
  const d=dateOf(value)||new Date(), b=Math.min(28,Math.max(1,Number(day)||7));
  const m=d.getDate()>=b?d.getMonth():d.getMonth()-1;
  const start=new Date(d.getFullYear(),m,b,0,0,0,0);
  const end=new Date(d.getFullYear(),m+1,b,0,0,0,0);
  return {start,end};
}
export function monthAt(value=new Date()){
  const d=dateOf(value)||new Date();return {start:new Date(d.getFullYear(),d.getMonth(),1),end:new Date(d.getFullYear(),d.getMonth()+1,1)};
}
export function within(value,r){const d=dateOf(value);return !!d && d>=r.start && d<r.end}
export function sourceOf(lead){return String((lead?.source==='organic'?lead?.source_detail||'Organic':lead?.source)||'Unknown').trim()||'Unknown'}
export function angi(lead){return /angi/i.test(sourceOf(lead))}
export function feeOf(lead){
 const raw=lead?.raw_payload||{},meta=raw?._dynamicTintzMetadata||{};
 const candidates=[meta.fee,raw.fee,lead?.lead_cost,lead?.lead_fee];
 for(const v of candidates){if(v!==null&&v!==undefined&&String(v).trim()!==''){const k=Number(String(v).replace(/[$,\s]/g,''));if(Number.isFinite(k)&&k>=0)return k}}
 const found=String(lead?.original_message||'').match(/Lead Fee:\s*\$?([\d,.]+)/i);
 return found?Math.max(0,n(found[1].replace(/,/g,''))):0;
}
export const leadReceived=lead=>lead?.received_at||lead?.created_at;
export function uniqueLeads(leads){
 const seen=new Set();return (leads||[]).filter(l=>{
   const source=sourceOf(l).toLowerCase(), key=l?.external_lead_id?source+':'+l.external_lead_id:'id:'+l.id;
   if(seen.has(key))return false;seen.add(key);return true;
 });
}
export function budgetUsage(leads,range,cash=550,credit=750){
 const rows=uniqueLeads(leads).filter(l=>angi(l)&&within(leadReceived(l),range));
 const creditsUsed=cents(rows.reduce((s,l)=>s+feeOf(l),0)); const cashSpend=n(cash),target=n(credit);
 return {rows,count:rows.length,creditsUsed,creditsRemaining:cents(Math.max(0,target-creditsUsed)),usagePct:target>0?100*creditsUsed/target:0,cashSpend,creditTarget:target,effectiveRatio:target>0?cashSpend/target:0};
}
export function reportPeriod(mode,reference=new Date(),billingDay=7){
 if(mode==='month')return monthAt(reference);
 if(mode==='previous'){const r=cycleAt(reference,billingDay);return cycleAt(new Date(r.start.getTime()-86400000),billingDay)}
 if(mode==='six'){const r=cycleAt(reference,billingDay);return {start:new Date(r.start.getFullYear(),r.start.getMonth()-5,r.start.getDate()),end:r.end}}
 return cycleAt(reference,billingDay);
}
export function cycleCount(range,billingDay=7){
 let count=0,cur=cycleAt(range.start,billingDay).start;
 while(cur<range.end&&count<240){count++;cur=new Date(cur.getFullYear(),cur.getMonth()+1,billingDay)}
 return count;
}
export function buildReport({leads=[],quotes=[],jobs=[],expenses=[],settings={},range,mode='cycle'}){
 const cleanLeads=uniqueLeads(leads),day=n(settings.billing_day)||7,cash=n(settings.monthly_cash_spend??550),credit=n(settings.monthly_credit_value??750);
 const periodLeads=cleanLeads.filter(l=>within(leadReceived(l),range)),angiUsage=budgetUsage(cleanLeads,range,cash,credit);
 const counts=mode==='month'?1:mode==='six'?6:1;
 const advertisedCash=mode==='month'?cash:cash*counts;
 const quoteMap=new Map(quotes.map(q=>[String(q.id),q]));
 const leadsByCustomer=new Map();
 for(const l of cleanLeads){if(!l.customer_id)continue;const id=String(l.customer_id),existing=leadsByCustomer.get(id);if(!existing||dateOf(leadReceived(l))<dateOf(leadReceived(existing)))leadsByCustomer.set(id,l)}
 const completed=(jobs||[]).filter(j=>String(j.status).toLowerCase()==='completed' && String(j.appointment_type||'').toLowerCase()!=='estimate');
 const allCompletedQuoteIds=new Set(completed.map(j=>String(j.quote_id||'')).filter(Boolean));
 const completedJobs=completed.filter(j=>within(j.updated_at||j.scheduled_end||j.created_at,range));
 // Count completed revenue once per quote within the selected period, even if duplicate job rows exist.
 const completedUnique=new Map();for(const j of completedJobs){const key=j.quote_id?'quote:'+j.quote_id:'job:'+j.id;if(!completedUnique.has(key))completedUnique.set(key,j)}
 const revenueJobs=[...completedUnique.values()].map(j=>{
   const q=quoteMap.get(String(j.quote_id)),lead=q?.customer_id?leadsByCustomer.get(String(q.customer_id)):null;
   const source=lead?sourceOf(lead):(q?.customer?.lead_source||'Unattributed');
   return {job:j,quote:q,lead,source,amount:Math.max(0,n(q?.ceramic_price)),customer: [q?.customer?.first_name,q?.customer?.last_name].filter(Boolean).join(' ')||q?.project_name||j.title||'Job',leadFaceCost:lead&&angi(lead)?feeOf(lead):0};
 });
 const revenue=cents(revenueJobs.reduce((s,r)=>s+r.amount,0));
 const wonCustomers=new Set();
 for(const l of periodLeads){if(['approved','deposit_paid','scheduled','completed'].includes(String(l.status||'').toLowerCase()))wonCustomers.add(String(l.customer_id||l.id));}
 for(const j of completed){const q=quoteMap.get(String(j.quote_id));if(!q?.customer_id)continue;const l=leadsByCustomer.get(String(q.customer_id));if(l&&within(leadReceived(l),range))wonCustomers.add(String(l.customer_id||l.id));}
 const wonCount=wonCustomers.size;
 const periodExpenses=(expenses||[]).filter(e=>within(e.expense_date,range));
 const expenseTotal=cents(periodExpenses.reduce((s,e)=>s+n(e.amount),0));
 const assignedCosts=periodExpenses.filter(e=>e.quote_id).reduce((s,e)=>s+n(e.amount),0);
 const sourceMap=new Map();
 for(const l of periodLeads){const k=sourceOf(l);if(!sourceMap.has(k))sourceMap.set(k,{source:k,leads:0,won:0,revenue:0});sourceMap.get(k).leads++}
 for(const r of revenueJobs){if(!sourceMap.has(r.source))sourceMap.set(r.source,{source:r.source,leads:0,won:0,revenue:0});const row=sourceMap.get(r.source);row.won++;row.revenue+=r.amount}
 const sources=[...sourceMap.values()].sort((a,b)=>b.revenue-a.revenue||b.leads-a.leads);
 const quotedCustomers=new Set(quotes.filter(q=>within(q.created_at,range)).map(q=>String(q.customer_id||q.id)));
 const quoteSentCustomers=new Set(quotes.filter(q=>within(q.created_at,range)&&['quote sent','approved','scheduled','completed'].includes(String(q.status||'').toLowerCase())).map(q=>String(q.customer_id||q.id)));
 return {range,mode,angiUsage,periodLeads,leads:periodLeads.length,wonCount,quoted:quotedCustomers.size,quoteSent:quoteSentCustomers.size,completedCount:revenueJobs.length,revenue,revenueJobs,sourceRows:sources,expenses:periodExpenses,expenseTotal,assignedCosts,adCash:advertisedCash,contribution:cents(revenue-advertisedCash-expenseTotal),unknownJobPrices:revenueJobs.filter(r=>!r.quote||!n(r.quote.ceramic_price)).length};
}
export function lastCycles(reference=new Date(),count=6,day=7){const start=cycleAt(reference,day).start;return Array.from({length:count},(_,i)=>{const d=new Date(start.getFullYear(),start.getMonth()-(count-1-i),day);return cycleAt(d,day)})}
