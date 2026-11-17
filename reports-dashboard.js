/* Dynamic Tintz OS: optional, additive reporting module. No writes to leads/quotes/jobs. */
import {n,currency,cycleAt,within,monthAt,budgetUsage,reportPeriod,buildReport,lastCycles,sourceOf,feeOf} from './reports-core.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=(x)=>Number.isFinite(x)?`${x.toFixed(1)}%`:'—';
const niceDate=d=>new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const labelFor=r=>`${niceDate(r.start)} – ${niceDate(new Date(r.end-1))}`;
const nowInput=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
const money=currency;
const qname=q=>[q?.customer?.first_name,q?.customer?.last_name].filter(Boolean).join(' ')||q?.project_name||'Unlinked quote';
const defaults={monthly_cash_spend:550,monthly_credit_value:750,billing_day:7};
const categories=['Materials','Labor','Fuel / Travel','Supplies','Equipment','Insurance','Software','Advertising - Other','Rent / Utilities','Taxes / Fees','Other'];

function lineChart(series){
 const data=series.map((row,i)=>({...row,x:45+(i*730/Math.max(1,series.length-1))}));
 const max=Math.max(1,...data.flatMap(x=>[x.revenue,x.spend,x.expenses||0]));
 const scale=max<=1000?250:Math.ceil(max/4000)*1000;
 const ceil=Math.ceil(max/(scale||1))*(scale||1),height=210;
 const y=v=>height-(Math.max(0,v)/ceil)*172;
 const path=k=>data.map((d,i)=>`${i?'L':'M'}${d.x.toFixed(1)} ${y(d[k]).toFixed(1)}`).join(' ');
 return `<svg class="dr-chart" viewBox="0 0 805 265" role="img" aria-label="Revenue, advertising, and recorded operating expenses across the last six billing cycles" preserveAspectRatio="xMidYMid meet">
 <defs><linearGradient id="dr-chart-shade" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#26d9d3" stop-opacity=".23"/><stop offset="1" stop-color="#26d9d3" stop-opacity="0"/></linearGradient></defs>
 ${Array.from({length:5},(_,i)=>{let yy=height-(i*172/4);return `<line x1="45" y1="${yy}" x2="775" y2="${yy}" stroke="#24414a" stroke-width="1"/><text x="38" y="${yy+4}" font-size="11" text-anchor="end" fill="#8baab2">${Math.round(ceil*i/4).toLocaleString()}</text>`}).join('')}
 <path d="${path('revenue')} L${data.at(-1)?.x||775} ${height} L45 ${height} Z" fill="url(#dr-chart-shade)"/>
 <path d="${path('revenue')}" stroke="#35e5df" fill="none" stroke-width="3" stroke-linecap="round"/>
 <path d="${path('spend')}" stroke="#ff8fa5" fill="none" stroke-width="2.3" stroke-linecap="round"/>
 <path d="${path('expenses')}" stroke="#7cd5aa" fill="none" stroke-width="2" stroke-dasharray="5 5"/>
 ${data.map(d=>`<circle cx="${d.x}" cy="${y(d.revenue)}" r="4" fill="#35e5df"/><text x="${d.x}" y="242" text-anchor="middle" fill="#a6c5cb" font-size="12">${esc(d.label)}</text>`).join('')}
 </svg>`;
}
function donut(value,total){const v=total>0?Math.max(0,value/total*100):0;return `<div class="dr-donut" style="--percent:${Math.min(100,v)}"><b>${Math.round(v)}%</b><span>used</span></div>`}
function bar(value,max){return `<span class="dr-bar"><i style="width:${max>0?Math.max(2,100*value/max):0}%"></i></span>`}
function card(label,value,note,icon){return `<div class="dr-metric"><span class="dr-icon">${icon}</span><div><small>${esc(label)}</small><b>${esc(value)}</b><em>${esc(note)}</em></div></div>`}
function heading(title,caption=''){return `<div class="dr-panel-head"><h3>${title}</h3>${caption?`<span>${esc(caption)}</span>`:''}</div>`}
export function initReports({sb,notify=()=>{}}){
 let settings={...defaults},expenses=[],leads=[],quotes=[],jobs=[],mode='cycle',lastLoad=0,schemaReady=false;
 let homeBudgetRows=[],homeBudgetLoadedAt=0,homeBudgetPromise=null,homeBudgetConfigLoaded=false;
 const el=id=>document.getElementById(id);
 let busy=false;
 const statusText=(msg)=>{if(el('reportStatus'))el('reportStatus').textContent=msg};
 async function paginate(table,select='*'){
  let all=[],step=700;
  for(let i=0;i<35;i++){
    const {data,error}=await sb.from(table).select(select).range(i*step,(i+1)*step-1);
    if(error)throw new Error(`${table}: ${error.message}`);
    all.push(...(data||[]));if(!data||data.length<step)break;
  }
  return all;
 }
 async function getFinanceTables(){
   const [cfg,expenseRows]=await Promise.all([sb.from('report_budget_settings').select('*').eq('id','angi').maybeSingle(),sb.from('report_expenses').select('*').order('expense_date',{ascending:false}).limit(1000)]);
   if(cfg.error||expenseRows.error){schemaReady=false;return}
   schemaReady=true;settings={...defaults,...(cfg.data||{})};expenses=expenseRows.data||[];
 }
 async function load(force=true){
  if(busy)return;
  if(!force&&Date.now()-lastLoad<30000){render();return}
  busy=true;statusText('Loading live reports…');
  try{
    const [l,q,j]=await Promise.all([paginate('leads'),paginate('quotes','*,customer:customers(first_name,last_name,lead_source)'),paginate('jobs')]);
    leads=l;quotes=q;jobs=j;
    await getFinanceTables();lastLoad=Date.now();render();
    statusText(schemaReady?'Live data • financial expenses available':'Live lead & job data • run Reports SQL to enable expenses and budget settings');
  }catch(e){statusText('Could not load reports: '+e.message);console.error('Reports error:',e)}
  finally{busy=false}
 }
 /** Home widget: a compact view of the same Angi billing-cycle calculation used on Reports. */
 function renderHomeBudget(rows=homeBudgetRows){
  const root=el('homeAngiBudget');if(!root)return;
  const range=cycleAt(new Date(),settings.billing_day||7);
  const usage=budgetUsage(rows,range,settings.monthly_cash_spend,settings.monthly_credit_value);
  const allocatedCash=usage.creditTarget>0?Math.min(usage.cashSpend,usage.creditsUsed*usage.cashSpend/usage.creditTarget):0;
  const cashPct=usage.creditTarget>0?usage.usagePct:0;
  const width=v=>Math.max(0,Math.min(100,v)).toFixed(1);
  root.innerHTML=`<p class="dt-home-budget-cycle">Billing cycle: ${esc(labelFor(range))}</p>
   <div class="dt-home-budget-top">
     <div><small>MONTHLY CASH PAYMENT</small><strong>${money(usage.cashSpend)}</strong></div>
     <div><small>LEAD CREDIT TARGET</small><strong>${money(usage.creditTarget)}</strong></div>
   </div>
   <div class="dt-home-budget-progress-list">
     <div class="dt-home-budget-progress-row"><div class="dt-home-budget-progress-head"><span>Lead credits used</span><b>${money(usage.creditsUsed)} / ${money(usage.creditTarget)}</b></div><div class="dt-home-budget-track" role="progressbar" aria-label="Lead credit target consumed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width(usage.usagePct)}"><i style="width:${width(usage.usagePct)}%"></i></div></div>
     <div class="dt-home-budget-progress-row"><div class="dt-home-budget-progress-head"><span>Cash equivalent allocated*</span><b>${money(allocatedCash)}</b></div><div class="dt-home-budget-track muted" role="progressbar" aria-label="Estimated share of fixed monthly cash payment allocated to leads" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${width(cashPct)}"><i style="width:${width(cashPct)}%"></i></div></div>
   </div>
   <div class="dt-home-budget-bottom"><div><small>Credits remaining</small><strong>${money(usage.creditsRemaining)}</strong></div><div><small>Angi leads received</small><strong>${usage.count}</strong></div></div>
   <p class="dt-home-budget-footnote">*Cash allocation is estimated from the fixed ${money(usage.cashSpend)} monthly payment.${usage.usagePct>=100?' Angi may pause new leads.':''}</p>`;
 }
 /** Nonblocking homepage data request. Never writes to existing records or Square. */
 async function loadHomeBudget(force=false){
  const root=el('homeAngiBudget');if(!root)return;
  if(!force&&homeBudgetLoadedAt&&Date.now()-homeBudgetLoadedAt<45000){renderHomeBudget();return}
  if(homeBudgetPromise)return homeBudgetPromise;
  if(!homeBudgetLoadedAt)root.innerHTML='<div class="dt-home-budget-loading">Loading Angi budget…</div>';
  homeBudgetPromise=(async()=>{
    if(!homeBudgetConfigLoaded){
      const result=await sb.from('report_budget_settings').select('monthly_cash_spend,monthly_credit_value,billing_day').eq('id','angi').maybeSingle();
      if(!result.error&&result.data)settings={...settings,...result.data};
      homeBudgetConfigLoaded=true;
    }
    const range=cycleAt(new Date(),settings.billing_day||7);
    // Monthly Angi lead fees are small; fetch this billing cycle only, not all historic leads.
    const {data,error}=await sb.from('leads').select('*').gte('received_at',range.start.toISOString()).lt('received_at',range.end.toISOString()).order('received_at',{ascending:false}).limit(1000);
    if(error)throw new Error(error.message);
    homeBudgetRows=data||[];homeBudgetLoadedAt=Date.now();renderHomeBudget();
  })().catch(error=>{
    console.warn('Home Angi Budget Tracker:',error);
    root.innerHTML='<div class="dt-home-budget-loading">Budget data unavailable. <span>Open Reports for details.</span></div>';
  }).finally(()=>{homeBudgetPromise=null});
  return homeBudgetPromise;
 }
 function renderLeadBudget(rows){
  const root=el('reportsLeadBudget');if(!root)return;
  const range=cycleAt(new Date(),settings.billing_day||7),usage=budgetUsage(rows,range,settings.monthly_cash_spend,settings.monthly_credit_value);
  root.innerHTML=`<div class="dr-lead-top"><div><span class="dr-eyebrow">ANGI • BILLING CYCLE</span><h3>Lead Budget <small>${esc(labelFor(range))}</small></h3></div><button class="dr-outline" type="button" data-go="reports">Open Reports →</button></div>
    <div class="dr-lead-metrics"><div><span>Monthly cash spend</span><strong>${money(usage.cashSpend)}</strong></div><div><span>Lead credits used</span><strong>${money(usage.creditsUsed)}</strong></div><div><span>Credits remaining</span><strong>${money(usage.creditsRemaining)}</strong></div><div><span>Angi leads received</span><strong>${usage.count}</strong></div></div>
    <div class="dr-progress"><i style="width:${Math.min(100,usage.usagePct).toFixed(1)}%"></i></div><div class="dr-caption">${pct(usage.usagePct)} of ${money(usage.creditTarget)} credit target used. Credit usage may exceed 100%; cash cost remains ${money(usage.cashSpend)} unless separately recorded.</div>`;
 }
 function render(){
  const r=reportPeriod(mode,new Date(),settings.billing_day),d=buildReport({leads,quotes,jobs,expenses,settings,range:r,mode});
  const subtitle=el('reportRangeLabel');if(subtitle)subtitle.textContent=labelFor(r);
  const metrics=el('reportMetrics');if(metrics)metrics.innerHTML=
   card('ANGI LEAD CREDITS',`${money(d.angiUsage.creditsUsed)} / ${money(d.angiUsage.creditTarget*(mode==='six'?6:1))}`,'Credits used this period','◉')+
   card('LEADS WON',String(d.wonCount),'Approved or completed opportunities','♙')+
   card('COMPLETED REVENUE',money(d.revenue),'From linked completed jobs','▥')+
   card('ESTIMATED CONTRIBUTION',money(d.contribution),'Revenue − lead cash spend − entered expenses','↗');
  if(el('reportBudget'))el('reportBudget').innerHTML=`${heading('Angi Budget Tracker',labelFor(r))}<div class="dr-budget-top"><div><small>MONTHLY CASH INVESTMENT</small><b>${money(settings.monthly_cash_spend)}</b></div><div><small>LEAD CREDIT TARGET</small><b>${money(settings.monthly_credit_value)}</b></div><div><small>BILLING CYCLE</small><b>7th – 6th</b></div></div><div class="dr-budget-middle">${donut(d.angiUsage.creditsUsed,mode==='six'?6*n(settings.monthly_credit_value):n(settings.monthly_credit_value))}<div class="dr-budget-numbers"><div>Credits used <b>${money(d.angiUsage.creditsUsed)}</b></div><div>Remaining* <b>${money(Math.max(0,(mode==='six'?6:1)*n(settings.monthly_credit_value)-d.angiUsage.creditsUsed))}</b></div><div>Angi leads <b>${d.angiUsage.count}</b></div><div>Cash spend assumption <b>${money(d.adCash)}</b></div></div></div><div class="dr-progress"><i style="width:${Math.min(100,d.angiUsage.usagePct/(mode==='six'?6:1)).toFixed(1)}%"></i></div><p class="dr-fine">*Target-based balance; Angi may stop delivering leads near 100% even when the recorded value differs. Cash spend is the ${money(settings.monthly_cash_spend)}/cycle assumption, not bank reconciliation.</p><button class="dr-outline" id="reportOpenBudget" ${!schemaReady?'disabled':''}>Adjust Budget Settings</button>`;
  const sources=d.sourceRows,top=Math.max(1,...sources.map(s=>s.leads));
  if(el('reportSources'))el('reportSources').innerHTML=`${heading('Lead Source Performance','Recorded attribution')}<div class="dr-table-wrap"><table class="dr-table"><thead><tr><th>Source</th><th>Leads</th><th>Completed jobs</th><th>Completed revenue</th></tr></thead><tbody>${sources.length?sources.map(s=>`<tr><td><strong>${esc(s.source)}</strong>${bar(s.leads,top)}</td><td>${s.leads}</td><td>${s.won}</td><td>${money(s.revenue)}</td></tr>`).join(''):'<tr><td colspan="4">No lead-source data for this period.</td></tr>'}</tbody></table></div><p class="dr-fine">Completed-job attribution uses the linked customer/lead record when available; otherwise the saved quote source or “Unattributed.”</p>`;
  const cycles=lastCycles(new Date(),6,settings.billing_day);
  const trends=cycles.map(c=>{let m=buildReport({leads,quotes,jobs,expenses,settings,range:c,mode:'cycle'});return {label:c.start.toLocaleDateString('en-US',{month:'short'}),revenue:m.revenue,spend:n(settings.monthly_cash_spend),expenses:m.expenseTotal}});
  if(el('reportChart'))el('reportChart').innerHTML=`${heading('Revenue vs Spend','Last six Angi billing cycles')}${lineChart(trends)}<div class="dr-legend"><span><i class="is-revenue"></i>Completed revenue</span><span><i class="is-spend"></i>Angi cash investment</span><span><i class="is-expenses"></i>Other recorded expenses</span></div>`;
  let stages=[['Leads',d.leads],['Quoted',d.quoted],['Quote sent',d.quoteSent],['Won',d.wonCount],['Completed',d.completedCount]];
  if(el('reportFunnel'))el('reportFunnel').innerHTML=`${heading('Conversion Funnel',labelFor(r))}<div class="dr-funnel">${stages.map(([name,count],i)=>`<div class="dr-funnel-step"><small>${esc(name)}</small><b>${count}</b><strong>${d.leads?Math.round(count/d.leads*100):0}%</strong></div>${i<stages.length-1?'<span class="dr-chevron">›</span>':''}`).join('')}</div><p class="dr-fine">Funnel stages reflect stored records, not a strictly sequential cohort. Completed counts are jobs; quoted/won counts are distinct customers.</p>`;
  const best=[...d.revenueJobs].sort((a,b)=>b.amount-a.amount).slice(0,8);
  if(el('reportBest'))el('reportBest').innerHTML=`${heading('Completed Jobs',labelFor(r))}<div class="dr-table-wrap"><table class="dr-table"><thead><tr><th>Customer</th><th>Revenue</th><th>Direct cost*</th><th>Lead cost*</th><th>Est. contribution*</th></tr></thead><tbody>${best.length?best.map(x=>{const direct=d.expenses.filter(e=>x.quote?.id&&e.quote_id===x.quote.id).reduce((s,e)=>s+n(e.amount),0),leadCash=x.leadFaceCost*n(settings.monthly_cash_spend)/Math.max(1,n(settings.monthly_credit_value));return `<tr><td>${esc(x.customer)}<div class="dr-source-sub">${esc(x.source)}</div></td><td>${money(x.amount)}</td><td>${money(direct)}</td><td>${money(leadCash)}</td><td><b>${money(x.amount-direct-leadCash)}</b></td></tr>`}).join(''):'<tr><td colspan="5">No linked completed jobs for this period.</td></tr>'}</tbody></table></div><p class="dr-fine">*Only recorded job-specific expenses are included. Angi acquisition cost is allocated using the $550 ÷ $750 credit ratio; full cycle cash spend is counted once in the overall contribution, not again per job.</p>`;
  if(el('reportInsights'))el('reportInsights').innerHTML=`${heading('Key Insights')}<div class="dr-insights"><div><strong>${d.angiUsage.count}</strong><span>Angi leads during the selected period</span></div><div><strong>${money(d.expenseTotal)}</strong><span>Other expenses recorded</span></div><div><strong>${d.leads?pct(d.wonCount/d.leads*100):'—'}</strong><span>Won opportunities ÷ received leads</span></div><div><strong>${money(d.contribution)}</strong><span>Estimated contribution, before unrecorded costs</span></div></div>${d.unknownJobPrices?`<p class="dr-fine dr-warning">${d.unknownJobPrices} completed job(s) have no linked saved quote price; those jobs count, but their revenue is $0 pending linkage.</p>`:''}`;
  if(el('reportExpenses'))el('reportExpenses').innerHTML=`${heading('Operating Expenses',schemaReady?'Recorded cash costs':'Database setup required')}<div class="dr-expense-toolbar"><p>Record fuel, materials, labor, software, and overhead. Avoid entering the same $550 Angi subscription here; it is already included above.</p><button class="dr-solid" id="reportAddExpense" ${schemaReady?'':'disabled'}>+ Record Expense</button></div><div class="dr-table-wrap"><table class="dr-table"><thead><tr><th>Date</th><th>Category</th><th>Details</th><th>Amount</th><th></th></tr></thead><tbody>${d.expenses.length?d.expenses.slice(0,100).map(x=>`<tr><td>${esc(x.expense_date)}</td><td>${esc(x.category)}</td><td>${esc(x.description||'—')}</td><td>${money(x.amount)}</td><td><button class="dr-text-btn" data-delete-expense="${esc(x.id)}" aria-label="Delete recorded expense">Delete</button></td></tr>`).join(''):'<tr><td colspan="5">No other expenses recorded for this period.</td></tr>'}</tbody></table></div>${schemaReady?'':'<p class="dr-warning">Run the included Supabase SQL once to enable budget settings and expense recording.</p>'}`;
  renderLeadBudget(leads);
  bindControls();
 }
 function bindControls(){
   el('reportOpenBudget')?.addEventListener('click',()=>{el('reportBudgetCash').value=settings.monthly_cash_spend;el('reportBudgetCredit').value=settings.monthly_credit_value;el('reportBudgetModal').classList.add('show')});
   el('reportAddExpense')?.addEventListener('click',()=>{el('reportExpenseForm').reset();el('reportExpenseDate').value=nowInput();el('reportExpenseQuote').innerHTML='<option value="">General expense (not job-linked)</option>'+quotes.slice(0,200).map(q=>`<option value="${esc(q.id)}">${esc(qname(q))} • ${esc(q.project_name||'Project')}</option>`).join('');el('reportExpenseModal').classList.add('show')});
   el('reportExpenses')?.querySelectorAll('[data-delete-expense]').forEach(b=>b.onclick=()=>removeExpense(b.dataset.deleteExpense));
 }
 async function removeExpense(id){
  if(!schemaReady||!confirm('Delete this expense entry permanently?'))return;
  const {error}=await sb.from('report_expenses').delete().eq('id',id);
  if(error){notify('Could not delete expense: '+error.message);return}
  expenses=expenses.filter(e=>String(e.id)!==id);render();notify('Expense deleted.');
 }
 async function saveBudget(e){
  e.preventDefault();const cash=n(el('reportBudgetCash').value),credit=n(el('reportBudgetCredit').value);
  if(!schemaReady||cash<0||credit<=0)return notify('Enter a valid budget.');
  const {data,error}=await sb.from('report_budget_settings').upsert({id:'angi',monthly_cash_spend:cash,monthly_credit_value:credit,billing_day:7,updated_at:new Date().toISOString()},{onConflict:'id'}).select().single();
  if(error){notify('Budget update failed: '+error.message);return}
  settings={...settings,...data};homeBudgetLoadedAt=0;renderHomeBudget();el('reportBudgetModal').classList.remove('show');render();notify('Budget settings saved.');
 }
 async function saveExpense(e){
  e.preventDefault();if(!schemaReady)return;
  const amount=n(el('reportExpenseAmount').value);if(amount<=0)return notify('Expense amount must be greater than zero.');
  const payload={expense_date:el('reportExpenseDate').value,category:el('reportExpenseCategory').value,amount,description:el('reportExpenseDescription').value.trim(),quote_id:el('reportExpenseQuote').value||null};
  const {data,error}=await sb.from('report_expenses').insert(payload).select().single();
  if(error){notify('Could not save expense: '+error.message);return}
  expenses.unshift(data);el('reportExpenseModal').classList.remove('show');render();notify('Expense recorded.');
 }
 function wire(){
  const sel=el('reportRange');if(sel)sel.onchange=()=>{mode=sel.value;render()};
  if(el('reportRefresh'))el('reportRefresh').onclick=()=>load(true);
  if(el('reportBudgetForm'))el('reportBudgetForm').onsubmit=saveBudget;
  if(el('reportExpenseForm'))el('reportExpenseForm').onsubmit=saveExpense;
  for(const id of ['reportBudgetClose','reportExpenseClose'])if(el(id))el(id).onclick=()=>el(id==='reportBudgetClose'?'reportBudgetModal':'reportExpenseModal').classList.remove('show');
 }
 wire();return {load,loadHomeBudget,renderHomeBudget,renderLeadBudget,render:()=>render(),budgetState:()=>({...settings})};
}
