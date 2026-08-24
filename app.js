import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
let operationsCache=[],teamTimeCache=[];
const sb=createClient("https://jypfmjuesuezlmgfmrjq.supabase.co","sb_publishable_pAu0w7YvY4vk5sMect4LQw_-SG6ngls",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}),$=id=>document.getElementById(id);let session,profile,leads=[];
function toast(m){$("toast").textContent=m;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1800)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function when(v){return v?new Date(v).toLocaleString():"—"}function owner(){return ["owner","manager"].includes(profile.role)}
async function login(){$("message").textContent="Signing in…";let{error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});$("message").textContent=error?error.message:""}
async function reset(){let e=$("email").value.trim();if(!e)return $("message").textContent="Enter your email first.";let{error}=await sb.auth.resetPasswordForEmail(e,{redirectTo:location.href});$("message").textContent=error?error.message:"Password reset sent."}
function lastViewKey(){return `dt.lastView.${session?.user?.id||"guest"}`}
function allowedView(id){
  const ownerViews=['owner','leads','followups','quotes','optimizer','inventory','operations','shortcuts','team','account'];
  const employeeViews=['employee','time','account'];
  return (owner()?ownerViews:employeeViews).includes(id)&&!!$(id);
}
function navigationViewMap(){
  return owner()
    ?{owner:'dashboard',leads:'loadLeads',followups:'loadFollowups',quotes:'loadQuotes',optimizer:'loadRollOptimizer',inventory:'loadInventory',operations:'loadOperations',shortcuts:'renderShortcuts',team:'loadTeam',account:'account'}
    :{employee:'loadEmployee',time:'loadTime',account:'account'};
}
function auditNavigation(){
  let missing=[];
  for(let [id,loader] of Object.entries(navigationViewMap())){
    if(!$(id))missing.push(`${id}: missing view`);
    if(loader!=='account'&&typeof globalThis[loader]==='undefined'){
      // Module functions are lexical rather than global; existence is validated at build time.
    }
  }
  if(missing.length)console.error('Dynamic Tintz navigation audit failed:',missing);
  else console.info('Dynamic Tintz navigation audit: all permitted pages exist.');
  return missing;
}
async function enter(){let{data,error}=await sb.from("profiles").select("*").eq("id",session.user.id).single();if(error)throw error;profile=data;$("auth").classList.add("hidden");$("app").classList.remove("hidden");$("userline").textContent=`${profile.full_name||profile.email} • ${profile.role}`;$("accountInfo").innerHTML=`<b>${esc(profile.full_name)}</b><br>${esc(profile.email)}<br><span class="pill">${profile.role}</span>`;renderNav();auditNavigation();setupEmployeeAdmin();if(owner()){$("calendarIntegrationCard")?.classList.remove("hidden");$("icloudCalendarCard")?.classList.remove("hidden");}let saved=localStorage.getItem(lastViewKey()),fallback=owner()?"owner":"employee";show(saved&&allowedView(saved)?saved:fallback)}

const VAPID_PUBLIC_KEY='BAVc1W5wH-ch_X7G_t2gwEzV5QQejck8Mc05JQj8ghLnx9pbD98QFoGB_M6DvtDXwDGruqXo33c2oLtmV8U-LoY';
function base64UrlToUint8Array(value){
  let padding='='.repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  let raw=atob(base64),out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
function pushSupported(){
  return 'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
}
async function getPushSubscription(){
  if(!pushSupported())return null;
  let reg=await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}
async function syncPushNotificationUI(){
  let st=$('pushNotificationStatus'),msg=$('pushNotificationMessage'),enable=$('enablePushNotifications'),
      disable=$('disablePushNotifications'),test=$('testPushNotification');
  if(!st)return;
  if(!pushSupported()){
    st.textContent='Not Supported';msg.textContent='This browser/device does not support PWA push notifications.';enable.disabled=true;disable.disabled=true;test.disabled=true;return;
  }
  let sub=await getPushSubscription();
  let permission=Notification.permission;
  if(sub){
    let {data:prefs}=await sb.from('push_subscriptions').select('notify_new_leads,notify_followups,notify_assignments,notify_job_tomorrow,notify_job_soon,notify_schedule_changes,notify_low_inventory').eq('endpoint',sub.endpoint).maybeSingle();
    if(prefs){
      if($('notifyNewLeads'))$('notifyNewLeads').checked=prefs.notify_new_leads!==false;
      if($('notifyFollowups'))$('notifyFollowups').checked=prefs.notify_followups!==false;
      if($('notifyAssignments'))$('notifyAssignments').checked=prefs.notify_assignments!==false;
      if($('notifyJobTomorrow'))$('notifyJobTomorrow').checked=prefs.notify_job_tomorrow!==false;
      if($('notifyJobSoon'))$('notifyJobSoon').checked=prefs.notify_job_soon===true;
      if($('notifyScheduleChanges'))$('notifyScheduleChanges').checked=prefs.notify_schedule_changes!==false;
      if($('notifyLowInventory'))$('notifyLowInventory').checked=prefs.notify_low_inventory!==false;
    }
  }
  st.textContent=sub&&permission==='granted'?'Enabled':permission==='denied'?'Blocked':'Off';
  enable.disabled=permission==='denied';
  disable.disabled=!sub;
  test.disabled=!sub;
  if(permission==='denied')msg.textContent='Notifications are blocked in this device/browser settings.';
  else if(sub)msg.textContent='This device is registered for free push notifications.';
  else msg.textContent='Notifications are not enabled on this device yet.';
}
async function savePushSubscription(sub){
  let json=sub.toJSON(),keys=json.keys||{};
  let payload={
    user_id:session.user.id,
    endpoint:json.endpoint,
    p256dh:keys.p256dh||'',
    auth:keys.auth||'',
    user_agent:navigator.userAgent,
    active:true,
    notify_new_leads:$('notifyNewLeads')?.checked!==false,
    notify_followups:$('notifyFollowups')?.checked!==false,
    notify_assignments:$('notifyAssignments')?.checked!==false,
    notify_job_tomorrow:$('notifyJobTomorrow')?.checked!==false,
    notify_job_soon:$('notifyJobSoon')?.checked===true,
    notify_schedule_changes:$('notifyScheduleChanges')?.checked!==false,
    notify_low_inventory:$('notifyLowInventory')?.checked!==false,
    updated_at:new Date().toISOString()
  };
  let{error}=await sb.from('push_subscriptions').upsert(payload,{onConflict:'endpoint'});
  if(error)throw error;
}
async function enablePushNotifications(){
  if(!pushSupported())return toast('Push notifications are not supported on this device.');
  try{
    let permission=await Notification.requestPermission();
    if(permission!=='granted'){await syncPushNotificationUI();return toast('Notification permission was not granted.')}
    let reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(VAPID_PUBLIC_KEY)});
    await savePushSubscription(sub);
    await syncPushNotificationUI();
    toast('Notifications enabled on this device.');
  }catch(e){console.error('Enable push:',e);toast('Could not enable notifications: '+(e?.message||String(e)))}
}
async function disablePushNotifications(){
  try{
    let sub=await getPushSubscription();
    if(sub){
      await sb.from('push_subscriptions').update({active:false,updated_at:new Date().toISOString()}).eq('endpoint',sub.endpoint);
      await sub.unsubscribe();
    }
    await syncPushNotificationUI();
    toast('Notifications disabled on this device.');
  }catch(e){toast('Could not disable notifications: '+(e?.message||String(e)))}
}
async function savePushPreferences(){
  try{
    let sub=await getPushSubscription();if(!sub)return;
    await sb.from('push_subscriptions').update({
      notify_new_leads:$('notifyNewLeads')?.checked!==false,
      notify_followups:$('notifyFollowups')?.checked!==false,
      notify_assignments:$('notifyAssignments')?.checked!==false,
      notify_job_tomorrow:$('notifyJobTomorrow')?.checked!==false,
      notify_job_soon:$('notifyJobSoon')?.checked===true,
      notify_schedule_changes:$('notifyScheduleChanges')?.checked!==false,
      notify_low_inventory:$('notifyLowInventory')?.checked!==false,
      updated_at:new Date().toISOString()
    }).eq('endpoint',sub.endpoint);
    toast('Notification preference saved.');
  }catch(e){console.warn('Push preference:',e)}
}
async function testPushNotification(){
  try{
    let{data,error}=await sb.functions.invoke('push-notify',{body:{action:'test'}});
    if(error)throw error;
    if(data?.ok===false)throw new Error(data.error||'Test notification failed.');
    toast('Test notification sent.');
  }catch(e){toast('Test notification failed: '+(e?.message||String(e)))}
}

function navIcon(name){
  const icons={
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    leads:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 4h-3A1.5 1.5 0 0 0 3 5.5C3 14.06 9.94 21 18.5 21a1.5 1.5 0 0 0 1.5-1.5v-3l-4-1.2-1.2 2.1a13.6 13.6 0 0 1-8.2-8.2L8.7 8z"/></svg>',
    quotes:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 12h7M9 16h7"/></svg>',
    schedule:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M12 14h2M16 14h2M8 18h2M12 18h2"/></svg>',
    inventory:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 4.5-9 4.5-9-4.5z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/></svg>',
    more:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
    clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>',
    account:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/></svg>'
  };return icons[name]||icons.more
}
function moreViews(){return ['inventory','followups','optimizer','shortcuts','team','account']}
function openMoreMenu(){
  if(!owner())return show('account');
  $('moreMenu')?.classList.add('show');
}
function closeMoreMenu(){$('moreMenu')?.classList.remove('show')}
function renderNav(){
  let t=owner()
    ?[['owner','home','Home'],['leads','leads','Leads'],['quotes','quotes','Quotes'],['operations','schedule','Schedule'],['more','more','More']]
    :[['employee','home','Home'],['time','clock','Clock'],['account','account','Account']];
  $("nav").style.gridTemplateColumns=`repeat(${t.length},1fr)`;
  $("nav").innerHTML=t.map(x=>`<button data-v="${x[0]}"><b class="nav-icon">${navIcon(x[1])}</b><span>${x[2]}</span></button>`).join('');
  /* Navigation clicks are handled by delegated app-level routing. */
}
async function show(id){if(!$(id)||!allowedView(id))id=owner()?'owner':'employee';closeMoreMenu();localStorage.setItem(lastViewKey(),id);document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('#nav button').forEach(b=>{let active=b.dataset.v===id||(b.dataset.v==='more'&&moreViews().includes(id));b.classList.toggle('active',active)});if(id==='owner')dashboard();if(id==='leads')loadLeads();if(id==='followups')loadFollowups();if(id==='time')loadTime();if(id==='employee')loadEmployee();if(id==='team')loadTeam();if(id==='quotes'){loadQuotes();renderMeasures();setTimeout(()=>restoreQuoteDraftIfNeeded(),40)}if(id==='optimizer')loadRollOptimizer();if(id==='inventory')loadInventory();if(id==='shortcuts')renderShortcuts();if(id==='operations')loadOperations();if(id==='account'&&owner()){loadEmployeeAdmin();loadCalendarStatus();loadIcloudCalendarStatus();syncPushNotificationUI()}}
function mondayWeekBounds(reference=new Date()){
  let d=new Date(reference);d.setHours(0,0,0,0);
  let day=d.getDay(),diff=day===0?-6:1-day;
  let start=new Date(d);start.setDate(d.getDate()+diff);
  let end=new Date(start);end.setDate(start.getDate()+7);
  return {start,end};
}
function homeWeekDateKey(value){
  if(!value)return '';
  let d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
async function loadHomeWeekIcloudEvents(start,end){
  let ids=typeof getIcloudViewCalendarIds==='function'?getIcloudViewCalendarIds():[];
  if(!ids.length)return [];
  try{
    let{data,error}=await sb.functions.invoke('icloud-calendar-events',{body:{
      calendar_ids:ids,start:start.toISOString(),end:end.toISOString()
    }});
    if(error||data?.ok===false)throw new Error(error?.message||data?.error||'Could not load view-only iCloud events.');
    return (data.events||[]).map(e=>({...e,_external:true}));
  }catch(e){
    console.warn('Home week iCloud events:',e);
    return [];
  }
}
function renderHomeWeekSchedule(jobs,external,start,end){
  let host=$('liveJobs'),strip=$('homeWeekStrip'),range=$('homeWeekRange');
  if(!strip)return;
  if(range){
    let endDisplay=new Date(end);endDisplay.setDate(endDisplay.getDate()-1);
    range.textContent=`${start.toLocaleDateString([],{month:'short',day:'numeric'})} – ${endDisplay.toLocaleDateString([],{month:'short',day:'numeric'})}`;
  }
  let entries=[
    ...(jobs||[]).map(j=>({kind:'job',date:j.scheduled_start,value:j})),
    ...(external||[]).map(e=>({kind:'external',date:e.start,value:e}))
  ].filter(x=>x.date).sort((a,b)=>new Date(a.date)-new Date(b.date));
  let byDate={};entries.forEach(x=>(byDate[homeWeekDateKey(x.date)]??=[]).push(x));
  let days=[];
  for(let i=0;i<7;i++){
    let d=new Date(start);d.setDate(start.getDate()+i);
    let key=homeWeekDateKey(d);days.push({d,key,items:byDate[key]||[]});
  }
  strip.innerHTML=days.map(({d,key,items})=>{
    let preview=items.slice(0,3).map(entry=>{
      let dt=new Date(entry.date),
          time=entry.kind==='external'&&entry.value.all_day?'ALL DAY':dt.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),
          title=entry.kind==='external'?(entry.value.summary||'Personal Event'):(entry.value.title||'Window Film Installation'),
          tag=entry.kind==='external'?'PERSONAL':String(entry.value.status||'Scheduled').toUpperCase(),
          tagClass=entry.kind==='external'?'personal':'job';
      return `<span class="home-week-mini-event">
        <small>${esc(time)}</small>
        <b>${esc(title)}</b>
        <em class="${tagClass}">${esc(tag)}</em>
      </span>`;
    }).join('');
    let more=items.length>3?`<span class="home-week-more">+${items.length-3} more</span>`:'';
    return `<button class="home-week-overview-card ${homeWeekDateKey(new Date())===key?'today':''} ${items.length?'has-events':''}" data-go="operations" data-homeweekdate="${key}">
      <span class="home-week-card-date"><small>${d.toLocaleDateString([],{weekday:'short'}).toUpperCase()}</small><b>${d.getDate()}</b></span>
      <span class="home-week-card-events">${preview||'<span class="home-week-open">OPEN</span>'}${more}</span>
    </button>`;
  }).join('');
  if(host){
    host.innerHTML='';
    host.classList.add('home-week-detail-source');
  }
  strip.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{
    try{sessionStorage.setItem('dynamicTintzOperationsDate',b.dataset.homeweekdate||'')}catch{}
    show(b.dataset.go);
  });
  setTimeout(()=>{
    let today=strip.querySelector('.home-week-overview-card.today');
    if(today)today.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
  },50);
}

async function dashboard(){
  let now=new Date(),iso=now.toISOString(),monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString(),
      week=mondayWeekBounds(now);
  let[a,b,c,pending,scheduled,completed,jobsResult,quotesResult]=await Promise.all([
    sb.from('leads').select('*',{count:'exact',head:true}).eq('status','new'),
    sb.from('leads').select('*',{count:'exact',head:true}).lte('next_follow_up_at',iso).not('status','in','("approved","lost","do_not_contact","no_response")'),
    sb.from('time_entries').select('*',{count:'exact',head:true}).eq('status','open'),
    sb.from('quotes').select('*',{count:'exact',head:true}).in('status',['New Lead','Estimate Requested','Quote Sent','Follow-Up Needed','Approved']),
    sb.from('jobs').select('*',{count:'exact',head:true}).in('status',['Scheduled','Confirmed','En Route','In Progress']),
    sb.from('jobs').select('*',{count:'exact',head:true}).eq('status','Completed').gte('updated_at',monthStart),
    sb.from('jobs').select('id,title,status,service_address,scheduled_start,scheduled_end,assigned_to,assignee:profiles!jobs_assigned_to_fkey(full_name,email)').in('status',['Scheduled','Confirmed','En Route','In Progress']).gte('scheduled_start',week.start.toISOString()).lt('scheduled_start',week.end.toISOString()).order('scheduled_start'),
    sb.from('quotes').select('id,status,project_name,ceramic_price,created_at,customer:customers(first_name,last_name)').order('created_at',{ascending:false}).limit(20)
  ]);

  $('newLeads').textContent=a.count||0;
  $('dueLeads').textContent=b.count||0;
  $('clocked').textContent=c.count||0;
  $('pendingQuotes').textContent=pending.count||0;
  $('scheduledJobs').textContent=scheduled.count||0;
  $('completedMonth').textContent=completed.count||0;

  let tasks=[];
  if(a.count)tasks.push(`${a.count} new lead${a.count===1?' needs':'s need'} immediate contact.`);
  if(b.count)tasks.push(`${b.count} follow-up${b.count===1?' is':'s are'} due.`);
  if(pending.count)tasks.push(`${pending.count} active quote${pending.count===1?' remains':'s remain'} in the pipeline.`);
  $('mission').innerHTML=tasks.length?tasks.map(x=>`• ${x}`).join('<br>'):'Everything is caught up right now.';

  let weekJobs=jobsResult.data||[],
      weekExternal=await loadHomeWeekIcloudEvents(week.start,week.end);
  renderHomeWeekSchedule(weekJobs,weekExternal,week.start,week.end);

  let recent=quotesResult.data||[];
  if($('recentQuotes'))$('recentQuotes').innerHTML=recent.length?recent.slice(0,3).map(q=>{
    let name=`${q.customer?.first_name||''} ${q.customer?.last_name||''}`.trim()||q.project_name||'Customer';
    return `<button class="app-recent-row" data-openquotehome="${q.id}">
      <span class="app-recent-main"><b>${esc(name)}</b><small>${esc(q.project_name||'Window Film Project')}</small></span>
      <strong>${money(q.ceramic_price||0)}</strong>
      <span class="app-status-text">${esc(q.status||'')}</span>
      <span class="app-chevron">›</span>
    </button>`
  }).join(''):'<div class="app-empty">No quotes yet.</div>';
  $('recentQuotes')?.querySelectorAll('[data-openquotehome]').forEach(b=>b.onclick=async()=>{await show('quotes');openCloudQuote(b.dataset.openquotehome)});

  let counts={};recent.forEach(q=>counts[q.status]=(counts[q.status]||0)+1);
  let pipeline=['New Lead','Estimate Requested','Quote Sent','Follow-Up Needed','Approved','Scheduled','Completed'],
      max=Math.max(1,...pipeline.map(s=>counts[s]||0));
  $('pipelineSnapshot').innerHTML=pipeline.map(s=>`<div class="pipeline-row"><span>${esc(s)}</span><div class="pipeline-track"><i style="width:${((counts[s]||0)/max)*100}%"></i></div><b>${counts[s]||0}</b></div>`).join('');

  document.querySelectorAll('#owner [data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
  await loadInventoryHomeAlerts();
}
let inventoryStatusCache=[],inventoryRollCache=[],inventoryProductCache=[];
function invSqft(widthIn,lengthIn){return (Number(widthIn)||0)*(Number(lengthIn)||0)/144}
function invLinearInchesFromSqft(sqft,widthIn){let w=Number(widthIn)||72;return w>0?(Number(sqft)||0)*144/w:0}
function optimizerMaterialSqft(plan){return invSqft(Number(plan?.roll_width)||72,Number(plan?.linear_inches_required)||0)}
function optimizerWasteSqft(plan,glassSqft=0){return Math.max(0,optimizerMaterialSqft(plan)-(Number(glassSqft)||0))}
function invFeet(inches){return (Number(inches)||0)/12}
function invFmt(value,digits=1){let n=Number(value)||0;return n.toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits})}
function stockAvailabilityPct(row){
  let projected=Math.max(0,Number(row?.projected_sqft)||0),
      threshold=Math.max(1,Number(row?.reorder_threshold_sqft)||75);
  // Ring communicates useful stock health, not "projected as a percentage of itself".
  // 0 sq ft = 0%; reorder threshold = 50%; 2× reorder threshold or more = 100%.
  return Math.max(0,Math.min(100,Math.round(projected/(threshold*2)*100)));
}
function inventoryStockLevel(value){
  let n=Math.max(0,Number(value)||0);
  if(n<=75)return 'critical';
  if(n<175)return 'warning';
  return 'good';
}
function inventorySqftDisplay(value,size='md'){
  let n=Math.max(0,Number(value)||0),level=inventoryStockLevel(n);
  return `<span class="inventory-sqft-display ${size} stock-${level}"><b>${invFmt(n,0)}</b><small>sq ft</small></span>`;
}

async function inventoryProducts(){
  let{data,error}=await sb.from('film_inventory_products').select('*').eq('active',true).order('name');
  if(error)throw error;inventoryProductCache=data||[];return inventoryProductCache
}
let scheduledReservationReconcilePromise=null;
async function reconcileCurrentScheduledReservations(){
  if(scheduledReservationReconcilePromise)return scheduledReservationReconcilePromise;
  scheduledReservationReconcilePromise=(async()=>{
    try{
      let products=await inventoryProducts();
      let{data:jobs,error:jobError}=await sb.from('jobs')
        .select('id,quote_id,title,status,quote:quotes!jobs_quote_id_fkey(id,total_sqft,square_catalog_item_name)')
        .in('status',['Scheduled','Confirmed','En Route','In Progress']);
      if(jobError)throw jobError;
      jobs=jobs||[];
      if(!jobs.length)return {created:0,skipped:0,unmatched:0};

      let jobIds=jobs.map(j=>j.id),
          quoteIds=jobs.map(j=>j.quote_id).filter(Boolean);

      let [plansRes,optRes]=await Promise.all([
        sb.from('job_material_plans').select('job_id').in('job_id',jobIds),
        quoteIds.length
          ?sb.from('roll_optimization_plans')
            .select('id,quote_id,roll_width,linear_inches_required,created_at')
            .in('quote_id',quoteIds)
            .order('created_at',{ascending:false})
          :Promise.resolve({data:[],error:null})
      ]);
      if(plansRes.error)throw plansRes.error;
      if(optRes.error)throw optRes.error;

      let existing=new Set((plansRes.data||[]).map(x=>x.job_id)),
          optimizerByQuote={};
      for(let p of (optRes.data||[])){
        if(!optimizerByQuote[p.quote_id])optimizerByQuote[p.quote_id]=p;
      }

      let created=0,skipped=0,unmatched=0;
      for(let j of jobs){
        if(existing.has(j.id)){skipped++;continue}
        let q=j.quote||{};
        if(!j.quote_id||!(Number(q.total_sqft)>0)){unmatched++;continue}

        let wanted=String(q.square_catalog_item_name||'').trim().toLowerCase(),
            product=products.find(p=>String(p.name||'').trim().toLowerCase()===wanted);
        if(!product){unmatched++;continue}

        let optimizer=optimizerByQuote[j.quote_id]||null,
            width=Number(optimizer?.roll_width)||Number(product.default_roll_width_inches)||72,
            plannedSqft=optimizer?optimizerMaterialSqft(optimizer):Number(q.total_sqft)||0,
            linearInches=optimizer
              ?Number(optimizer.linear_inches_required)||0
              :invLinearInchesFromSqft(plannedSqft,width);

        if(!(plannedSqft>0)&&!(linearInches>0)){unmatched++;continue}

        let{error}=await sb.from('job_material_plans').upsert({
          job_id:j.id,
          product_id:product.id,
          source:optimizer?'optimizer':'calculated',
          optimizer_plan_id:optimizer?.id||null,
          planned_linear_inches:linearInches,
          actual_linear_inches:null,
          roll_width_inches:width,
          notes:optimizer
            ?`Automatic scheduled-job reconciliation from saved optimizer plan: ${plannedSqft.toFixed(2)} sq ft reserved.`
            :`Automatic scheduled-job reconciliation from quote glass: ${plannedSqft.toFixed(2)} sq ft reserved.`,
          updated_at:new Date().toISOString()
        },{onConflict:'job_id'});
        if(error){
          console.warn('Scheduled reservation reconciliation:',j.id,error);
          unmatched++;
          continue;
        }
        created++;
      }
      if(created)console.info(`Reconciled ${created} current scheduled inventory reservation${created===1?'':'s'}.`);
      return {created,skipped,unmatched};
    }catch(e){
      console.warn('Current scheduled inventory reconciliation failed:',e);
      return {created:0,skipped:0,unmatched:0,error:e};
    }finally{
      setTimeout(()=>{scheduledReservationReconcilePromise=null},1500);
    }
  })();
  return scheduledReservationReconcilePromise;
}

async function loadInventoryHomeAlerts(){
  let host=$('inventoryHomeAlerts');if(!host)return;
  await reconcileCurrentScheduledReservations();
  let{data,error}=await sb.from('inventory_product_status').select('*').eq('active',true).order('product_name');
  if(error){console.error('Inventory forecast error',error);host.innerHTML=`<div class="app-empty"><b>Inventory forecast could not load.</b><br>${esc(error.message||'Unknown inventory error')}</div>`;return}

  let rows=data||[],priorityNames=['25% Ceramic Tint Install','35% Ceramic Tint Install','45% Ceramic Tint Install'];
  let priority=priorityNames.map(n=>rows.find(x=>x.product_name===n)).filter(Boolean);
  let otherLow=rows.filter(x=>!priorityNames.includes(x.product_name)&&Number(x.projected_sqft)<=Number(x.reorder_threshold_sqft));

  host.innerHTML=`<div class="app-inventory-snapshot">
    ${priority.map(x=>{
      let p=Number(x.projected_sqft)||0,t=Number(x.reorder_threshold_sqft)||75,low=p<=t;
      return `<button class="app-inventory-snapshot-card ${low?'is-low':''}" data-homeinventory="${x.product_id}">
        <span class="app-stock-copy"><b>${esc(x.product_name.replace(' Tint Install','').replace('Ceramic','Ceramic '))}</b><small>${Number(x.active_roll_count)||0} roll${Number(x.active_roll_count)===1?'':'s'} • ${invFmt(p,1)} sq ft available</small>${low?'<em>ORDER SOON</em>':'<em>IN STOCK</em>'}</span>
        ${inventorySqftDisplay(p,'sm')}
        <span class="app-chevron">›</span>
      </button>`
    }).join('')}
  </div>
  ${otherLow.length?`<details class="app-low-stock"><summary>${otherLow.length} other film${otherLow.length===1?'':'s'} need attention</summary>${otherLow.map(x=>`<div><span>${esc(x.product_name)}</span><b>${invFmt(x.projected_sqft,1)} sq ft</b></div>`).join('')}</details>`:''}`;
  host.querySelectorAll('[data-homeinventory]').forEach(b=>b.onclick=()=>openInventoryMetricEditor(b.dataset.homeinventory,'projected'));
}
async function loadInventoryBackfill(){
  let host=$('inventoryBackfillList');
  if(!host)return;
  host.innerHTML='<div class="muted">Loading completed jobs…</div>';
  let from=$('inventoryBackfillFrom')?.value||'';
  let query=sb.from('jobs').select('id,quote_id,title,status,scheduled_start,scheduled_end,archived_at,updated_at,created_at,quote:quotes!jobs_quote_id_fkey(id,project_name,total_sqft,square_catalog_item_name,customer:customers(first_name,last_name))').eq('status','Completed').order('scheduled_start',{ascending:false});
  let{data:jobs,error}=await query;
  if(error){host.innerHTML=`<div class="muted">${esc(error.message)}</div>`;return}
  jobs=(jobs||[]).filter(j=>!from||new Date(inventoryJobDate(j)||0)>=new Date(from+'T00:00:00'));
  if(!jobs.length){inventoryBackfillCache=[];host.innerHTML='<div class="muted">No completed jobs found for this date range.</div>';return}

  let ids=jobs.map(j=>j.id),quoteIds=jobs.map(j=>j.quote_id).filter(Boolean);
  let [plansRes,consRes,optRes,products]=await Promise.all([
    sb.from('job_material_plans').select('*').in('job_id',ids),
    sb.from('film_inventory_consumptions').select('job_id,reversed_at').in('job_id',ids),
    quoteIds.length?sb.from('roll_optimization_plans').select('id,quote_id,roll_width,linear_inches_required,created_at').in('quote_id',quoteIds).order('created_at',{ascending:false}):Promise.resolve({data:[]}),
    inventoryProducts()
  ]);

  let planMap=Object.fromEntries((plansRes.data||[]).map(x=>[x.job_id,x]));
  let consumed=new Set((consRes.data||[]).filter(x=>!x.reversed_at).map(x=>x.job_id));
  let optimizerMap={};
  for(let p of (optRes.data||[])){if(!optimizerMap[p.quote_id])optimizerMap[p.quote_id]=p}

  inventoryBackfillCache=jobs.map(j=>{
    let q=j.quote||{},plan=planMap[j.id]||null,opt=optimizerMap[j.quote_id]||null;
    let product=products.find(p=>p.name===q.square_catalog_item_name)||null;
    let usedSqft=plan?invSqft(plan.roll_width_inches,plan.actual_linear_inches??plan.planned_linear_inches):(opt?optimizerMaterialSqft(opt):null);
    let wasteSqft=plan?Math.max(0,usedSqft-Number(q.total_sqft||0)):(opt?optimizerWasteSqft(opt,q.total_sqft):null);
    let source=plan?(plan.source||'manual'):(opt?'optimizer':'manual');
    return {job:j,plan,opt,product,usedSqft,wasteSqft,source,processed:consumed.has(j.id)};
  });
  renderInventoryBackfill();
}

function renderInventoryBackfill(){
  let host=$('inventoryBackfillList');if(!host)return;
  host.innerHTML=inventoryBackfillCache.length?inventoryBackfillCache.map((x,i)=>{
    let j=x.job,q=j.quote||{},cust=q.customer||{},name=[cust.first_name,cust.last_name].filter(Boolean).join(' ')||j.title||q.project_name||'Completed Job';
    let date=inventoryJobDate(j),film=x.product?.name||q.square_catalog_item_name||'';
    return `<div class="inventory-backfill-row ${x.processed?'processed':''}">
      <div class="inventory-backfill-main">
        <div><b>${esc(name)}</b><div class="muted">${date?new Date(date).toLocaleDateString():''} • ${esc(q.project_name||j.title||'Job')} • ${Number(q.total_sqft||0).toFixed(2)} glass sq ft</div></div>
        <span class="pill">${x.processed?'Already Deducted':x.opt?'Optimizer Found':'Needs Entry'}</span>
      </div>
      <div class="inventory-backfill-fields">
        <select data-backfillproduct="${i}" ${x.processed?'disabled':''}>
          <option value="">Select film…</option>
          ${inventoryProductCache.map(p=>`<option value="${p.id}" ${p.id===x.product?.id?'selected':''}>${esc(p.name)}</option>`).join('')}
        </select>
        <input data-backfillsqft="${i}" type="number" min="0" step="0.01" placeholder="Defaults to ${Number(q.total_sqft||0).toFixed(2)} sq ft" value="${x.usedSqft==null?'':invFmt(x.usedSqft,2)}" ${x.processed?'disabled':''}>
        <div class="muted">${x.processed?'Inventory already reflects this job.':x.opt?`Optimizer: ${invFmt(x.usedSqft,2)} sq ft pulled • ${invFmt(x.wasteSqft,2)} sq ft waste included.`:`Leave blank to deduct the job glass area (${Number(q.total_sqft||0).toFixed(2)} sq ft), or enter the actual total sq ft of film used.`}</div>
        ${x.processed?'':`<button class="btn primary" data-backfillapply="${i}">Deduct Historical Job</button>`}
      </div>
    </div>`
  }).join(''):'<div class="muted">No completed jobs loaded.</div>';

  host.querySelectorAll('[data-backfillapply]').forEach(b=>b.onclick=()=>applyHistoricalInventoryJob(Number(b.dataset.backfillapply)));
}

async function applyHistoricalInventoryJob(i){
  let x=inventoryBackfillCache[i];if(!x||x.processed)return;
  let q=x.job.quote||{},
      productId=document.querySelector(`[data-backfillproduct="${i}"]`)?.value,
      raw=document.querySelector(`[data-backfillsqft="${i}"]`)?.value??'',
      sqft=raw.trim()===''?Number(q.total_sqft||0):Number(raw);
  if(!productId||!Number.isFinite(sqft)||sqft<=0)return toast('Select the film and enter the square feet used, or leave it blank to use the job square footage.');
  let product=inventoryProductCache.find(p=>p.id===productId),
      width=Number(x.opt?.roll_width)||Number(product?.default_roll_width_inches)||72,
      linearInches=invLinearInchesFromSqft(sqft,width),
      glassSqft=Number(q.total_sqft||0),
      wasteSqft=Math.max(0,sqft-glassSqft);
  if(!confirm(`Deduct ${sqft.toFixed(2)} sq ft from inventory for this completed historical job?\n\nGlass: ${glassSqft.toFixed(2)} sq ft\nWaste/overage included: ${wasteSqft.toFixed(2)} sq ft`))return;

  let optimizerId=x.opt?.id||null,source=x.opt?'optimizer':'manual';
  let{error:planError}=await sb.from('job_material_plans').upsert({
    job_id:x.job.id,
    product_id:productId,
    source,
    optimizer_plan_id:optimizerId,
    planned_linear_inches:linearInches,
    actual_linear_inches:linearInches,
    roll_width_inches:width,
    notes:`Historical inventory backfill: ${sqft.toFixed(2)} sq ft total film used; ${wasteSqft.toFixed(2)} sq ft waste/overage`,
    updated_at:new Date().toISOString()
  },{onConflict:'job_id'});
  if(planError)return toast(planError.message);

  let{error}=await sb.rpc('inventory_finalize_job',{p_job_id:x.job.id});
  if(error)return toast(error.message);

  toast(`Historical job deducted: ${sqft.toFixed(2)} sq ft including ${wasteSqft.toFixed(2)} sq ft waste.`);
  await loadInventory();
  await loadInventoryBackfill();
  dashboard();
}

async function autoBackfillCompletedJobs(){
  let pending=inventoryBackfillCache.filter(x=>!x.processed&&x.opt&&x.product&&Number(x.usedSqft)>0);
  if(!pending.length)return toast('No completed jobs with saved optimizer plans are ready for automatic backfill.');
  let totalWaste=pending.reduce((s,x)=>s+Number(x.wasteSqft||0),0);
  if(!confirm(`Automatically deduct ${pending.length} completed job${pending.length===1?'':'s'} using their saved Roll Optimizer plans?\n\nThis includes ${totalWaste.toFixed(2)} sq ft of calculated optimizer waste across those jobs.\n\nJobs without an optimizer plan will remain for manual square-foot entry.`))return;
  let done=0;
  for(let x of pending){
    let q=x.job.quote||{},
        width=Number(x.opt.roll_width)||Number(x.product.default_roll_width_inches)||72,
        usedSqft=optimizerMaterialSqft(x.opt),
        wasteSqft=optimizerWasteSqft(x.opt,q.total_sqft);
    let{error:planError}=await sb.from('job_material_plans').upsert({
      job_id:x.job.id,product_id:x.product.id,source:'optimizer',optimizer_plan_id:x.opt.id,
      planned_linear_inches:Number(x.opt.linear_inches_required),actual_linear_inches:Number(x.opt.linear_inches_required),
      roll_width_inches:width,
      notes:`Historical optimizer backfill: ${usedSqft.toFixed(2)} sq ft total material; ${wasteSqft.toFixed(2)} sq ft calculated waste`,
      updated_at:new Date().toISOString()
    },{onConflict:'job_id'});
    if(planError)continue;
    let{error}=await sb.rpc('inventory_finalize_job',{p_job_id:x.job.id});
    if(!error)done++;
  }
  toast(`${done} historical completed job${done===1?'':'s'} deducted with optimizer waste included.`);
  await loadInventory();await loadInventoryBackfill();dashboard()
}


let scrapInventoryCache=[];

const scrapFilmAliases={
  '15c':'15% Ceramic Tint Install','15ceramic':'15% Ceramic Tint Install',
  '25c':'25% Ceramic Tint Install','25ceramic':'25% Ceramic Tint Install',
  '35c':'35% Ceramic Tint Install','35ceramic':'35% Ceramic Tint Install',
  '45c':'45% Ceramic Tint Install','45ceramic':'45% Ceramic Tint Install',
  'sec':'2 Mil Security Film','security':'2 Mil Security Film','2mil':'2 Mil Security Film',
  'bo':'Blackout Tint Install','blackout':'Blackout Tint Install',
  'solar':'Budget Friendly Solar Control','budget':'Budget Friendly Solar Control'
};

function parseScrapEntry(text){
  let raw=String(text||'').trim();
  if(!raw)return null;
  let normalized=raw.toLowerCase().replace(/[″"]/g,'').replace(/\s+/g,' ').trim();
  let dim=normalized.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if(!dim)return null;
  let width=Number(dim[1]),height=Number(dim[2]);
  if(!(width>0&&height>0))return null;
  let tail=normalized.slice(dim.index+dim[0].length).trim();
  let token=tail.replace(/[^a-z0-9%]/g,'');
  let filmName=scrapFilmAliases[token]||null;
  if(!filmName){
    if(token.includes('25'))filmName='25% Ceramic Tint Install';
    else if(token.includes('15'))filmName='15% Ceramic Tint Install';
    else if(token.includes('35'))filmName='35% Ceramic Tint Install';
    else if(token.includes('45'))filmName='45% Ceramic Tint Install';
    else if(token.includes('security')||token.includes('2mil'))filmName='2 Mil Security Film';
    else if(token.includes('blackout'))filmName='Blackout Tint Install';
  }
  return {width,height,filmName,raw,sqft:width*height/144};
}

async function loadScrapInventory(){
  let host=$('scrapInventoryList');
  if(!host)return;
  host.innerHTML='<div class="muted">Loading scrap cutoffs…</div>';
  let{data,error}=await sb.from('film_scrap_inventory').select('*,product:film_inventory_products(name)').in('status',['available','reserved']).order('created_at',{ascending:false});
  if(error){host.innerHTML=`<div class="muted">${esc(error.message)}</div>`;return}
  scrapInventoryCache=data||[];
  renderScrapInventory();
}

let selectedScrapIds=new Set();
function toggleScrapSelection(id,checked){
  if(checked)selectedScrapIds.add(id);else selectedScrapIds.delete(id);
  updateScrapBulkBar();
}
function updateScrapBulkBar(){
  let bar=$('scrapBulkActions'),count=$('scrapSelectedCount'),btn=$('markSelectedScrapsUsed');
  let n=selectedScrapIds.size;
  if(count)count.textContent=`${n} selected`;
  if(btn){btn.disabled=n===0;btn.textContent=n?`Mark ${n} Used`:'Mark Selected Used'}
  if(bar)bar.classList.toggle('has-selection',n>0);
}
function clearScrapSelection(){
  selectedScrapIds.clear();
  document.querySelectorAll('[data-scrapused]').forEach(x=>x.checked=false);
  updateScrapBulkBar();
}
async function markSelectedScrapsUsed(){
  let ids=[...selectedScrapIds];
  if(!ids.length)return toast('Select one or more scrap pieces first.');
  let selected=scrapInventoryCache.filter(x=>ids.includes(x.id));
  let total=selected.reduce((s,x)=>s+Number(x.square_feet||0),0);
  if(!confirm(`Mark ${ids.length} selected scrap piece${ids.length===1?'':'s'} as USED?\n\nTotal material: ${invFmt(total,2)} sq ft\n\nThey will be removed from available scrap inventory.`))return;
  let{error}=await sb.from('film_scrap_inventory').update({
    status:'used',used_at:new Date().toISOString(),used_by:session?.user?.id||null
  }).in('id',ids);
  if(error)return toast(error.message);
  selectedScrapIds.clear();
  toast(`${ids.length} scrap piece${ids.length===1?'':'s'} marked used.`);
  await loadScrapInventory();
}
function renderScrapInventory(){
  let host=$('scrapInventoryList');if(!host)return;

  let total=scrapInventoryCache.reduce((s,x)=>s+Number(x.square_feet||0),0);
  let availableCount=scrapInventoryCache.filter(x=>x.status==='available').length,
      reservedCount=scrapInventoryCache.filter(x=>x.status==='reserved').length;

  if($('scrapInventorySummary')){
    $('scrapInventorySummary').textContent=`${availableCount} available • ${reservedCount} reserved • ${invFmt(total,2)} sq ft`;
  }

  if(!scrapInventoryCache.length){
    host.innerHTML='<div class="muted">No available or reserved scrap cutoffs.</div>';
    return;
  }

  const priorityOrder=[
    '25% Ceramic Tint Install','35% Ceramic Tint Install','45% Ceramic Tint Install',
    '15% Ceramic Tint Install','2 Mil Security Film','Blackout Tint Install',
    'Budget Friendly Solar Control'
  ];

  let filmGroups={};
  for(let scrap of scrapInventoryCache){
    let film=scrap.product?.name||'Other Film';
    if(!filmGroups[film])filmGroups[film]=[];
    filmGroups[film].push(scrap);
  }

  let filmNames=Object.keys(filmGroups).sort((a,b)=>{
    let ai=priorityOrder.indexOf(a),bi=priorityOrder.indexOf(b);
    if(ai===-1)ai=999;if(bi===-1)bi=999;
    return ai-bi||a.localeCompare(b);
  });

  host.innerHTML=filmNames.map(film=>{
    let filmPieces=filmGroups[film];
    let shortName=film.replace(' Tint Install','');
    let filmSqft=filmPieces.reduce((s,x)=>s+Number(x.square_feet||0),0);
    let filmAvailable=filmPieces.filter(x=>x.status==='available').length;
    let filmReserved=filmPieces.filter(x=>x.status==='reserved').length;

    // Group physical scrap records by exact WxH dimensions.
    let sizeGroups={};
    for(let s of filmPieces){
      let w=Number(s.width_inches)||0,h=Number(s.height_inches)||0;
      let key=`${w}|${h}`;
      if(!sizeGroups[key])sizeGroups[key]={w,h,pieces:[]};
      sizeGroups[key].pieces.push(s);
    }

    let sizes=Object.values(sizeGroups).sort((a,b)=>{
      if(a.w!==b.w)return b.w-a.w;
      if(a.h!==b.h)return b.h-a.h;
      return 0;
    });

    return `<details class="scrap-film-group inventory-accordion">
      <summary class="scrap-film-header">
        <div>
          <h3>${esc(shortName)}</h3>
          <div class="muted">${filmAvailable} available • ${filmReserved} reserved</div>
        </div>
        <div class="scrap-film-total">${invFmt(filmSqft,2)}<small>sq ft scraps</small></div>
      </summary>

      <div class="scrap-film-pieces inventory-accordion-body">
        ${sizes.map(g=>{
          let available=g.pieces.filter(x=>x.status==='available').length;
          let reserved=g.pieces.filter(x=>x.status==='reserved').length;
          let eachSqft=g.w*g.h/144;
          return `<details class="scrap-size-group">
            <summary class="scrap-size-summary">
              <div>
                <b>${g.w}″ × ${g.h}″</b>
                <span class="scrap-qty">QTY ${g.pieces.length}</span>
              </div>
              <div class="scrap-size-meta">
                <span>${available} available${reserved?` • ${reserved} reserved`:''}</span>
                <b>${invFmt(eachSqft,2)} sq ft ea.</b>
              </div>
            </summary>

            <div class="scrap-size-items">
              ${g.pieces
                .sort((a,b)=>a.status===b.status?String(a.id).localeCompare(String(b.id)):(a.status==='available'?-1:1))
                .map((s,idx)=>`
                <label class="scrap-card ${s.status==='reserved'?'scrap-reserved':''}">
                  <div class="scrap-check-wrap">
                    <input type="checkbox" data-scrapused="${s.id}" aria-label="Mark scrap ${idx+1} used">
                  </div>
                  <div class="scrap-main">
                    <div class="head" style="margin:0">
                      <div>
                        <b>Piece ${idx+1}</b>
                        <div class="muted">${g.w}″ × ${g.h}″ • ${invFmt(s.square_feet,2)} sq ft</div>
                      </div>
                      <span class="pill ${s.status==='reserved'?'warn':''}">${s.status==='reserved'?'Reserved':'Available'}</span>
                    </div>
                    ${s.status==='reserved'?`<div class="muted"><b>Reserved for optimized job.</b></div>`:''}
                    ${s.notes?`<div class="muted">${esc(s.notes)}</div>`:''}
                    ${s.status==='reserved'?`<button class="btn mini" type="button" data-scraprelease="${s.id}">Release Reservation</button>`:''}
                  </div>
                  <button class="btn danger mini" type="button" data-scrapdelete="${s.id}">×</button>
                </label>`).join('')}
            </div>
          </details>`
        }).join('')}
      </div>
    </details>`;
  }).join('');

  host.querySelectorAll('[data-scrapused]').forEach(c=>{c.checked=selectedScrapIds.has(c.dataset.scrapused);c.onchange=()=>toggleScrapSelection(c.dataset.scrapused,c.checked)});updateScrapBulkBar();
  host.querySelectorAll('[data-scraprelease]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();releaseScrapReservation(b.dataset.scraprelease)});
  host.querySelectorAll('[data-scrapdelete]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();deleteScrap(b.dataset.scrapdelete)});
}
async function addScrapFromQuickEntry(){
  let text=$('scrapQuickEntry').value.trim();
  if(!text)return toast('Enter a scrap size, for example: 34x28 25c');
  let entries=text.split(/\n|,/).map(x=>x.trim()).filter(Boolean),added=0;
  if(!inventoryProductCache.length){try{await inventoryProducts()}catch(e){return toast(e.message)}}
  for(let entry of entries){
    let parsed=parseScrapEntry(entry);
    if(!parsed)continue;
    let product=inventoryProductCache.find(p=>p.name===parsed.filmName);
    if(!product)continue;
    let{error}=await sb.from('film_scrap_inventory').insert({
      product_id:product.id,width_inches:parsed.width,height_inches:parsed.height,
      square_feet:Number(parsed.sqft.toFixed(4)),label:entry,status:'available',
      created_by:session?.user?.id||null
    });
    if(!error)added++;
  }
  if(!added)return toast('No scraps were added. Use format like 34x28 25c.');
  $('scrapQuickEntry').value='';
  toast(`${added} scrap piece${added===1?'':'s'} added.`);
  await loadScrapInventory();
}

async function addScrapManual(){
  let productId=$('scrapProduct').value,w=Number($('scrapWidth').value),h=Number($('scrapHeight').value),notes=$('scrapNotes').value.trim();
  if(!productId||!(w>0)||!(h>0))return toast('Choose film and enter width and height.');
  let sqft=w*h/144;
  let{error}=await sb.from('film_scrap_inventory').insert({
    product_id:productId,width_inches:w,height_inches:h,square_feet:Number(sqft.toFixed(4)),
    notes,status:'available',created_by:session?.user?.id||null
  });
  if(error)return toast(error.message);
  $('scrapWidth').value='';$('scrapHeight').value='';$('scrapNotes').value='';
  toast(`Scrap added: ${invFmt(sqft,2)} sq ft.`);
  await loadScrapInventory();
}

async function markScrapUsed(id){
  let s=scrapInventoryCache.find(x=>x.id===id);if(!s)return;
  if(!confirm(`Mark ${Number(s.width_inches)}″ × ${Number(s.height_inches)}″ ${s.product?.name||'scrap'} as USED?\n\nIt will disappear from available scrap inventory.`)){
    renderScrapInventory();return;
  }
  let{error}=await sb.from('film_scrap_inventory').update({
    status:'used',used_at:new Date().toISOString(),used_by:session?.user?.id||null
  }).eq('id',id);
  if(error)return toast(error.message);
  toast('Scrap marked used.');
  await loadScrapInventory();
}


async function releaseScrapReservation(id){
  let{error}=await sb.from('film_scrap_inventory').update({status:'available',reserved_quote_id:null,reserved_at:null}).eq('id',id);
  if(error)return toast(error.message);
  toast('Scrap reservation released.');
  await loadScrapInventory();
}

async function deleteScrap(id){
  if(!confirm('Remove this scrap record completely?'))return;
  let{error}=await sb.from('film_scrap_inventory').delete().eq('id',id);
  if(error)return toast(error.message);
  toast('Scrap removed.');
  await loadScrapInventory();
}

async function findScrapsForWindow(width,height,productId=null){
  let w=Number(width),h=Number(height);if(!(w>0&&h>0))return[];
  let q=sb.from('film_scrap_inventory').select('*,product:film_inventory_products(name)').eq('status','available');
  if(productId)q=q.eq('product_id',productId);
  let{data,error}=await q;if(error)return[];
  return (data||[]).filter(s=>{
    let sw=Number(s.width_inches),sh=Number(s.height_inches);
    return (sw>=w&&sh>=h)||(sw>=h&&sh>=w)
  }).sort((a,b)=>Number(a.square_feet)-Number(b.square_feet));
}

async function loadInventory(){
  let host=$('inventoryStatusList');if(host)host.innerHTML='<div class="card muted">Loading film inventory…</div>';
  try{
    await reconcileCurrentScheduledReservations();
    let[statusResult,rollResult,products]=await Promise.all([
      sb.from('inventory_product_status').select('*').eq('active',true).order('product_name'),
      sb.from('film_inventory_rolls').select('*,product:film_inventory_products(name)').order('created_at'),
      inventoryProducts()
    ]);
    if(statusResult.error)throw statusResult.error;if(rollResult.error)throw rollResult.error;
    inventoryStatusCache=statusResult.data||[];inventoryRollCache=rollResult.data||[];
    populateInventoryProductSelects(products);renderInventory();loadScrapInventory()
  }catch(e){if(host)host.innerHTML=`<div class="card inventory-alert"><b>Inventory database isn't installed yet.</b><div class="muted">${esc(e.message)}</div><div style="margin-top:8px">Run <b>INVENTORY-MANAGEMENT-MIGRATION.sql</b> in Supabase SQL Editor.</div></div>`}
}
function populateInventoryProductSelects(products=inventoryProductCache){
  let html='<option value="">Select film…</option>'+products.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  ['inventoryRollProduct','scheduleFilmProduct','scrapProduct'].forEach(id=>{let s=$(id);if(!s)return;let v=s.value;s.innerHTML=html;if(v&&products.some(p=>p.id===v))s.value=v})
}
function renderInventory(){
  let status=$('inventoryStatusList'),rolls=$('inventoryRollList');

  if(status){
    status.innerHTML=inventoryStatusCache.length?inventoryStatusCache.map(x=>{
      let projected=Number(x.projected_sqft)||0,
          threshold=Number(x.reorder_threshold_sqft)||75,
          low=projected<=threshold,
          onHand=Number(x.on_hand_sqft)||0,
          reserved=Number(x.reserved_sqft)||0;

      return `<details class="inventory-product-card inventory-accordion ${low?'inventory-low':''}">
        <summary class="inventory-product-summary app-film-summary">
          <div class="inventory-summary-name">
            <b>${esc(x.product_name)}</b>
            <span class="muted">${Number(x.active_roll_count)||0} active roll${Number(x.active_roll_count)===1?'':'s'} • ${invFmt(projected,1)} sq ft available</span>
            <span class="app-inline-stock ${low?'low':''}">${low?'ORDER SOON':'IN STOCK'}</span>
            ${inventoryProductCache.find(p=>p.id===x.product_id)?.notify_low_inventory===false?'<span class="inventory-alert-muted">LOW ALERT OFF</span>':''}
          </div>
          ${inventorySqftDisplay(projected,'md')}
          <button type="button" class="film-edit-button" data-editfilm="${x.product_id}" aria-label="Edit film inventory">Edit</button>
        </summary>

        <div class="inventory-accordion-body">
          <div class="inventory-metrics editable-metrics">
            <button type="button" data-invmetric="physical" data-productid="${x.product_id}"><span>Physical On Hand</span><b>${invFmt(onHand)}</b><small>sq ft • tap to adjust</small></button>
            <button type="button" data-invmetric="reserved" data-productid="${x.product_id}"><span>Scheduled / Reserved</span><b>${invFmt(reserved)}</b><small>sq ft • tap to edit</small></button>
            <button type="button" data-invmetric="projected" data-productid="${x.product_id}" class="${low?'inventory-danger':''}"><span>Projected Available</span><b>${invFmt(projected)}</b><small>sq ft • tap for sources</small></button>
            <button type="button" data-invmetric="threshold" data-productid="${x.product_id}" data-current="${threshold}"><span>Reorder Level</span><b>${invFmt(threshold,0)}</b><small>sq ft • tap to change</small></button>
          </div>
          <div class="muted">${invFmt(x.default_roll_width_inches,0)}″ standard roll width • ${Number(x.reserved_job_count)||0} scheduled job${Number(x.reserved_job_count)===1?'':'s'} reserving material</div>
          <div class="actions">
            <button class="btn" data-invthreshold="${x.product_id}" data-current="${threshold}">Change Reorder Level</button>
            <button class="btn" data-invaddroll="${x.product_id}">Add Roll</button>
          </div>
        </div>
      </details>`
    }).join(''):'<div class="card muted">No film types yet.</div>';
  }

  if(rolls){
    let activeRolls=inventoryRollCache.filter(r=>Number(r.remaining_length_inches)>0);
    let emptyRolls=inventoryRollCache.filter(r=>Number(r.remaining_length_inches)<=0);
    let grouped={};
    activeRolls.forEach(r=>{
      let name=r.product?.name||'Film';
      (grouped[name]??=[]).push(r);
    });
    let filmNames=Object.keys(grouped).sort((a,b)=>{
      let order=['25% Ceramic Tint Install','35% Ceramic Tint Install','45% Ceramic Tint Install'];
      let ai=order.indexOf(a),bi=order.indexOf(b);if(ai<0)ai=999;if(bi<0)bi=999;
      return ai-bi||a.localeCompare(b);
    });

    rolls.innerHTML=filmNames.length?filmNames.map(name=>{
      let rows=grouped[name].sort((a,b)=>Number(b.remaining_length_inches)-Number(a.remaining_length_inches));
      let totalSqft=rows.reduce((s,r)=>s+invSqft(r.roll_width_inches,r.remaining_length_inches),0);
      return `<details class="inventory-roll-group inventory-accordion">
        <summary class="inventory-roll-group-summary">
          <div><b>${esc(name)}</b><span class="muted">${rows.length} active roll${rows.length===1?'':'s'}</span></div>
          <div><b>${invFmt(totalSqft,1)} sq ft</b><span class="app-chevron">›</span></div>
        </summary>
        <div class="inventory-accordion-body">
          ${rows.map(r=>`
            <details class="inventory-roll-card inventory-accordion">
              <summary class="inventory-roll-summary">
                <div>
                  <b>${esc(r.label||'Roll')}</b>
                  <div class="muted">${invFmt(r.roll_width_inches,0)}″ wide</div>
                </div>
                <div class="inventory-roll-balance">
                  <b>${invFmt(invSqft(r.roll_width_inches,r.remaining_length_inches),1)} sq ft</b>
                  <small>${invFmt(invFeet(r.remaining_length_inches),1)} linear ft</small>
                </div>
              </summary>
              <div class="inventory-accordion-body">
                <div class="actions">
                  <button class="btn primary" data-invpullroll="${r.id}">Pull Film</button>
                  <button class="btn" data-invadjustroll="${r.id}">Set Remaining</button>
                  <button class="btn danger" data-invdeleteroll="${r.id}">Remove</button>
                </div>
              </div>
            </details>`).join('')}
        </div>
      </details>`
    }).join(''):'<div class="card muted">No active rolls on hand.</div>';

    if(emptyRolls.length){
      rolls.innerHTML+=`<details class="inventory-empty-rolls inventory-accordion">
        <summary><div><b>Empty / Used-Up Rolls</b><span class="muted">${emptyRolls.length} roll${emptyRolls.length===1?'':'s'} • excluded from Film Inventory totals</span></div><span class="app-chevron">›</span></summary>
        <div class="inventory-accordion-body">${emptyRolls.map(r=>`<div class="empty-roll-row"><span>${esc(r.product?.name||'Film')} • ${esc(r.label||'Roll')}</span><button class="btn danger mini" data-invdeleteroll="${r.id}">Remove</button></div>`).join('')}</div>
      </details>`;
    }
  }

  document.querySelectorAll('[data-editfilm]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openInventoryMetricEditor(b.dataset.editfilm,'projected')});
  document.querySelectorAll('[data-invmetric]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openInventoryMetricEditor(b.dataset.productid,b.dataset.invmetric)});
  document.querySelectorAll('[data-invthreshold]').forEach(b=>b.onclick=e=>{e.preventDefault();changeInventoryThreshold(b.dataset.invthreshold,Number(b.dataset.current))});
  document.querySelectorAll('[data-invaddroll]').forEach(b=>b.onclick=e=>{e.preventDefault();openAddRollModal(b.dataset.invaddroll)});
  document.querySelectorAll('[data-invpullroll]').forEach(b=>b.onclick=e=>{e.preventDefault();openManualFilmPull(b.dataset.invpullroll)});
  document.querySelectorAll('[data-invadjustroll]').forEach(b=>b.onclick=e=>{e.preventDefault();adjustInventoryRoll(b.dataset.invadjustroll)});
  document.querySelectorAll('[data-invdeleteroll]').forEach(b=>b.onclick=e=>{e.preventDefault();deleteInventoryRoll(b.dataset.invdeleteroll)})
}

let inventoryMetricProductId=null,inventoryMetricReservations=[];

async function openInventoryMetricEditor(productId,focus='projected'){
  let row=inventoryStatusCache.find(x=>x.product_id===productId);
  if(!row){
    let{data,error}=await sb.from('inventory_product_status').select('*').eq('product_id',productId).maybeSingle();
    if(error||!data)return toast(error?.message||'Inventory film not found.');
    row=data;
  }
  inventoryMetricProductId=productId;
  let rolls=inventoryRollCache.filter(r=>r.product_id===productId&&Number(r.remaining_length_inches)>0);
  $('inventoryMetricTitle').textContent=row.product_name||'Film Inventory';
  $('inventoryMetricSubtitle').textContent=`${invFmt(row.projected_sqft,1)} sq ft projected available`;
  $('inventoryMetricThreshold').value=Number(row.reorder_threshold_sqft)||75;
  let productSettings=inventoryProductCache.find(p=>p.id===productId);
  if(!productSettings){
    let pr=await sb.from('film_inventory_products').select('id,notify_low_inventory').eq('id',productId).maybeSingle();
    productSettings=pr.data||null;
  }
  if($('inventoryMetricLowStockNotify'))$('inventoryMetricLowStockNotify').checked=productSettings?.notify_low_inventory!==false;

  $('inventoryMetricRolls').innerHTML=rolls.length?rolls.map((r,i)=>`
    <div class="metric-roll-editor">
      <div><b>${esc(r.label||`Roll ${i+1}`)}</b><small>${invFmt(r.roll_width_inches,0)}″ wide • ${invFmt(invFeet(r.remaining_length_inches),1)} linear ft</small></div>
      <label><span>sq ft remaining</span><input type="number" min="0" step="0.01" value="${invFmt(invSqft(r.roll_width_inches,r.remaining_length_inches),2)}" data-metricroll="${r.id}" data-width="${r.roll_width_inches}" data-oldinches="${r.remaining_length_inches}"></label>
    </div>`).join(''):'<div class="app-empty">No active rolls. Add a roll to establish physical inventory.</div>';

  let{data:plans,error:planError}=await sb.from('job_material_plans')
    .select('id,job_id,product_id,roll_width_inches,planned_linear_inches,actual_linear_inches,source,job:jobs!job_material_plans_job_id_fkey(id,title,status,scheduled_start,quote:quotes!jobs_quote_id_fkey(project_name,customer:customers(first_name,last_name)))')
    .eq('product_id',productId);
  if(planError){
    console.warn('Reservation editor query:',planError);
    plans=[];
  }
  inventoryMetricReservations=(plans||[]).filter(p=>['Scheduled','Confirmed','Rescheduled','En Route','In Progress'].includes(p.job?.status));
  $('inventoryMetricReservations').innerHTML=inventoryMetricReservations.length?inventoryMetricReservations.map(p=>{
    let c=p.job?.quote?.customer||{},name=[c.first_name,c.last_name].filter(Boolean).join(' ')||p.job?.quote?.project_name||p.job?.title||'Scheduled Job';
    let sqft=invSqft(p.roll_width_inches,p.actual_linear_inches==null?p.planned_linear_inches:p.actual_linear_inches);
    return `<div class="metric-reservation-editor">
      <div><b>${esc(name)}</b><small>${p.job?.scheduled_start?new Date(p.job.scheduled_start).toLocaleDateString():''} • ${esc(p.job?.status||'')}</small></div>
      <label><span>reserved sq ft</span><input type="number" min="0" step="0.01" value="${invFmt(sqft,2)}" data-metricplan="${p.id}" data-width="${p.roll_width_inches}"></label>
    </div>`
  }).join(''):'<div class="app-empty">No active scheduled reservations for this film.</div>';

  let physical=Number(row.on_hand_sqft)||0,reserved=Number(row.reserved_sqft)||0,projected=Number(row.projected_sqft)||0;
  $('inventoryMetricSummary').innerHTML=`
    <button data-metricjump="physical"><span>Physical</span><b>${invFmt(physical,1)}</b><small>sq ft</small></button>
    <button data-metricjump="reserved"><span>Reserved</span><b>${invFmt(reserved,1)}</b><small>sq ft</small></button>
    <button data-metricjump="projected"><span>Projected</span><b>${invFmt(projected,1)}</b><small>sq ft</small></button>
    <button data-metricjump="threshold"><span>Reorder</span><b>${invFmt(row.reorder_threshold_sqft,0)}</b><small>sq ft</small></button>`;
  $('inventoryMetricSummary').querySelectorAll('[data-metricjump]').forEach(b=>b.onclick=()=>inventoryMetricFocus(b.dataset.metricjump));

  $('inventoryMetricModal').classList.add('show');
  setTimeout(()=>inventoryMetricFocus(focus),30);
}

function inventoryMetricFocus(focus){
  let id=focus==='physical'?'inventoryMetricPhysical':focus==='reserved'?'inventoryMetricReserved':focus==='threshold'?'inventoryMetricReorder':'inventoryMetricProjected';
  $(id)?.scrollIntoView({behavior:'smooth',block:'center'});
  document.querySelectorAll('.inventory-metric-section').forEach(x=>x.classList.remove('metric-focus'));
  $(id)?.classList.add('metric-focus');
}

async function saveInventoryMetricEditor(){
  if(!inventoryMetricProductId)return;
  let rollInputs=[...$('inventoryMetricRolls').querySelectorAll('[data-metricroll]')];
  let planInputs=[...$('inventoryMetricReservations').querySelectorAll('[data-metricplan]')];
  let threshold=Number($('inventoryMetricThreshold').value);
  if(!Number.isFinite(threshold)||threshold<0)return toast('Enter a valid reorder level.');

  let errors=[];
  for(let input of rollInputs){
    let sqft=Number(input.value),width=Number(input.dataset.width)||72,oldInches=Number(input.dataset.oldinches)||0;
    if(!Number.isFinite(sqft)||sqft<0){errors.push('Invalid physical inventory amount.');continue}
    let newInches=invLinearInchesFromSqft(sqft,width);
    if(Math.abs(newInches-oldInches)<0.01)continue;
    let r=await sb.from('film_inventory_rolls').update({remaining_length_inches:newInches,updated_at:new Date().toISOString()}).eq('id',input.dataset.metricroll);
    if(r.error){errors.push(r.error.message);continue}
    await sb.from('film_inventory_adjustments').insert({roll_id:input.dataset.metricroll,old_length_inches:oldInches,new_length_inches:newInches,reason:'Metric editor physical inventory correction',created_by:session?.user?.id||null});
  }

  for(let input of planInputs){
    let sqft=Number(input.value),width=Number(input.dataset.width)||72;
    if(!Number.isFinite(sqft)||sqft<0){errors.push('Invalid reservation amount.');continue}
    let inches=invLinearInchesFromSqft(sqft,width);
    let r=await sb.from('job_material_plans').update({planned_linear_inches:inches,actual_linear_inches:null,updated_at:new Date().toISOString()}).eq('id',input.dataset.metricplan);
    if(r.error)errors.push(r.error.message);
  }

  let lowStockNotify=$('inventoryMetricLowStockNotify')?.checked!==false;
  let tr=await sb.from('film_inventory_products').update({
    reorder_threshold_sqft:threshold,
    notify_low_inventory:lowStockNotify,
    updated_at:new Date().toISOString()
  }).eq('id',inventoryMetricProductId);
  if(tr.error)errors.push(tr.error.message);

  if(errors.length)return toast('Some inventory changes failed: '+errors[0]);
  $('inventoryMetricModal').classList.remove('show');
  toast('Inventory metrics updated.');
  await loadInventory();
  await dashboard();
}

function metricEditorAddRoll(){
  if(!inventoryMetricProductId)return;
  $('inventoryMetricModal').classList.remove('show');
  openAddRollModal(inventoryMetricProductId);
}


function openAddRollModal(productId=null){
  if(productId&&$('inventoryRollProduct'))$('inventoryRollProduct').value=productId;
  $('inventoryAddRollModal')?.classList.add('show');
  setTimeout(()=>$('inventoryRollLength')?.focus(),40);
}
function openAddFilmTypeModal(){
  $('inventoryAddFilmModal')?.classList.add('show');
  setTimeout(()=>$('inventoryProductName')?.focus(),40);
}
function openPullFromMetricFilm(){
  if(!inventoryMetricProductId)return;
  let rolls=inventoryRollCache.filter(r=>r.product_id===inventoryMetricProductId&&Number(r.remaining_length_inches)>0);
  if(!rolls.length)return toast('No active roll is available for this film. Add a roll first.');
  if(rolls.length===1){
    $('inventoryMetricModal')?.classList.remove('show');
    openManualFilmPull(rolls[0].id);
    return;
  }
  let names=rolls.map((r,i)=>`${i+1}. ${r.label||'Roll'} — ${invFmt(invSqft(r.roll_width_inches,r.remaining_length_inches),1)} sq ft`).join('\n');
  let pick=prompt(`Choose a roll to pull from:\n\n${names}`,'1');
  if(pick===null)return;
  let idx=Number(pick)-1;
  if(!Number.isInteger(idx)||idx<0||idx>=rolls.length)return toast('Choose a valid roll number.');
  $('inventoryMetricModal')?.classList.remove('show');
  openManualFilmPull(rolls[idx].id);
}

async function addInventoryProduct(){
  let name=$('inventoryProductName').value.trim(),width=Number($('inventoryProductWidth').value)||72,threshold=Number($('inventoryProductThreshold').value)||75;if(!name)return toast('Enter a film name.');
  let{error}=await sb.from('film_inventory_products').insert({name,default_roll_width_inches:width,reorder_threshold_sqft:threshold});if(error)return toast(error.message);
  $('inventoryProductName').value='';$('inventoryAddFilmModal')?.classList.remove('show');toast('Film type added.');await loadInventory();await dashboard()
}
async function addInventoryRoll(){
  let productId=$('inventoryRollProduct').value,width=Number($('inventoryRollWidth').value)||0,lengthFt=Number($('inventoryRollLength').value)||0,label=$('inventoryRollLabel').value.trim(),notes=$('inventoryRollNotes').value.trim(),receivedDate=$('inventoryRollReceivedDate')?.value||new Date().toISOString().slice(0,10);
  if(!productId||lengthFt<=0)return toast('Select the film and enter the remaining roll length.');
  let p=inventoryProductCache.find(x=>x.id===productId);if(width<=0)width=Number(p?.default_roll_width_inches)||72;let inches=lengthFt*12;
  let{error}=await sb.from('film_inventory_rolls').insert({product_id:productId,label:label||`${lengthFt} ft roll`,roll_width_inches:width,starting_length_inches:inches,remaining_length_inches:inches,received_date:receivedDate,notes});if(error)return toast(error.message);
  $('inventoryRollLength').value='';$('inventoryRollLabel').value='';$('inventoryRollNotes').value='';if($('inventoryRollReceivedDate'))$('inventoryRollReceivedDate').value=new Date().toISOString().slice(0,10);$('inventoryAddRollModal')?.classList.remove('show');toast('Roll added to inventory.');await loadInventory();await dashboard()
}

let manualPullRollId=null,manualPullJobs=[];

async function openManualFilmPull(rollId){
  let roll=inventoryRollCache.find(r=>r.id===rollId);if(!roll)return;
  manualPullRollId=rollId;
  let width=Number(roll.roll_width_inches)||72,maxSqft=invSqft(width,roll.remaining_length_inches);
  $('manualPullFilmName').textContent=roll.product?.name||'Film';
  $('manualPullRollInfo').textContent=`${invFmt(width,0)}″ roll • ${invFmt(maxSqft,2)} sq ft physically available`;
  $('manualPullSqft').value='';
  $('manualPullNotes').value='';
  $('manualPullMessage').textContent='';
  $('manualPullJob').innerHTML='<option value="">No job / general shop pull</option>';
  try{
    let{data,error}=await sb.from('jobs')
      .select('id,title,status,scheduled_start,quote_id,quote:quotes!jobs_quote_id_fkey(project_name,square_catalog_item_name,customer:customers(first_name,last_name))')
      .in('status',['Scheduled','Confirmed','Rescheduled','En Route','In Progress'])
      .order('scheduled_start',{ascending:true});
    if(!error){
      manualPullJobs=(data||[]).filter(j=>!j.quote?.square_catalog_item_name||j.quote.square_catalog_item_name===roll.product?.name);
      $('manualPullJob').innerHTML+=manualPullJobs.map(j=>{let c=j.quote?.customer||{},n=[c.first_name,c.last_name].filter(Boolean).join(' ')||j.title||j.quote?.project_name||'Job',d=j.scheduled_start?new Date(j.scheduled_start).toLocaleDateString():'';return `<option value="${j.id}">${esc(n)}${d?' • '+esc(d):''}</option>`}).join('');
    }
  }catch{}
  $('manualFilmPullModal').classList.add('show');
}

async function saveManualFilmPull(){
  let roll=inventoryRollCache.find(r=>r.id===manualPullRollId);if(!roll)return;
  let sqft=Number($('manualPullSqft').value),jobId=$('manualPullJob').value||null,notes=$('manualPullNotes').value.trim();
  if(!Number.isFinite(sqft)||sqft<=0){$('manualPullMessage').textContent='Enter the square feet you are pulling.';return}
  let maxSqft=invSqft(roll.roll_width_inches,roll.remaining_length_inches);
  if(sqft>maxSqft+0.001){$('manualPullMessage').textContent=`That roll only has ${invFmt(maxSqft,2)} sq ft available.`;return}
  let job=manualPullJobs.find(j=>j.id===jobId),jobName=job?(job.quote?.project_name||job.title||'scheduled job'):'general shop pull';
  if(!confirm(`Pull ${sqft.toFixed(2)} sq ft of ${roll.product?.name||'film'} now?\n\nLinked to: ${jobName}\n\nThis immediately reduces physical roll inventory.${jobId?'\nThe scheduled reservation/final completion will automatically account for this pull so it is not deducted twice.':''}`))return;
  let{data,error}=await sb.rpc('inventory_manual_pull',{p_roll_id:manualPullRollId,p_sqft:sqft,p_job_id:jobId,p_notes:notes||null});
  if(error){$('manualPullMessage').textContent=error.message;return}
  $('manualFilmPullModal').classList.remove('show');
  toast(`Pulled ${sqft.toFixed(2)} sq ft from inventory.`);
  await loadInventory();dashboard();
}

async function adjustInventoryRoll(id){
  let r=inventoryRollCache.find(x=>x.id===id);if(!r)return;let v=prompt(`Set remaining length for ${r.product?.name||'this roll'} (linear feet):`,String(invFmt(invFeet(r.remaining_length_inches),1)));if(v===null)return;
  let ft=Number(v);if(!Number.isFinite(ft)||ft<0)return toast('Enter a valid remaining length.');let reason=prompt('Reason for adjustment (optional):','Physical count / roll measurement')||'Manual adjustment',newInches=ft*12,oldInches=Number(r.remaining_length_inches)||0;
  let{error}=await sb.from('film_inventory_rolls').update({remaining_length_inches:newInches,updated_at:new Date().toISOString()}).eq('id',id);if(error)return toast(error.message);
  await sb.from('film_inventory_adjustments').insert({roll_id:id,old_length_inches:oldInches,new_length_inches:newInches,reason,created_by:session?.user?.id||null});toast('Roll balance updated.');await loadInventory();dashboard()
}
async function deleteInventoryRoll(id){
  let r=inventoryRollCache.find(x=>x.id===id);if(!r||!confirm(`Remove ${r.product?.name||'this roll'} from inventory?\n\nUse Set Remaining instead if you are only correcting the amount.`))return;
  let{error}=await sb.from('film_inventory_rolls').delete().eq('id',id);if(error)return toast(error.message);toast('Roll removed.');await loadInventory();dashboard()
}
async function changeInventoryThreshold(productId,current){
  let v=prompt('Reorder warning threshold in square feet:',String(current||75));if(v===null)return;let n=Number(v);if(!Number.isFinite(n)||n<0)return toast('Enter a valid square-foot threshold.');
  let{error}=await sb.from('film_inventory_products').update({reorder_threshold_sqft:n,updated_at:new Date().toISOString()}).eq('id',productId);if(error)return toast(error.message);toast('Reorder threshold updated.');await loadInventory();dashboard()
}
async function inventoryProductForQuote(q){
  if(!inventoryProductCache.length){try{await inventoryProducts()}catch{return null}}
  let wanted=String(q?.square_catalog_item_name||'').trim().toLowerCase();return inventoryProductCache.find(p=>p.name.toLowerCase()===wanted)||null
}
async function latestOptimizerPlanForQuote(quoteId){
  if(!quoteId)return null;let{data,error}=await sb.from('roll_optimization_plans').select('id,quote_id,roll_width,linear_inches_required,created_at').eq('quote_id',quoteId).order('created_at',{ascending:false}).limit(1).maybeSingle();return error?null:data
}
async function loadScheduleMaterialPlan(quote,jobId){
  let select=$('scheduleFilmProduct'),planned=$('scheduleMaterialLinearFt'),actual=$('scheduleMaterialActualFt'),hint=$('scheduleMaterialHint');if(!select||!planned||!actual)return;
  try{
    let products=await inventoryProducts();populateInventoryProductSelects(products);let existing=null;
    if(jobId){let r=await sb.from('job_material_plans').select('*').eq('job_id',jobId).maybeSingle();existing=r.data||null}
    let product=existing?products.find(p=>p.id===existing.product_id):await inventoryProductForQuote(quote),optimizer=await latestOptimizerPlanForQuote(quote?.id);
    select.value=product?.id||existing?.product_id||'';
    if(existing){
      let plannedSqft=invSqft(existing.roll_width_inches,existing.planned_linear_inches),actualSqft=existing.actual_linear_inches==null?null:invSqft(existing.roll_width_inches,existing.actual_linear_inches),glass=Number(quote?.total_sqft||0);
      planned.value=invFmt(plannedSqft,2);actual.value=actualSqft==null?'':invFmt(actualSqft,2);planned.dataset.source=existing.source||'manual';planned.dataset.optimizerPlanId=existing.optimizer_plan_id||'';planned.dataset.rollWidth=existing.roll_width_inches||product?.default_roll_width_inches||72;
      hint.innerHTML=`<b>${existing.source==='optimizer'?'Optimizer-based plan':'Manual material plan'}</b> • ${invFmt(plannedSqft,2)} sq ft reserved • ${invFmt(Math.max(0,plannedSqft-glass),2)} sq ft waste/overage.`
    }
    else if(optimizer){
      let materialSqft=optimizerMaterialSqft(optimizer),wasteSqft=optimizerWasteSqft(optimizer,quote?.total_sqft);
      planned.value=invFmt(materialSqft,2);actual.value='';planned.dataset.source='optimizer';planned.dataset.optimizerPlanId=optimizer.id;planned.dataset.rollWidth=optimizer.roll_width||product?.default_roll_width_inches||72;
      hint.innerHTML=`<b>Optimizer plan detected.</b> ${invFmt(materialSqft,2)} sq ft total material will be reserved, including ${invFmt(wasteSqft,2)} sq ft calculated waste. Change it anytime to override manually.`
    }
    else{
      let calculatedSqft=Number(quote?.total_sqft)||0;
      planned.value=calculatedSqft>0?invFmt(calculatedSqft,2):'';
      actual.value='';
      planned.dataset.source='calculated';
      planned.dataset.optimizerPlanId='';
      planned.dataset.rollWidth=product?.default_roll_width_inches||72;
      hint.innerHTML=calculatedSqft>0
        ?`<b>Calculated reservation.</b> ${invFmt(calculatedSqft,2)} sq ft from this quote will be reserved immediately when the job is scheduled. Final inventory usage is replaced by your actual material entry when the job is completed.`
        :'<b>No calculated material found.</b> Enter the total square feet of film you expect this job to use.';
    }
    updateScheduleMaterialProjection()
  }catch{hint.textContent='Inventory module not installed yet.'}
}
function updateScheduleMaterialProjection(){
  let select=$('scheduleFilmProduct'),planned=$('scheduleMaterialLinearFt'),host=$('scheduleMaterialProjection');if(!select||!planned||!host)return;
  let p=inventoryProductCache.find(x=>x.id===select.value),sqft=Number(planned.value)||0;host.textContent=sqft>0?`${invFmt(sqft,2)} sq ft of roll material will be reserved while this job is active.`:'No inventory reservation yet.'
}
async function saveScheduleMaterialPlan(jobId){
  let productId=$('scheduleFilmProduct')?.value,plannedSqft=Number($('scheduleMaterialLinearFt')?.value)||0,actualRaw=$('scheduleMaterialActualFt')?.value??'',actualSqft=actualRaw===''?null:Number(actualRaw),plannedEl=$('scheduleMaterialLinearFt');if(!jobId)return;
  if(!productId||plannedSqft<=0){await sb.from('job_material_plans').delete().eq('job_id',jobId);return}
  let p=inventoryProductCache.find(x=>x.id===productId),width=Number(plannedEl.dataset.rollWidth)||Number(p?.default_roll_width_inches)||72,
      plannedLinear=invLinearInchesFromSqft(plannedSqft,width),actualLinear=Number.isFinite(actualSqft)?invLinearInchesFromSqft(actualSqft,width):null;
  let{error}=await sb.from('job_material_plans').upsert({job_id:jobId,product_id:productId,source:plannedEl.dataset.source||'manual',optimizer_plan_id:plannedEl.dataset.optimizerPlanId||null,planned_linear_inches:plannedLinear,actual_linear_inches:actualLinear,roll_width_inches:width,updated_at:new Date().toISOString()},{onConflict:'job_id'});if(error)throw error
}
async function finalizeScheduledJobInventory(jobId,actualOverride=null){
  if(!jobId)return {ok:true,skipped:true};
  let{data:plan,error}=await sb.from('job_material_plans').select('*').eq('job_id',jobId).maybeSingle();
  if(error)throw error;
  if(!plan)return {ok:true,skipped:true};

  let plannedSqft=invSqft(plan.roll_width_inches,plan.planned_linear_inches),
      actualSqft=actualOverride==null?null:Number(actualOverride);

  if(actualSqft==null||!Number.isFinite(actualSqft)){
    let entered=prompt(
      `Final film used for this job (sq ft):\n\nReserved / calculated: ${invFmt(plannedSqft,2)} sq ft\n\nEnter the ACTUAL total film used. This replaces the reservation and becomes the permanent inventory deduction.`,
      invFmt(plannedSqft,2)
    );
    if(entered===null)return {ok:false,canceled:true};
    actualSqft=Number(entered);
  }
  if(!Number.isFinite(actualSqft)||actualSqft<0)throw new Error('Enter a valid actual film usage amount.');

  let actualLinear=invLinearInchesFromSqft(actualSqft,Number(plan.roll_width_inches)||72);
  let u=await sb.from('job_material_plans').update({actual_linear_inches:actualLinear,updated_at:new Date().toISOString()}).eq('job_id',jobId);
  if(u.error)throw u.error;

  let r=await sb.rpc('inventory_finalize_job',{p_job_id:jobId});
  if(r.error)throw r.error;
  return {ok:true,actualSqft};
}

async function applyInventoryToOptimizer(q){
  try{let p=await inventoryProductForQuote(q);if(!p)return;let{data,error}=await sb.from('film_inventory_rolls').select('*').eq('product_id',p.id).gt('remaining_length_inches',0).order('remaining_length_inches',{ascending:false});if(error||!data?.length)return;let r=data[0];$('optimizerRollWidth').value=Number(r.roll_width_inches)||Number(p.default_roll_width_inches)||72;$('optimizerRollLength').value=optimizerRound(invFeet(r.remaining_length_inches),2);$('optimizerMessage').textContent=`Loaded quote and current ${p.name} inventory: ${invFmt(invFeet(r.remaining_length_inches),1)} linear ft available on ${r.label||'the largest active roll'}.`}catch{}
}

function openOrganicLeadModal(){['organicFirstName','organicLastName','organicPhone','organicEmail','organicAddress','organicNotes'].forEach(id=>{if($(id))$(id).value=''});$('organicSource').value='Google';$('organicLeadMessage').textContent='';$('organicLeadModal').classList.add('show')}
async function saveOrganicLead(){let p={first_name:$('organicFirstName').value.trim(),last_name:$('organicLastName').value.trim(),phone:$('organicPhone').value.trim(),email:$('organicEmail').value.trim(),service_address:$('organicAddress').value.trim(),notes:$('organicNotes').value.trim(),source:'organic',source_detail:$('organicSource').value,status:'new',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(!p.first_name&&!p.last_name&&!p.phone&&!p.email){$('organicLeadMessage').textContent='Enter at least a name, phone, or email.';return}let{error}=await sb.from('leads').insert(p);if(error){delete p.source_detail;let r=await sb.from('leads').insert(p);if(r.error){$('organicLeadMessage').textContent=r.error.message;return}}$('organicLeadModal').classList.remove('show');$('leadStatusFilter').value='new';toast('Organic lead added.');await loadLeads()}
function leadSourceLabel(l){
  if(l.source==='organic')return l.source_detail||'Organic';
  return l.source||'Angi';
}
function leadRequestText(l){
  return String(l.original_message||l.message||l.notes||'').trim();
}
function card(l,due=false){
  let name=((l.first_name||'')+' '+(l.last_name||'')).trim()||'Unnamed Lead',
      source=leadSourceLabel(l),
      request=String(l.service_requested||'').trim(),
      description=leadRequestText(l),
      location=l.service_address||l.city||'',
      hasDescription=!!description;

  return `<article class="item lead-app-card">
    <div class="head lead-card-head">
      <div>
        <h2>${esc(name)}</h2>
        <div class="muted">${esc(source)} • ${when(l.received_at)}</div>
      </div>
      <span class="pill">${esc(String(l.status||'new').replaceAll('_',' '))}</span>
    </div>

    <div class="lead-contact-line">
      ${l.phone?`<a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>`:''}
      ${l.email?`<span>${esc(l.email)}</span>`:''}
      ${location?`<span>${esc(location)}</span>`:''}
    </div>

    ${request?`<section class="lead-request-block">
      <span class="lead-detail-label">PROJECT REQUEST</span>
      <b>${esc(request)}</b>
    </section>`:''}

    ${hasDescription?`<section class="lead-description-block">
      <span class="lead-detail-label">${String(source).toLowerCase().includes('angi')?'ANGI DESCRIPTION / CUSTOMER MESSAGE':'CUSTOMER MESSAGE / NOTES'}</span>
      <div>${esc(description)}</div>
    </section>`:`<section class="lead-description-block is-empty">
      <span class="lead-detail-label">CUSTOMER MESSAGE</span>
      <div>No additional description was submitted.</div>
    </section>`}

    <div class="lead-attempt-line">Attempts: <b>${l.attempt_count||0}</b>${due?` • Follow-up: <b>${when(l.next_follow_up_at)}</b>`:''}</div>

    <div class="actions lead-actions">
      ${l.phone?`<a class="btn primary lead-call-btn" href="tel:${esc(l.phone)}">Call</a><button class="btn" data-copyphone="${esc(l.phone)}">Copy Phone</button>`:''}
      ${location?`<a class="btn lead-directions-btn" target="_blank" href="https://maps.apple.com/?q=${encodeURIComponent(location)}">Directions</a>`:''}
      <button class="btn" data-log="${l.id}">Log Attempt</button>
      <button class="btn" data-leadquote="${l.id}">Create Quote</button>
      ${owner()?`<button class="btn danger" data-deletelead="${l.id}">Delete Lead</button>`:''}
    </div>
  </article>`
}
async function copyText(value){
  if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);return}
  let area=document.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();let copied=document.execCommand('copy');area.remove();if(!copied)throw new Error('Copy failed')
}
async function copyPhone(phone){
  let number=String(phone||'').trim();
  if(!number)return toast('No phone number is saved for this lead.');
  try{await copyText(number);toast('Phone number copied.')}catch(error){toast('Could not copy automatically. Press and hold the number to copy it.')}
}
function bindLeadActions(container=document){container.querySelectorAll('[data-copyphone]').forEach(b=>b.onclick=()=>copyPhone(b.dataset.copyphone));container.querySelectorAll('[data-log]').forEach(b=>b.onclick=()=>{$('activityId').value=b.dataset.log;$('activityModal').classList.add('show')});container.querySelectorAll('[data-leadquote]').forEach(b=>b.onclick=()=>createQuoteFromLead(b.dataset.leadquote));container.querySelectorAll('[data-deletelead]').forEach(b=>b.onclick=()=>deleteLead(b.dataset.deletelead))}
function renderLeadResults(){let q=($('leadSearch')?.value||'').toLowerCase(),status=$('leadStatusFilter')?.value||'',items=leads.filter(l=>(!status||l.status===status)&&JSON.stringify(l).toLowerCase().includes(q)).sort((a,b)=>new Date(b.received_at||b.created_at||b.updated_at||0)-new Date(a.received_at||a.created_at||a.updated_at||0));$('leadList').innerHTML=items.length?items.map(x=>card(x)).join(''):'<div class="card muted">No matching leads.</div>';bindLeadActions($('leadList'))}
async function loadLeads(){let{data,error}=await sb.from('leads').select('*').order('received_at',{ascending:false});if(error)return toast(error.message);leads=data||[];renderLeadResults()}
async function loadFollowups(){let now=new Date(),future=new Date(now);future.setDate(future.getDate()+7);let{data,error}=await sb.from('leads').select('*').not('status','in','("approved","lost","do_not_contact","no_response")').not('next_follow_up_at','is',null).lte('next_follow_up_at',future.toISOString()).order('next_follow_up_at');if(error)return toast(error.message);let due=(data||[]).filter(x=>new Date(x.next_follow_up_at)<=now),upcoming=(data||[]).filter(x=>new Date(x.next_follow_up_at)>now);$('overdueFollowups').textContent=due.length;$('upcomingFollowups').textContent=upcoming.length;$('followList').innerHTML=due.length?due.map(x=>card(x,true)).join(''):'<div class="card muted">No follow-ups due right now.</div>';$('upcomingFollowList').innerHTML=upcoming.length?upcoming.map(x=>card(x,true)).join(''):'<div class="card muted">No follow-ups scheduled in the next seven days.</div>';bindLeadActions($('followList'));bindLeadActions($('upcomingFollowList'))}
function createQuoteFromLead(id){let l=leads.find(x=>x.id===id);if(!l)return toast('Lead not found.');clearQuoteForm(false);editingLeadId=l.id;$('qFirst').value=l.first_name||'';$('qLast').value=l.last_name||'';$('qEmail').value=l.email||'';$('qPhone').value=l.phone||'';$('qAddress').value=l.service_address||l.city||'';$('qProject').value=l.service_requested||'Window Film Project';let source=leadSourceLabel(l);$('qLead').value=[...$('qLead').options].some(o=>o.value===source)?source:(String(source).toLowerCase().includes('angi')?'Angi':'Other');$('qNotes').value=l.original_message||l.notes||'';$('qStatus').value='Estimate Requested';quoteMilesManual=false;autoFillQuoteMiles(l.service_address||l.city||'',true);show('quotes');$('quoteBuilderPanel')?.setAttribute('open','');toast('Lead loaded into Quote Builder.')}
async function saveLead(){let p={source:'Angi',first_name:$('lfn').value.trim(),last_name:$('lln').value.trim(),phone:$('lphone').value.trim(),email:$('lemail').value.trim(),city:$('lcity').value.trim(),service_requested:$('lservice').value.trim(),original_message:$('lmessage').value.trim(),status:'new',attempt_count:0,next_follow_up_at:new Date().toISOString()};let{error}=await sb.from('leads').insert(p);if(error)return toast(error.message);$('leadModal').classList.remove('show');toast('Lead added to immediate follow-up.');loadLeads()}
async function deleteLead(id){
  if(!owner())return toast('Only an owner or manager can delete leads.');
  let lead=leads.find(x=>x.id===id);
  if(!lead){let result=await sb.from('leads').select('*').eq('id',id).maybeSingle();if(result.error)return toast(result.error.message);lead=result.data}
  if(!lead)return toast('Lead not found.');
  let name=((lead.first_name||'')+' '+(lead.last_name||'')).trim()||'this lead';
  if(!confirm(`Permanently delete ${name}?\n\nThis removes the lead and its activity history. If its customer record is unused by any other lead, quote, or job, that empty customer record will also be removed.\n\nThis cannot be undone.`))return;
  let activityResult=await sb.from('lead_activities').delete().eq('lead_id',id);
  if(activityResult.error)return toast('Lead was not deleted because its activity history could not be removed: '+activityResult.error.message);
  let deleteResult=await sb.from('leads').delete().eq('id',id);
  if(deleteResult.error)return toast(deleteResult.error.message);
  if(lead.customer_id){
    let [otherLeads,quotes,jobs]=await Promise.all([
      sb.from('leads').select('id',{count:'exact',head:true}).eq('customer_id',lead.customer_id),
      sb.from('quotes').select('id',{count:'exact',head:true}).eq('customer_id',lead.customer_id),
      sb.from('jobs').select('id',{count:'exact',head:true}).eq('customer_id',lead.customer_id)
    ]);
    if(!otherLeads.error&&!quotes.error&&!jobs.error&&(otherLeads.count||0)===0&&(quotes.count||0)===0&&(jobs.count||0)===0){
      await sb.from('customers').delete().eq('id',lead.customer_id);
    }
  }
  leads=leads.filter(x=>x.id!==id);
  renderLeadResults();
  dashboard();
  toast('Lead permanently deleted.');
}
function nextDue(n){let d=new Date();if(n===1){d.setHours(18,0,0,0);if(d<new Date())d.setHours(new Date().getHours()+2)}else if(n===2){d.setDate(d.getDate()+1);d.setHours(9,0,0,0)}else if(n===3){d.setDate(d.getDate()+3);d.setHours(9,0,0,0)}else if(n===4){d.setDate(d.getDate()+7);d.setHours(9,0,0,0)}else return null;return d}
async function saveActivity(){let id=$('activityId').value,type=$('activityType').value,note=$('activityNotes').value.trim(),l=leads.find(x=>x.id===id)||(await sb.from('leads').select('*').eq('id',id).single()).data,attempts=l.attempt_count+(['call_no_answer','voicemail','text_sent'].includes(type)?1:0),status=type==='call_no_answer'?'no_answer':type,terminal=['contacted','estimate_scheduled','quote_sent','approved','lost'].includes(status),due=terminal?null:nextDue(attempts);let[a,b]=await Promise.all([sb.from('lead_activities').insert({lead_id:id,activity_type:type,notes:note}),sb.from('leads').update({status,attempt_count:attempts,next_follow_up_at:due?due.toISOString():null,updated_at:new Date().toISOString()}).eq('id',id)]);if(a.error||b.error)return toast((a.error||b.error).message);$('activityModal').classList.remove('show');toast(due?`Next follow-up: ${when(due)}`:'Activity saved.');loadLeads()}
async function openShift(){return (await sb.from('time_entries').select('*,time_breaks(*)').eq('employee_id',session.user.id).eq('status','open').limit(1).maybeSingle()).data}
function renderClock(el,s){if(!s){el.innerHTML=`<div class="clock"><div class="big">${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</div><p class="muted">Ready to start</p></div><button class="btn primary wide" id="clockIn">Clock In</button>`;el.querySelector('#clockIn').onclick=clockIn;return}let br=s.time_breaks?.find(x=>!x.break_end);el.innerHTML=`<div class="clock"><div class="big">${br?'On Break':'Clocked In'}</div><p class="muted">Started ${when(s.clock_in)}</p></div><div class="actions">${br?'<button class="btn primary wide" id="endBreak">End Unpaid Break</button>':'<button class="btn" id="startBreak">Start Unpaid Break</button><button class="btn danger" id="clockOut">Clock Out</button>'}</div>`;if(br)el.querySelector('#endBreak').onclick=()=>endBreak(br.id);else{el.querySelector('#startBreak').onclick=()=>startBreak(s.id);el.querySelector('#clockOut').onclick=()=>clockOut(s.id)}}
async function clockIn(){let{error}=await sb.from('time_entries').insert({employee_id:session.user.id});if(error)return toast(error.message);toast('Clocked in.');loadTime();loadEmployee()}
async function clockOut(id){let{error}=await sb.from('time_entries').update({clock_out:new Date().toISOString(),status:'closed'}).eq('id',id);if(error)return toast(error.message);toast('Clocked out.');loadTime();loadEmployee()}
async function startBreak(id){let{error}=await sb.from('time_breaks').insert({time_entry_id:id,unpaid:true});if(error)return toast(error.message);toast('Break started.');loadTime();loadEmployee()}
async function endBreak(id){let{error}=await sb.from('time_breaks').update({break_end:new Date().toISOString()}).eq('id',id);if(error)return toast(error.message);toast('Break ended.');loadTime();loadEmployee()}
function week(){let d=new Date(),day=d.getDay();d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return d.toISOString()}
async function loadTime(){renderClock($('timeCard'),await openShift());let{data}=await sb.from('time_entry_totals').select('*').eq('employee_id',session.user.id).gte('clock_in',week()).order('clock_in',{ascending:false}),tot=(data||[]).reduce((s,x)=>s+Number(x.net_hours||0),0);$('timeList').innerHTML=`<div class="card metric"><b>${tot.toFixed(2)}</b><span>Net hours this week</span></div>`+(data||[]).map(x=>`<div class="item muted">${when(x.clock_in)} → ${when(x.clock_out)}<br>${Number(x.net_hours||0).toFixed(2)} hours</div>`).join('')}
async function loadEmployee(){renderClock($('employeeClock'),await openShift());let{data,error}=await sb.from('jobs').select('*,quote:quotes!jobs_quote_id_fkey(id,project_name,project_type,total_sqft,measurements,notes,status)').neq('status','Completed').order('scheduled_start');data=(data||[]).filter(j=>j.assigned_to===session.user.id||(j.assigned_installers||[]).includes(session.user.id));if(error){$('jobs').innerHTML=`<div class="item muted">${esc(error.message)}</div>`;return}window._assignedJobs=data||[];$('jobs').innerHTML=data?.length?data.map((j,i)=>{let q=j.quote,roomCount=Array.isArray(q?.measurements)?q.measurements.length:0,status=j.status||'Scheduled';return `<div class="item"><div class="head"><div><b>${esc(j.title||q?.project_name||'Installation')}</b><div class="muted">${when(j.scheduled_start)}<br>${esc(j.service_address)}</div></div><span class="pill">${esc(status)}</span></div>${q?`<div class="muted">${Number(q.total_sqft||0).toFixed(2)} total sq ft • ${roomCount} measurement row${roomCount===1?'':'s'}</div><div class="actions"><button class="btn primary" data-jobdetails="${i}">Open Job</button><a class="btn" target="_blank" href="https://maps.apple.com/?q=${encodeURIComponent(j.service_address||'')}">Directions</a>${status==='Scheduled'?`<button class="btn warn" data-jobstatus="${i}" data-status="En Route">Mark En Route</button>`:''}${status==='En Route'?`<button class="btn warn" data-jobstatus="${i}" data-status="In Progress">Start Job</button>`:''}${status==='In Progress'?`<button class="btn primary" data-jobstatus="${i}" data-status="Completed">Mark Complete</button>`:''}</div>`:`<div class="muted">No quote is linked to this job yet.</div>`}</div>`}).join(''):'No assigned jobs yet.';$('jobs').querySelectorAll('[data-jobdetails]').forEach(b=>b.onclick=()=>openJobDetails(Number(b.dataset.jobdetails)));$('jobs').querySelectorAll('[data-jobstatus]').forEach(b=>b.onclick=()=>updateJobStatus(Number(b.dataset.jobstatus),b.dataset.status))}function openJobDetails(i){let j=window._assignedJobs?.[i],q=j?.quote;if(!q)return toast('No quote is linked to this job.');let measurements=Array.isArray(q.measurements)?q.measurements:[];$('jobDetailModal').dataset.jobIndex=i;$('jobDetailTitle').textContent=j.title||q.project_name||'Job Details';$('jobDetailMeta').innerHTML=`${esc(j.service_address||'')}<br>${Number(q.total_sqft||0).toFixed(2)} total sq ft<br><b>Status:</b> ${esc(j.status||'Scheduled')}${q.notes?`<br><b>Project notes:</b> ${esc(q.notes)}`:''}`;$('jobInstallerNotes').value=j.notes||'';$('jobStatusSelect').value=j.status||'Scheduled';$('jobDimensionList').innerHTML=measurements.length?measurements.map((m,n)=>{let area=Number(m.w||0)*Number(m.h||0)*Number(m.qty||1)/144;return `<div class="dimension-card"><div><b>${n+1}. ${esc(m.area||'Window')}</b><div class="muted">${Number(m.w||0)}″ W × ${Number(m.h||0)}″ H • Qty ${Number(m.qty||1)}</div></div><strong>${area.toFixed(2)} sq ft</strong></div>`}).join(''):'<div class="muted">No measurements are stored on this quote.</div>';$('jobDetailModal').classList.add('show')}async function updateJobStatus(i,status){let j=window._assignedJobs?.[i];if(!j)return toast('Job not found.');if(status==='Completed'){if(!confirm('Mark this installation complete?\n\nConfirm actual film used next so inventory can be finalized.'))return;try{let f=await finalizeScheduledJobInventory(j.id);if(f?.canceled)return toast('Completion canceled.')}catch(e){return toast('Inventory finalization failed: '+e.message)}}let{error}=await sb.from('jobs').update({status,archived_at:status==='Completed'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',j.id);if(error)return toast(error.message);if(j.quote_id){let quoteStatus=status==='Completed'?'Completed':'Scheduled';await sb.from('quotes').update({status:quoteStatus,updated_at:new Date().toISOString()}).eq('id',j.quote_id)}toast(`Job marked ${status}.`);await loadEmployee()}async function saveInstallerJobUpdate(){let i=Number($('jobDetailModal').dataset.jobIndex),j=window._assignedJobs?.[i];if(!j)return toast('Job not found.');let status=$('jobStatusSelect').value,notes=$('jobInstallerNotes').value.trim();if(status==='Completed'&&j.status!=='Completed'){try{let f=await finalizeScheduledJobInventory(j.id);if(f?.canceled)return toast('Completion canceled.')}catch(e){return toast('Inventory finalization failed: '+e.message)}}let{error}=await sb.from('jobs').update({status,notes,archived_at:status==='Completed'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',j.id);if(error)return toast(error.message);if(j.quote_id){let quoteStatus=status==='Completed'?'Completed':'Scheduled';await sb.from('quotes').update({status:quoteStatus,updated_at:new Date().toISOString()}).eq('id',j.quote_id)}$('jobDetailModal').classList.remove('show');toast('Job update saved.');await loadEmployee()}
async function loadTeam(){let{data,error}=await sb.from('time_entry_totals').select('*,employee:profiles!time_entries_employee_id_fkey(full_name,email)').gte('clock_in',week()).order('clock_in',{ascending:false});if(error)return toast(error.message);teamTimeCache=data||[];let groups={};teamTimeCache.forEach(x=>{let id=x.employee_id;groups[id]??={name:x.employee?.full_name||x.employee?.email||'Employee',total:0,entries:[]};groups[id].total+=Number(x.net_hours||0);groups[id].entries.push(x)});$('teamList').innerHTML=Object.values(groups).length?Object.values(groups).map(g=>`<div class="card"><div class="head"><h2>${esc(g.name)}</h2><span class="pill">${g.total.toFixed(2)} hrs</span></div>${g.entries.map(x=>`<div class="time-row"><span>${when(x.clock_in)} → ${when(x.clock_out)}</span><b>${Number(x.net_hours||0).toFixed(2)} hrs</b></div>`).join('')}</div>`).join(''):'<div class="card muted">No time entries this week.</div>'}
function exportTimeCsv(){if(!teamTimeCache.length)return toast('No weekly time records to export.');let rows=[['Employee','Clock In','Clock Out','Net Hours','Status'],...teamTimeCache.map(x=>[x.employee?.full_name||x.employee?.email||'Employee',when(x.clock_in),when(x.clock_out),Number(x.net_hours||0).toFixed(2),x.status||''])],csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'),blob=new Blob([csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`dynamic-tintz-time-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);toast('Weekly time CSV exported.')}

const ceramicMatrix=[[0,49,12],[50,99,11],[100,199,10],[200,299,9],[300,399,8],[400,499,7],[500,999999,6.5]],solarMatrix=[[0,99,7.5],[100,199,6.5],[200,299,6],[300,399,5.5],[400,999999,5]];
let measures=[{id:1,area:'',w:0,h:0,qty:1}],nextMeasure=2,editingQuoteId=null,editingCustomerId=null,editingLeadId=null,quoteMilesManual=false;
let quoteAutosaveTimer=null,quoteCloudAutosaveTimer=null,quoteDraftRestoring=false,quoteAutosaveMuted=false;
function quoteDraftKey(){return `dt.quoteDraft.${session?.user?.id||'guest'}`}
function quoteDraftPayload(){
  return {
    version:1,
    saved_at:new Date().toISOString(),
    editingQuoteId,
    editingCustomerId,
    editingLeadId,
    fields:{
      qFirst:$('qFirst')?.value||'',qLast:$('qLast')?.value||'',qEmail:$('qEmail')?.value||'',
      qPhone:$('qPhone')?.value||'',qAddress:$('qAddress')?.value||'',qProject:$('qProject')?.value||'',
      qType:$('qType')?.value||'Residential',qSquareItem:$('qSquareItem')?.value||'25% Ceramic Tint Install',
      qStatus:$('qStatus')?.value||'New Lead',qMiles:$('qMiles')?.value||'0',
      qLead:$('qLead')?.value||'Angi',qNotes:$('qNotes')?.value||''
    },
    measures:JSON.parse(JSON.stringify(measures||[]))
  }
}
function quoteDraftHasContent(draft){
  if(!draft)return false;
  let f=draft.fields||{};
  return ['qFirst','qLast','qEmail','qPhone','qAddress','qProject','qNotes'].some(k=>String(f[k]||'').trim())
    ||(draft.measures||[]).some(r=>String(r.area||'').trim()||Number(r.w)>0||Number(r.h)>0);
}
function saveQuoteDraftLocal(){
  if(quoteAutosaveMuted||quoteDraftRestoring)return;
  try{
    let draft=quoteDraftPayload();
    if(!quoteDraftHasContent(draft)){localStorage.removeItem(quoteDraftKey());updateQuoteAutosaveIndicator('');return}
    localStorage.setItem(quoteDraftKey(),JSON.stringify(draft));
    updateQuoteAutosaveIndicator(`Draft saved ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`);
  }catch(e){console.warn('Quote local autosave failed:',e)}
}
function clearQuoteDraftLocal(){
  try{localStorage.removeItem(quoteDraftKey())}catch{}
  updateQuoteAutosaveIndicator('');
}
function updateQuoteAutosaveIndicator(text,state='saved'){
  let el=$('quoteAutosaveStatus');if(!el)return;
  el.textContent=text||'';
  el.dataset.state=state;
}
function scheduleQuoteAutosave(){
  if(quoteAutosaveMuted||quoteDraftRestoring)return;
  clearTimeout(quoteAutosaveTimer);
  updateQuoteAutosaveIndicator('Saving draft…','saving');
  quoteAutosaveTimer=setTimeout(()=>{
    saveQuoteDraftLocal();
    if(editingQuoteId)scheduleQuoteCloudAutosave();
  },350);
}
function scheduleQuoteCloudAutosave(){
  if(!editingQuoteId||quoteAutosaveMuted||quoteDraftRestoring)return;
  clearTimeout(quoteCloudAutosaveTimer);
  quoteCloudAutosaveTimer=setTimeout(()=>autosaveExistingCloudQuote(),1600);
}
async function autosaveExistingCloudQuote(){
  if(!editingQuoteId||quoteAutosaveMuted||quoteDraftRestoring)return;
  try{
    let customer={first_name:$('qFirst').value.trim(),last_name:$('qLast').value.trim(),email:$('qEmail').value.trim(),phone:$('qPhone').value.trim(),service_address:$('qAddress').value.trim(),lead_source:$('qLead').value.trim(),notes:$('qNotes').value.trim(),updated_at:new Date().toISOString()};
    if(editingCustomerId){
      let c=await sb.from('customers').update(customer).eq('id',editingCustomerId);
      if(c.error)throw c.error;
    }
    let s=qSqft(),cprice=qPrice(ceramicMatrix,s,Number($('qMiles').value)||0),solar=qPrice(solarMatrix,s,Number($('qMiles').value)||0),list=12*s;
    let payload={
      project_name:$('qProject').value.trim(),project_type:$('qType').value,
      square_catalog_item_name:$('qSquareItem')?.value||'25% Ceramic Tint Install',
      status:$('qStatus').value,service_address:$('qAddress').value.trim(),
      miles:Number($('qMiles').value)||0,total_sqft:s,ceramic_list_price:list,
      ceramic_price:cprice.price,ceramic_savings:Math.max(0,list-cprice.price),
      solar_price:solar.price,tax_rate:6.25,notes:$('qNotes').value.trim(),
      measurements:measures,updated_at:new Date().toISOString()
    };
    let q=await sb.from('quotes').update(payload).eq('id',editingQuoteId);
    if(q.error)throw q.error;
    updateQuoteAutosaveIndicator(`Cloud autosaved ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`,'cloud');
  }catch(e){
    console.warn('Quote cloud autosave failed:',e);
    updateQuoteAutosaveIndicator('Saved locally • cloud retry pending','warning');
  }
}
function restoreQuoteDraftIfNeeded(){
  if(editingQuoteId||quoteDraftRestoring)return false;
  let raw=null;try{raw=localStorage.getItem(quoteDraftKey())}catch{}
  if(!raw)return false;
  let draft=null;try{draft=JSON.parse(raw)}catch{return false}
  if(!quoteDraftHasContent(draft))return false;
  quoteDraftRestoring=true;
  try{
    let f=draft.fields||{};
    Object.entries(f).forEach(([id,val])=>{if($(id))$(id).value=val??''});
    if(Array.isArray(draft.measures)&&draft.measures.length){
      measures=draft.measures;
      nextMeasure=Math.max(0,...measures.map(x=>Number(x.id)||0))+1;
    }
    editingQuoteId=draft.editingQuoteId||null;
    editingCustomerId=draft.editingCustomerId||null;editingLeadId=draft.editingLeadId||null;
    renderMeasures();
    calculateQuote();
    $('quoteBuilderPanel')?.setAttribute('open','');
    updateQuoteAutosaveIndicator(`Recovered draft from ${draft.saved_at?new Date(draft.saved_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'autosave'}`,'recovered');
    toast('Unsaved quote draft recovered.');
    return true;
  }finally{quoteDraftRestoring=false}
}

const SHORTCUT_LIBRARY_VERSION='4.2';
const defaultShortcuts=[{"key": "newlead", "category": "New Leads", "text": "Hi! This is Jeremy with Dynamic Tintz. Thank you for reaching out to us. We’re a local, veteran-owned family business serving homeowners and businesses throughout DFW, and we’d be grateful for the opportunity to help with your window film project. Send over a few photos, your service address, and what you’re hoping to improve—heat, glare, privacy, fading, or all of the above—and we’ll take it from there.", "builtin": true}, {"key": "quote", "category": "Estimates", "text": "Thank you for giving Dynamic Tintz the opportunity to earn your business. We take pride in providing honest recommendations, quality workmanship, and straightforward pricing for our neighbors throughout DFW. Send us your window photos, approximate measurements, service address, and the main concerns you’d like to solve, and we’ll put together a free estimate for you.", "builtin": true}, {"key": "quotesent", "category": "Estimates", "text": "Hi {{Customer}}, I’ve just sent over your Dynamic Tintz quote for review. If everything looks good, the 50% deposit is what officially reserves your project and allows us to place you on the installation schedule. Our calendar stays fairly active, so installation dates are confirmed in the order deposits are received rather than holding tentative dates without one. Once the deposit is completed, just let me know and I’ll get your project scheduled as quickly as possible. If you have any questions about the quote, film selection, or next steps, I’m happy to help. We appreciate the opportunity to earn your business!", "builtin": true}, {"key": "quotecheckin", "category": "Estimates", "text": "Hi {{Customer}}, I wanted to make sure you received the quote I sent over from Dynamic Tintz. If you have any questions about the pricing, film option, or installation process, I’m happy to go through it with you. When you’re ready to move forward, the 50% deposit secures the project and we’ll confirm the next available installation date that works for you.", "builtin": true}, {"key": "photos", "category": "Estimates", "text": "To help us prepare the most accurate estimate possible, please send clear photos of each window from inside the home or business, along with approximate width and height measurements. Please also include the service address and let us know whether your main concern is heat, glare, privacy, UV protection, or appearance. Once we have that, we can recommend the best option for your space.", "builtin": true}, {"key": "followup", "category": "Follow-Ups", "text": "Hi {{Customer}}, this is Jeremy with Dynamic Tintz checking back in with you. I wanted to make sure you had everything you needed regarding your window film estimate. We know home and business projects are an investment, so there’s never any pressure from us—just honest answers and dependable service when you’re ready.", "builtin": true}, {"key": "followup2", "category": "Follow-Ups", "text": "Hi {{Customer}}, I wanted to follow up one more time regarding your window tinting project. We’d truly appreciate the opportunity to earn your business and help make your space more comfortable. If your plans have changed, no problem at all. Just let us know where things stand, and we’ll be happy to help whenever the timing is right.", "builtin": true}, {"key": "evening", "category": "Follow-Ups", "text": "Hi {{Customer}}, this is Jeremy with Dynamic Tintz checking back in this evening. I know the day can get busy, so I wanted to make sure you saw my earlier message. We’d be happy to answer any questions and help whenever it’s convenient for you.", "builtin": true}, {"key": "nextmorning", "category": "Follow-Ups", "text": "Good morning, {{Customer}}! This is Jeremy with Dynamic Tintz. I wanted to try you again regarding your window film request. We’d be glad to learn more about the project and provide an honest recommendation whenever you have a moment.", "builtin": true}, {"key": "threeDay", "category": "Follow-Ups", "text": "Hi {{Customer}}, this is Jeremy with Dynamic Tintz following up on your window film project. I wanted to make sure you weren’t still waiting on anything from us. There’s no pressure at all—we’re here whenever you’re ready or if any questions come up.", "builtin": true}, {"key": "finalfollowup", "category": "Follow-Ups", "text": "Hi {{Customer}}, I wanted to reach out one final time regarding your window film request. We’d still be honored to help, but I also don’t want to crowd your inbox. Feel free to save our number and reach out whenever the timing is right. Thank you again for considering Dynamic Tintz.", "builtin": true}, {"key": "ceramic", "category": "Residential", "text": "Our premium ceramic window film is one of the best upgrades you can make for comfort without changing the look and feel of your home. It helps reduce heat, glare, and UV exposure while maintaining excellent visibility. It’s the option we recommend most often because it delivers strong performance, a clean appearance, and long-term value.", "builtin": true}, {"key": "residential", "category": "Residential", "text": "At Dynamic Tintz, we understand that your home is more than just a property—it’s where your family lives, relaxes, and makes memories. Our residential window film is designed to make your home more comfortable while helping protect your floors, furniture, and belongings from sun exposure. Every residential installation includes a lifetime warranty for added peace of mind.", "builtin": true}, {"key": "commercial", "category": "Commercial", "text": "Thank you for considering Dynamic Tintz for your commercial project. We work with local businesses throughout DFW to improve comfort, reduce glare, enhance privacy, and create a more professional appearance. We understand the importance of working cleanly, staying on schedule, and minimizing disruption to your daily operations.", "builtin": true}, {"key": "warranty", "category": "Warranty", "text": "We stand behind our work because our name and reputation are attached to every installation. Residential projects include a lifetime warranty, and commercial projects include a 12-year warranty. We want our customers to feel confident knowing they’re working with a local company that will still be here if they ever need us.", "builtin": true}, {"key": "booking", "category": "Scheduling", "text": "We’d be happy to get your project on the schedule. Send us a few dates and times that work well for you, and we’ll check availability. A 50% deposit is due at invoicing to reserve the installation, with the remaining balance due once the job is completed and you’re satisfied with the finished result.", "builtin": true}, {"key": "reminder", "category": "Scheduling", "text": "Hi {{Customer}}, this is a friendly reminder from Dynamic Tintz about your upcoming window film installation. We’re looking forward to taking care of your project. Before we arrive, please make sure the window areas are accessible and move any fragile items or decorations nearby. We appreciate you choosing a local, veteran-owned business.", "builtin": true}, {"key": "late", "category": "Scheduling", "text": "Hi {{Customer}}, this is Jeremy with Dynamic Tintz. I wanted to personally let you know that we’re running a little behind schedule. We respect your time and don’t want to leave you wondering, so we’ll keep you updated with a more accurate arrival time. Thank you for your patience and understanding.", "builtin": true}, {"key": "reschedule", "category": "Scheduling", "text": "Hi {{Customer}}, we need to make a small adjustment to your scheduled installation. I apologize for the inconvenience, and we’ll do everything possible to find another date and time that works well for you. We appreciate your flexibility and your trust in Dynamic Tintz.", "builtin": true}, {"key": "review", "category": "Reviews", "text": "Thank you again for choosing Dynamic Tintz. As a local, veteran-owned family business, word of mouth means everything to us. If you’re happy with the finished work and your experience, we’d be incredibly grateful if you took a moment to leave us a Google review. Your support helps other homeowners and businesses in our community feel confident choosing us.", "builtin": true}, {"key": "thanks", "category": "Thank You", "text": "Thank you for trusting Dynamic Tintz with your project. We know you had options, and we never take your business for granted. Supporting our company means supporting a local veteran-owned family business, and we truly appreciate the opportunity to serve you.", "builtin": true}, {"key": "payment", "category": "Payments", "text": "Hi {{Customer}}, this is a friendly payment reminder from Dynamic Tintz. The remaining balance for your project is due upon completion. Please let us know if you need the invoice resent or have any questions. Thank you again for supporting our local business.", "builtin": true}, {"key": "deposit", "category": "Payments", "text": "Hi {{Customer}}, your Dynamic Tintz project is ready to reserve. A 50% deposit is due at invoicing to secure the installation date, with the remaining balance due upon completion. Let us know if you need the invoice resent or have any questions.", "builtin": true}, {"key": "minimum", "category": "Pricing", "text": "Our minimum project price is $250 for locations within 35 miles of our Anna service area and $350 for locations beyond 35 miles. This allows us to cover professional materials, travel, preparation, installation, and warranty support while maintaining the quality our customers expect from Dynamic Tintz.", "builtin": true}, {"key": "noauto", "category": "General", "text": "Thank you for reaching out to Dynamic Tintz. We specialize exclusively in residential and commercial window film, so we don’t currently offer automotive tinting. We appreciate you thinking of us and would be happy to help with any home, office, storefront, or commercial glass project.", "builtin": true}, {"key": "facebook", "category": "Community", "text": "Dynamic Tintz would be honored to help! We’re a local, veteran-owned family business serving homeowners and businesses throughout DFW. We specialize in residential and commercial window film for heat reduction, glare control, privacy, UV protection, and improved comfort. Free estimates are available—call or text us at 469-840-4008.", "builtin": true}, {"key": "nextdoor", "category": "Community", "text": "Hi neighbors! I’m Jeremy, the owner of Dynamic Tintz. We’re a local, veteran-owned family business based right here in the area, specializing in residential and commercial window film. We take pride in honest recommendations, clean installations, and treating every customer’s property like it was our own. Call or text us at 469-840-4008 for a free estimate.", "builtin": true}, {"key": "recommendation", "category": "Community", "text": "We truly appreciate the recommendation. Dynamic Tintz is a veteran-owned family business, and we take a lot of pride in every home and business we work in. If we have the opportunity to earn your business, we’ll treat your property with the same care and respect we’d want for our own.", "builtin": true}, {"key": "referral", "category": "Referrals", "text": "Thank you so much for recommending Dynamic Tintz. Referrals from our customers and neighbors are one of the biggest compliments we can receive. We’ll take great care of anyone you send our way and make sure they receive the same honest, dependable service you experienced.", "builtin": true}, {"key": "referralthanks", "category": "Referrals", "text": "Thank you for sending your friends and family our way. Word of mouth has helped build Dynamic Tintz from day one, and we never take that trust for granted. We truly appreciate your support.", "builtin": true}, {"key": "complete", "category": "Job Completion", "text": "Hi {{Customer}}, your installation is complete! Thank you again for trusting Dynamic Tintz with your home or business. We hope you immediately notice the improvement in comfort, glare control, and overall appearance. Please reach out anytime if you have questions.", "builtin": true}, {"key": "care", "category": "Job Completion", "text": "For the best results, please avoid cleaning or touching the newly installed film while it cures. A slightly hazy appearance or small moisture pockets can be normal during the drying process and will clear as the film fully cures.", "builtin": true}, {"key": "privacy", "category": "Education", "text": "Window film can provide excellent daytime privacy when the outside is brighter than the inside. At night, interior lighting can reduce that privacy effect, so curtains or blinds may still be needed after dark. We’ll help you choose the best option for your goals and glass.", "builtin": true}, {"key": "uv", "category": "Education", "text": "Quality window film can block up to 99% of harmful UV rays, helping protect flooring, furniture, artwork, and other belongings from sun-related fading while making the room more comfortable.", "builtin": true}, {"key": "heat", "category": "Education", "text": "Window film helps reduce the solar heat entering through your glass, which can improve comfort, reduce hot spots, and lessen the workload on your HVAC system. Performance depends on the film selected, glass type, window direction, and overall building conditions.", "builtin": true}, {"key": "glare", "category": "Education", "text": "Window film is an excellent way to reduce harsh glare on televisions, computer screens, and living spaces without permanently covering the windows or eliminating natural light.", "builtin": true}, {"key": "freeestimate", "category": "Estimates", "text": "We provide free estimates for residential and commercial window film projects throughout DFW. Send us a few photos, approximate measurements, the service address, and what you’d like to improve, and we’ll help guide you toward the right solution.", "builtin": true}];
let shortcutData=[];
let savedShortcutData=[];
try{
  savedShortcutData=JSON.parse(localStorage.getItem('dt.cloud.shortcuts')||'null')||[];
}catch(error){
  console.warn('Shortcut storage was reset because it contained invalid data.',error);
  localStorage.removeItem('dt.cloud.shortcuts');
}
let shortcutVersion=localStorage.getItem('dt.cloud.shortcuts.version');
if(shortcutVersion!==SHORTCUT_LIBRARY_VERSION){
  let custom=savedShortcutData.filter(s=>!s.builtin&&!defaultShortcuts.some(d=>d.key===s.key));
  shortcutData=[...defaultShortcuts,...custom.map(s=>({...s,category:s.category||'Custom',builtin:false}))];
  localStorage.setItem('dt.cloud.shortcuts',JSON.stringify(shortcutData));
  localStorage.setItem('dt.cloud.shortcuts.version',SHORTCUT_LIBRARY_VERSION);
}else{
  shortcutData=savedShortcutData.length?savedShortcutData:defaultShortcuts;
}

function money(n){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0)}
function qPrice(matrix,s,miles){if(s>0&&s<=18)return{price:Number(miles)>35?350:250,label:'Minimum job pricing'};let b=matrix.find(x=>s>=x[0]&&s<=x[1])||matrix[0];return{price:b[2]*s,label:money(b[2])+' per sq ft'}}
const annaMileageByCity={
  'anna':0,'melissa':8,'mckinney':15,'princeton':18,'van alstyne':14,'sherman':30,'denison':38,
  'frisco':25,'prosper':18,'celina':17,'plano':30,'allen':22,'lucas':25,'parker':27,'fairview':18,
  'wylie':31,'murphy':31,'richardson':38,'garland':40,'dallas':50,'carrollton':40,'the colony':32,
  'lewisville':39,'denton':42,'little elm':30,'aubrey':32,'pilot point':28,'gunter':20,'howe':24,
  'whitewright':30,'bonham':38,'greenville':45,'farmersville':28,'royse city':46,'rockwall':48,
  'forney':58,'mesquite':58,'fort worth':65,'arlington':68,'irving':55,'grapevine':50,'southlake':48,
  'keller':55,'flower mound':45,'coppell':48,'addison':42,'farmers branch':45,'highland park':47,
  'university park':46,'rowlett':45,'sachse':38,'lavon':37,'nevada':35,'blue ridge':22,'leonard':28,
  'trenton':26,'bells':32,'pottsboro':42,'gainesville':50,'sanger':47,'argyle':48,'krum':49,
  'justin':55,'roanoke':54,'haslet':61,'northlake':51,'trophy club':52,'colleyville':54,
  'bedford':58,'euless':58,'hurst':60,'grand prairie':62,'sunnyvale':53,'heath':52,'fate':46,
  'caddo mills':42,'commerce':48,'terrell':63,'crandall':64,'seagoville':64,'red oak':72,
  'waxahachie':82,'mansfield':78
};
function normalizeMileageLocation(value){
  return String(value||'')
    .toLowerCase()
    .replace(/[.,#]/g,' ')
    .replace(/\btexas\b/g,'tx')
    .replace(/\s+/g,' ')
    .trim();
}
function quoteMileageFromLocation(value){
  let text=normalizeMileageLocation(value);
  if(!text)return null;

  // Prefer the longest city name so "flower mound" wins over partial matches.
  let cities=Object.keys(annaMileageByCity).sort((a,b)=>b.length-a.length);
  for(let city of cities){
    let normalizedCity=normalizeMileageLocation(city);
    if(text===normalizedCity||text.includes(` ${normalizedCity} `)||text.startsWith(`${normalizedCity} `)||text.endsWith(` ${normalizedCity}`)){
      return annaMileageByCity[city];
    }
  }
  return null;
}
function setMileageAutoStatus(text=''){
  let el=$('qMilesAutoStatus');
  if(el)el.textContent=text;
}
function autoFillQuoteMiles(location,force=false){
  if(quoteMilesManual&&!force)return false;
  let miles=quoteMileageFromLocation(location);
  if(miles==null){
    setMileageAutoStatus(location?'City not recognized — enter miles manually':'');
    return false;
  }
  $('qMiles').value=String(miles);
  quoteMilesManual=false;
  setMileageAutoStatus(`Auto estimate from service location: ${miles} mi`);
  calculateQuote();
  scheduleQuoteAutosave();
  return true;
}
let quoteMileageTimer=null;
function scheduleQuoteMileageAutofill(){
  clearTimeout(quoteMileageTimer);
  quoteMileageTimer=setTimeout(()=>autoFillQuoteMiles($('qAddress')?.value||''),350);
}
function openNewLeadQuote(source='Angi'){
  clearQuoteForm(false);
  editingLeadId=null;
  quoteMilesManual=false;
  if($('qLead'))$('qLead').value=source;
  if($('qStatus'))$('qStatus').value='Estimate Requested';
  show('quotes');
  $('quoteBuilderPanel')?.setAttribute('open','');
  setTimeout(()=>$('qFirst')?.focus(),80);
  toast(`${source} lead ready for quote details.`);
}

function qSqft(){return measures.reduce((s,r)=>s+(Number(r.w)*Number(r.h)*Number(r.qty||1))/144,0)}
function calculateQuote(){let s=qSqft(),m=Number($('qMiles').value)||0,c=qPrice(ceramicMatrix,s,m),o=qPrice(solarMatrix,s,m),list=12*s,save=Math.max(0,list-c.price),pct=list?Math.round(save/list*100):0;$('qSqft').textContent=s.toFixed(2);$('qCerPrice').textContent=money(c.price);$('qCerTier').textContent=c.label;$('qSolarPrice').textContent=money(o.price);$('qSolarTier').textContent=o.label;$('qListPrice').textContent=money(list);$('qTierPrice').textContent=money(c.price);$('qSavings').textContent=money(save)+' ('+pct+'%)';$('qDeposit').textContent=money(c.price*1.0625/2);if($('mobileSqft'))$('mobileSqft').textContent=s.toFixed(2)+' sq ft';if($('mobilePrice'))$('mobilePrice').textContent=money(c.price)}

const commonRoomAreas=[
  'Living Room',
  'Office',
  'Home Office',
  'Kitchen',
  'Dining Room',
  'Master Bedroom',
  'Primary Bedroom',
  'Master Bathroom',
  'Primary Bathroom',
  'Bedroom',
  'Upstairs Bedroom',
  'Downstairs Bedroom',
  'Guest Bedroom',
  'Kids Bedroom',
  'Nursery',
  'Bathroom',
  'Guest Bathroom',
  'Half Bath',
  'Powder Room',
  'Game Room',
  'Media Room',
  'Theater Room',
  'Family Room',
  'Great Room',
  'Den',
  'Study',
  'Library',
  'Breakfast Nook',
  'Breakfast Area',
  'Sunroom',
  'Bonus Room',
  'Loft',
  'Playroom',
  'Exercise Room',
  'Gym',
  'Laundry Room',
  'Mudroom',
  'Entry',
  'Entryway',
  'Foyer',
  'Hallway',
  'Stairway',
  'Stairwell',
  'Landing',
  'Front Door',
  'Back Door',
  'Patio Door',
  'Sliding Door',
  'French Doors',
  'Patio',
  'Enclosed Patio',
  'Pool Room',
  'Garage',
  'Garage Door',
  'Workshop',
  'Basement',
  'Attic',
  'Closet',
  'Walk-In Closet',
  'Pantry',
  'Storefront',
  'Lobby',
  'Reception',
  'Conference Room',
  'Break Room',
  'Waiting Room',
  'Exam Room',
  'Treatment Room',
  'Classroom',
  'Office Front',
  'Office Rear',
  'Front Elevation',
  'Rear Elevation',
  'Left Elevation',
  'Right Elevation',
  'North Side',
  'South Side',
  'East Side',
  'West Side'
];
function roomAreaOptions(){
  return commonRoomAreas.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
}

function renderMeasures(){
  let el=$('measureRows');
  if(!el)return;
  el.innerHTML='';
  measures.forEach((r,index)=>{
    let d=document.createElement('div');
    d.className='measure-row';
    let area=(Number(r.w)*Number(r.h)*Number(r.qty||1)/144).toFixed(2);
    d.innerHTML=`<div class="measure-index">${index+1}</div>
      <div class="room-area-picker">
        <input class="area" data-mid="${r.id}" data-k="area" placeholder="Type room / area" value="${esc(r.area)}" autocomplete="off">
        <select class="room-area-select" data-roomselect="${r.id}" aria-label="Choose a common room or area">
          <option value="">Choose room…</option>
          ${roomAreaOptions()}
        </select>
      </div>
      <input data-mid="${r.id}" data-k="w" inputmode="decimal" placeholder="Width" value="${r.w||''}">
      <input data-mid="${r.id}" data-k="h" inputmode="decimal" placeholder="Height" value="${r.h||''}">
      <input data-mid="${r.id}" data-k="qty" inputmode="numeric" placeholder="Qty" value="${r.qty||1}">
      <div class="measure-total">${area} sq ft</div>
      <button class="btn mini" data-duplicate="${r.id}" title="Duplicate window">⧉</button>
      <button class="btn danger mini" data-remove="${r.id}" title="Delete window">×</button>`;
    el.appendChild(d)
  });
  el.querySelectorAll('input[data-mid]').forEach(i=>{
    i.oninput=()=>{
      let r=measures.find(x=>x.id===Number(i.dataset.mid));
      r[i.dataset.k]=i.dataset.k==='area'?i.value:Number(i.value)||0;
      calculateQuote();
      scheduleQuoteAutosave();
      let row=i.closest('.measure-row'),total=row?.querySelector('.measure-total');
      if(total)total.textContent=((Number(r.w)*Number(r.h)*Number(r.qty||1))/144).toFixed(2)+' sq ft'
    };
    i.onkeydown=e=>{
      if(e.key!=='Enter')return;
      e.preventDefault();
      let order=['area','w','h','qty'],position=order.indexOf(i.dataset.k);
      if(position<order.length-1){
        i.closest('.measure-row')?.querySelector(`[data-k="${order[position+1]}"]`)?.focus()
      }else{
        addMeasure(true)
      }
    }
  });
  el.querySelectorAll('[data-roomselect]').forEach(s=>{
    s.onchange=()=>{
      if(!s.value)return;
      let id=Number(s.dataset.roomselect),r=measures.find(x=>x.id===id);
      if(!r)return;
      r.area=s.value;
      let input=s.closest('.room-area-picker')?.querySelector('[data-k="area"]');
      if(input)input.value=s.value;
      s.value='';
      calculateQuote();
      setTimeout(()=>s.closest('.measure-row')?.querySelector('[data-k="w"]')?.focus(),20)
    }
  });
  el.querySelectorAll('[data-duplicate]').forEach(b=>b.onclick=()=>duplicateMeasure(Number(b.dataset.duplicate)));
  el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{
    measures=measures.filter(x=>x.id!==Number(b.dataset.remove));
    if(!measures.length)measures=[{id:nextMeasure++,area:'',w:0,h:0,qty:1}];
    renderMeasures()
  });
  calculateQuote()
}
function addMeasure(focus=true,preset=null){let id=nextMeasure++,row=preset||{id,area:'',w:0,h:0,qty:1};row={...row,id};measures.push(row);renderMeasures();if(focus)setTimeout(()=>document.querySelector(`[data-mid="${id}"][data-k="${preset&&row.area?'w':'area'}"]`)?.focus(),40);scheduleQuoteAutosave()}
function duplicateMeasure(id){let source=measures.find(x=>x.id===id);if(!source)return;addMeasure(false,{...source});toast('Window duplicated')}
function duplicateLastMeasure(){let last=measures[measures.length-1];if(!last)return;duplicateMeasure(last.id)}
function clearQuoteForm(confirmFirst=true){if(confirmFirst&&!confirm('Clear this quote and start another?'))return;quoteAutosaveMuted=true;['qFirst','qLast','qEmail','qPhone','qAddress','qProject','qNotes'].forEach(id=>$(id).value='');$('qMiles').value='0';$('qType').value='Residential';if($('qSquareItem'))$('qSquareItem').value='25% Ceramic Tint Install';$('qStatus').value='New Lead';$('qLead').value='Angi';measures=[{id:1,area:'',w:0,h:0,qty:1}];nextMeasure=2;editingQuoteId=null;editingCustomerId=null;editingLeadId=null;quoteMilesManual=false;setMileageAutoStatus('');renderMeasures();clearQuoteDraftLocal();quoteAutosaveMuted=false}
function currentQuoteText(){let s=qSqft(),m=Number($('qMiles').value)||0,c=qPrice(ceramicMatrix,s,m),o=qPrice(solarMatrix,s,m),list=12*s,save=Math.max(0,list-c.price),pct=list?Math.round(save/list*100):0;return `Dynamic Tintz Window Film Proposal\n\nCustomer: ${$('qFirst').value} ${$('qLast').value}\nProject: ${$('qProject').value||'Window Film Project'}\nAddress: ${$('qAddress').value}\nTotal glass: ${s.toFixed(2)} sq ft\n\nPremium Ceramic normal price: ${money(list)}\nVolume-tier price: ${money(c.price)}\nCustomer savings: ${money(save)} (${pct}%)\nSolar Control: ${money(o.price)}\n\n50% deposit due at invoicing; balance due upon completion.\nResidential Lifetime Warranty • 12 Year Commercial Warranty\nProudly Veteran Owned and Operated\nDynamic Tintz • 469-840-4008`}
async function ensureLeadForQuoteCustomer(customerId){
  let source=$('qLead')?.value||'Organic',
      leadPayload={
        customer_id:customerId,
        source,
        first_name:$('qFirst').value.trim(),
        last_name:$('qLast').value.trim(),
        phone:$('qPhone').value.trim(),
        email:$('qEmail').value.trim(),
        service_address:$('qAddress').value.trim(),
        service_requested:$('qProject').value.trim()||'Window Film Project',
        original_message:$('qNotes').value.trim(),
        status:'contacted',
        attempt_count:0,
        next_follow_up_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
      };
  if(editingLeadId){
    let {error}=await sb.from('leads').update({
      customer_id:customerId,
      first_name:leadPayload.first_name,last_name:leadPayload.last_name,
      phone:leadPayload.phone,email:leadPayload.email,
      service_address:leadPayload.service_address,
      service_requested:leadPayload.service_requested,
      status:'contacted',updated_at:new Date().toISOString()
    }).eq('id',editingLeadId);
    if(error)console.warn('Existing lead link update:',error);
    return editingLeadId;
  }
  if(editingQuoteId)return null;
  let {data,error}=await sb.from('leads').insert(leadPayload).select('id').single();
  if(error){
    // Compatibility fallback for older leads schemas with fewer optional fields.
    let fallback={
      source,first_name:leadPayload.first_name,last_name:leadPayload.last_name,
      phone:leadPayload.phone,email:leadPayload.email,
      service_address:leadPayload.service_address,service_requested:leadPayload.service_requested,
      original_message:leadPayload.original_message,status:'contacted',
      attempt_count:0,next_follow_up_at:new Date().toISOString()
    };
    let retry=await sb.from('leads').insert(fallback).select('id').single();
    if(retry.error){console.warn('Manual quote lead creation:',retry.error);return null}
    editingLeadId=retry.data?.id||null;
    return editingLeadId;
  }
  editingLeadId=data?.id||null;
  return editingLeadId;
}

async function saveCloudQuote(){
  let saveButtons=[$('saveQuote'),$('mobileSaveQuote'),$('quoteSaveDockButton')].filter(Boolean),saveLabels=saveButtons.map(b=>b.textContent);
  saveButtons.forEach(b=>{b.disabled=true;b.textContent='Saving…'});
  try{
  let customer={first_name:$('qFirst').value.trim(),last_name:$('qLast').value.trim(),email:$('qEmail').value.trim(),phone:$('qPhone').value.trim(),service_address:$('qAddress').value.trim(),lead_source:$('qLead').value.trim(),notes:$('qNotes').value.trim(),updated_at:new Date().toISOString()};let customerId=editingCustomerId;if(customerId){let{error}=await sb.from('customers').update(customer).eq('id',customerId);if(error)return toast(error.message)}else{let{data,error}=await sb.from('customers').insert(customer).select().single();if(error)return toast(error.message);customerId=data.id}await ensureLeadForQuoteCustomer(customerId);let s=qSqft(),c=qPrice(ceramicMatrix,s,Number($('qMiles').value)||0),o=qPrice(solarMatrix,s,Number($('qMiles').value)||0),list=12*s,payload={customer_id:customerId,project_name:$('qProject').value.trim(),project_type:$('qType').value,square_catalog_item_name:$('qSquareItem')?.value||'25% Ceramic Tint Install',status:$('qStatus').value,service_address:$('qAddress').value.trim(),miles:Number($('qMiles').value)||0,total_sqft:s,ceramic_list_price:list,ceramic_price:c.price,ceramic_savings:Math.max(0,list-c.price),solar_price:o.price,tax_rate:6.25,notes:$('qNotes').value.trim(),measurements:measures,updated_at:new Date().toISOString()};let res;if(editingQuoteId)res=await sb.from('quotes').update(payload).eq('id',editingQuoteId);else res=await sb.from('quotes').insert(payload);if(res.error)return toast(res.error.message);toast(editingQuoteId?'Quote updated in cloud.':'Quote saved to cloud.');clearQuoteDraftLocal();clearQuoteForm(false);await loadQuotes();
  }finally{saveButtons.forEach((b,i)=>{b.disabled=false;b.textContent=saveLabels[i]})}
}
async function loadQuotes(){let{data,error}=await sb.from('quotes').select('*,customer:customers(first_name,last_name,email,phone,service_address,lead_source),jobs:jobs!jobs_quote_id_fkey(id,title,scheduled_start,scheduled_end,status,assigned_to)').order('created_at',{ascending:false});if(error)return toast(error.message);window._cloudQuotes=data||[];renderQuoteResults()}

async function createSquareDraft(quoteId,button){
  let quote=(window._cloudQuotes||[]).find(q=>q.id===quoteId);
  if(!quote)return toast('Quote not found.');
  if(quote.square_invoice_id)return toast(`Square draft ${quote.square_invoice_number||'already exists'}.`);
  let actual=Number(quote.total_sqft)||0,billed=Math.ceil(actual);
  if(!billed)return toast('Add window measurements before creating the Square draft.');
  let item=quote.square_catalog_item_name||'25% Ceramic Tint Install';
  if(!confirm(`Create a Square draft?\n\n${item}\n${actual.toFixed(2)} measured sq ft → ${billed} billed sq ft\n\nNothing will be sent to the customer.`))return;
  let original=button?.textContent||'Create Square Draft';
  if(button){button.disabled=true;button.textContent='Creating…'}
  try{
    const {data:{session:activeSession},error:sessionError}=await sb.auth.getSession();
    if(sessionError)throw sessionError;
    if(!activeSession?.access_token)throw new Error('Your login session has expired. Sign out and sign back in.');
    let{data,error}=await sb.functions.invoke('create-square-draft',{
      body:{quoteId},
      headers:{Authorization:`Bearer ${activeSession.access_token}`}
    });
    if(error){
      let message=error.message||'Square draft request failed.';
      try{
        let details=await error.context?.json();
        message=details?.message||details?.error||message;
      }catch{}
      throw new Error(message);
    }
    if(!data||data.status!=='success')throw new Error(data?.message||'Square did not create the draft.');
    toast(data.duplicate?'Square draft already exists.':`Square draft created • ${data.billedSqft} sq ft • ${data.catalogItemName}`);
    await loadQuotes();
  }catch(error){
    console.error('createSquareDraft error',error);
    alert(error?.message||'Square draft could not be created.');
  }finally{
    if(button&&document.body.contains(button)){
      button.disabled=false;
      button.textContent=original;
    }
  }
}


async function releaseSquareDraft(quoteId){
  let quote=(window._cloudQuotes||[]).find(q=>q.id===quoteId);
  if(!quote)return toast('Quote not found.');
  if(!quote.square_invoice_id&&!quote.square_order_id)return toast('This quote is not linked to a Square draft.');
  if(!confirm('Release the Square draft from this quote?\n\nThis only removes the Square linkage inside Dynamic Tintz OS. It does NOT delete anything in Square.'))return;
  let {error}=await sb.from('quotes').update({
    square_order_id:null,
    square_invoice_id:null,
    square_invoice_number:null,
    square_invoice_url:null,
    square_status:null,
    square_synced_at:null,
    square_catalog_variation_id:null,
    square_billed_sqft:null,
    square_unit_price_cents:null,
    square_draft_generation:Number(quote.square_draft_generation||0)+1,
    updated_at:new Date().toISOString()
  }).eq('id',quoteId);
  if(error)return toast(error.message);
  toast('Square draft released. You can create a new draft anytime.');
  await loadQuotes();
}


function quoteProjectIcon(type){
  let commercial=String(type||'').toLowerCase()==='commercial';
  return commercial
    ? `<span class="quote-type-icon commercial" aria-label="Commercial"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V7l8-4v18M12 9h8v12M7 9h2M7 13h2M7 17h2M15 12h2M15 16h2M15 20h2M2 21h20"/></svg></span>`
    : `<span class="quote-type-icon residential" aria-label="Residential"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5.5 10.5V21h13V10.5M9 21v-6h6v6"/></svg></span>`;
}

function renderQuoteResults(){
  let data=window._cloudQuotes||[],
      q=($('quoteSearch')?.value||'').toLowerCase(),
      status=$('quoteStatusFilter')?.value||'',
      filtered=data
        .filter(x=>(!status||x.status===status)&&JSON.stringify(x).toLowerCase().includes(q))
        .sort((a,b)=>new Date(b.created_at||b.updated_at||0)-new Date(a.created_at||a.updated_at||0)),
      open=data.filter(x=>!['Completed','Lost'].includes(x.status)),
      value=open.reduce((s,x)=>s+Number(x.ceramic_price||0),0),
      avg=data.length?data.reduce((s,x)=>s+Number(x.ceramic_price||0),0)/data.length:0;

  $('quotePipelineValue').textContent=money(value);
  $('quoteAverage').textContent=money(avg);
  $('quoteCount').textContent=data.length;

  $('savedQuotes').innerHTML=filtered.length?filtered.map(q=>{
    let job=Array.isArray(q.jobs)?q.jobs[0]:q.jobs,
        globalIndex=data.indexOf(q),
        actual=Number(q.total_sqft)||0,
        name=((q.customer?.first_name||'')+' '+(q.customer?.last_name||'')).trim()||q.project_name||'Customer',
        phone=String(q.customer?.phone||'').trim(),
        cityOrAddress=q.service_address||q.customer?.service_address||'',
        squareItem=q.square_catalog_item_name||'25% Ceramic Tint Install',
        billed=Math.ceil(actual),
        squareButton=q.square_invoice_id
          ?`<button class="btn" disabled>Square Draft ${esc(q.square_invoice_number||q.square_status||'Created')}</button><button class="btn warn" data-releasesquaredraft="${q.id}">Release Square Draft</button>`
          :`<button class="btn primary" data-squaredraft="${q.id}">Create Square Draft</button>`;

    return `<details class="quote-index-card" data-quoteindex="${q.id}">
      <summary class="quote-index-summary">
        ${quoteProjectIcon(q.project_type)}
        <span class="quote-index-main">
          <b>${esc(name)}</b>
          <small>${esc(cityOrAddress)}</small>
        </span>
        <span class="quote-index-size">
          <strong>${actual.toFixed(0)} sq ft</strong>
          <small>${q.created_at?new Date(q.created_at).toLocaleDateString():''}</small>
        </span>
        <span class="quote-index-status status-${String(q.status||'').toLowerCase().replaceAll(' ','-')}">${esc(q.status||'')}</span>
        ${phone?`<a class="quote-index-call" href="tel:${esc(phone)}" aria-label="Call ${esc(name)}" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h3l1.5 4-2 1.5a14 14 0 0 0 6 6l1.5-2L21 14v3c0 2-1 4-4 4C9.3 21 3 14.7 3 7c0-3 2-4 4-4Z"/></svg></a>`:''}
        <span class="quote-index-chevron">⌄</span>
      </summary>

      <div class="quote-index-expanded">
        <div class="quote-index-top-actions">
          ${phone?`<a class="btn primary quote-call-btn" href="tel:${esc(phone)}">Call Customer</a>`:''}
          <button class="btn primary" data-openquote="${q.id}">Open / Edit</button>
          <button class="btn" data-windowmeasurements="${q.id}">Window Measurements</button>
        </div>

        <div class="quote-index-detail">
          <span><b>Project</b>${esc(q.project_name||'Window Film Project')}</span>
          <span><b>Glass</b>${actual.toFixed(2)} sq ft</span>
          <span><b>Price</b>${money(q.ceramic_price)}</span>
          <span><b>Status</b>${esc(q.status||'')}</span>
          <span><b>Film</b>${esc(squareItem.replace(' Tint Install',''))}</span>
          <span><b>Schedule</b>${job?`${when(job.scheduled_start)} • ${esc(job.status)}`:'Not scheduled'}</span>
        </div>

        <div class="actions quote-index-more-actions">
          ${squareButton}
          <button class="btn" data-optimizequote="${q.id}">Optimize Roll</button>
          <button class="btn" data-duplicatequote="${q.id}">Duplicate</button>
          <button class="btn" data-schedulequote="${q.id}">${job?'Edit Assignment':'Schedule & Assign'}</button>
          ${job?`<button class="btn warn" data-removeassignment="${q.id}" data-jobid="${job.id}">Remove Assignment</button>`:''}
          <button class="btn" data-copycloud="${globalIndex}">Copy</button>
          <button class="btn danger" data-deletequote="${q.id}">Delete Quote</button>
        </div>
      </div>
    </details>`;
  }).join(''):'<div class="card muted">No matching cloud quotes.</div>';

  $('savedQuotes').querySelectorAll('[data-openquote]').forEach(b=>b.onclick=e=>{e.preventDefault();openCloudQuote(b.dataset.openquote)});
  $('savedQuotes').querySelectorAll('[data-squaredraft]').forEach(b=>b.onclick=e=>{e.preventDefault();createSquareDraft(b.dataset.squaredraft,b)});
  $('savedQuotes').querySelectorAll('[data-releasesquaredraft]').forEach(b=>b.onclick=e=>{e.preventDefault();releaseSquareDraft(b.dataset.releasesquaredraft)});
  $('savedQuotes').querySelectorAll('[data-optimizequote]').forEach(b=>b.onclick=e=>{e.preventDefault();openQuoteInOptimizer(b.dataset.optimizequote)});
  $('savedQuotes').querySelectorAll('[data-duplicatequote]').forEach(b=>b.onclick=e=>{e.preventDefault();duplicateCloudQuote(b.dataset.duplicatequote)});
  $('savedQuotes').querySelectorAll('[data-schedulequote]').forEach(b=>b.onclick=e=>{e.preventDefault();openScheduleJob(b.dataset.schedulequote)});
  $('savedQuotes').querySelectorAll('[data-removeassignment]').forEach(b=>b.onclick=e=>{e.preventDefault();removeAssignment(b.dataset.removeassignment,b.dataset.jobid)});
  $('savedQuotes').querySelectorAll('[data-deletequote]').forEach(b=>b.onclick=e=>{e.preventDefault();deleteCloudQuote(b.dataset.deletequote)});
  $('savedQuotes').querySelectorAll('[data-windowmeasurements]').forEach(b=>b.onclick=e=>{e.preventDefault();openWindowMeasurements(b.dataset.windowmeasurements)});
  $('savedQuotes').querySelectorAll('[data-copycloud]').forEach(b=>b.onclick=e=>{e.preventDefault();navigator.clipboard.writeText(cloudQuoteText(data[Number(b.dataset.copycloud)])).then(()=>toast('Quote copied'))});
}
let currentWindowMeasurementText='';

function formatWindowDimension(value){
  let n=Number(value)||0;
  return Number.isInteger(n)?String(n):String(Math.round(n*100)/100);
}
function buildWindowMeasurementText(measurements=[]){
  let rows=Array.isArray(measurements)?measurements:[];
  let valid=rows.filter(m=>Number(m?.w)>0&&Number(m?.h)>0);
  if(!valid.length)return '';
  return ['Window Measurements','',...valid.flatMap((m,i)=>{
    let title=String(m.area||`Window ${i+1}`).trim()||`Window ${i+1}`,
        w=formatWindowDimension(m.w),
        h=formatWindowDimension(m.h),
        qty=Math.max(1,Number(m.qty)||1),
        line=`${w}" × ${h}"${qty>1?`  •  Qty ${qty}`:''}`;
    return [title,line,''];
  })].join('\n').trim();
}
async function openWindowMeasurements(quoteId){
  let{data:q,error}=await sb.from('quotes').select('id,measurements').eq('id',quoteId).single();
  if(error)return toast(error.message);
  let measurements=Array.isArray(q?.measurements)?q.measurements:[],
      text=buildWindowMeasurementText(measurements);
  currentWindowMeasurementText=text;
  $('windowMeasurementsBody').innerHTML=measurements.filter(m=>Number(m?.w)>0&&Number(m?.h)>0).map((m,i)=>{
    let title=String(m.area||`Window ${i+1}`).trim()||`Window ${i+1}`,
        w=formatWindowDimension(m.w),h=formatWindowDimension(m.h),
        qty=Math.max(1,Number(m.qty)||1);
    return `<div class="window-measurement-row"><b>${esc(title)}</b><span>${esc(`${w}" × ${h}"${qty>1?` • Qty ${qty}`:''}`)}</span></div>`;
  }).join('')||'<div class="app-empty">No window measurements are stored on this quote.</div>';
  $('copyWindowMeasurements').disabled=!text;
  $('shareWindowMeasurements').disabled=!text;
  $('windowMeasurementsModal').classList.add('show');
}
function closeWindowMeasurementsModal(){
  $('windowMeasurementsModal')?.classList.remove('show');
}
async function copyWindowMeasurements(){
  if(!currentWindowMeasurementText)return;
  try{
    await navigator.clipboard.writeText(currentWindowMeasurementText);
    toast('Window measurements copied.');
  }catch(e){
    toast('Could not copy measurements.');
  }
}
async function shareWindowMeasurements(){
  if(!currentWindowMeasurementText)return;
  try{
    if(navigator.share){
      await navigator.share({title:'Window Measurements',text:currentWindowMeasurementText});
    }else{
      await navigator.clipboard.writeText(currentWindowMeasurementText);
      toast('Sharing is not available here, so the measurements were copied instead.');
    }
  }catch(e){
    if(e?.name!=='AbortError')toast('Could not share measurements.');
  }
}

async function duplicateCloudQuote(id){let{data:q,error}=await sb.from('quotes').select('*,customer:customers(*)').eq('id',id).single();if(error)return toast(error.message);let customer={first_name:q.customer?.first_name||'',last_name:q.customer?.last_name||'',email:q.customer?.email||'',phone:q.customer?.phone||'',service_address:q.customer?.service_address||q.service_address||'',lead_source:q.customer?.lead_source||'',notes:q.customer?.notes||''},{data:newCustomer,error:customerError}=await sb.from('customers').insert(customer).select().single();if(customerError)return toast(customerError.message);let payload={customer_id:newCustomer.id,project_name:(q.project_name||'Project')+' — Copy',project_type:q.project_type,square_catalog_item_name:q.square_catalog_item_name||'25% Ceramic Tint Install',status:'New Lead',service_address:q.service_address,miles:q.miles,total_sqft:q.total_sqft,ceramic_list_price:q.ceramic_list_price,ceramic_price:q.ceramic_price,ceramic_savings:q.ceramic_savings,solar_price:q.solar_price,tax_rate:q.tax_rate,notes:q.notes,measurements:q.measurements,assigned_to:null},{error:quoteError}=await sb.from('quotes').insert(payload);if(quoteError)return toast(quoteError.message);toast('Quote duplicated as a new project.');await loadQuotes()}
function calendarActionForJobStatus(status){
  if(status==='Scheduled'||status==='Confirmed')return 'sync';
  if(status==='Canceled')return 'delete';
  return null;
}

async function applyCalendarStatus(jobId,status){
  let action=calendarActionForJobStatus(status);
  if(!action)return {ok:true,skipped:true,status};
  return syncCalendarJob(jobId,action);
}

async function functionErrorDetail(error,fallback='Edge Function failed'){
  try{
    let ctx=error?.context;
    if(ctx&&typeof ctx.clone==='function'){
      let response=ctx.clone();
      try{
        let data=await response.json();
        if(data?.error)return String(data.error);
        if(data?.message)return String(data.message);
        if(data&&typeof data==='object')return JSON.stringify(data);
      }catch{}
      try{
        let text=await ctx.clone().text();
        if(text?.trim())return text.trim().slice(0,1000);
      }catch{}
      if(ctx.status)return `${fallback} (HTTP ${ctx.status})`;
    }
    if(typeof error?.context?.responseBody==='string'&&error.context.responseBody.trim())return error.context.responseBody.trim();
    if(typeof error?.context?.body==='string'&&error.context.body.trim())return error.context.body.trim();
  }catch{}
  return error?.message||fallback;
}

async function syncCalendarJob(jobId,action='sync'){
  let results=[],errors=[],providers=[];
  const checks=await Promise.allSettled([
    sb.functions.invoke('google-calendar-auth',{body:{action:'status'}}),
    sb.functions.invoke('icloud-calendar-auth',{body:{action:'status'}})
  ]);
  const google=checks[0].status==='fulfilled'?checks[0].value:null;
  const icloud=checks[1].status==='fulfilled'?checks[1].value:null;

  if(!google?.error&&google?.data?.ok!==false&&google?.data?.connected&&(google.data.selected_calendars||[]).length){
    providers.push(['google-calendar-sync','Google']);
  }
  let localIcloudSyncIds=getIcloudSyncCalendarIds();
  let icloudSyncAllowed=localIcloudSyncIds===null
    ? (icloud?.data?.selected_calendars||[]).length>0
    : localIcloudSyncIds.length>0;
  if(!icloud?.error&&icloud?.data?.ok!==false&&icloud?.data?.configured&&icloudSyncAllowed){
    providers.push(['icloud-calendar-sync','iCloud']);
  }
  if(!providers.length)return {ok:true,providers:[],skipped:true};

  for(let [fn,label] of providers){
    try{
      let{data,error}=await sb.functions.invoke(fn,{body:{job_id:jobId,action}});
      if(error){
        let detail=await functionErrorDetail(error,`${label} calendar sync failed`);
        throw new Error(detail);
      }
      if(data?.ok===false&&!data?.skipped)throw new Error(data.error||`${label} calendar sync failed`);
      if(!data?.skipped)results.push({provider:label,...data});
    }catch(e){
      let msg=e?.message||String(e);
      if(/not connected|not configured|No calendars are selected|No iCloud calendars selected|Function not found|404/i.test(msg))continue;
      errors.push(`${label}: ${msg}`);
    }
  }
  if(errors.length)throw new Error(errors.join(' | '));
  return {ok:true,providers:results};
}
async function removeAssignment(quoteId,jobId){let q=window._cloudQuotes?.find(x=>x.id===quoteId),name=`${q?.customer?.first_name||''} ${q?.customer?.last_name||''}`.trim()||q?.project_name||'this quote';if(!confirm(`Remove the scheduled assignment for ${name}?\n\nThis will remove the job from the installer dashboard, but it will keep the quote and customer record.`))return;try{await syncCalendarJob(jobId,'delete')}catch(e){console.warn('Calendar delete warning:',e)}let{error:jobError}=await sb.from('jobs').delete().eq('id',jobId);if(jobError)return toast(jobError.message);let{error:quoteError}=await sb.from('quotes').update({assigned_to:null,status:'Approved',updated_at:new Date().toISOString()}).eq('id',quoteId);if(quoteError)return toast('Assignment removed, but quote update failed: '+quoteError.message);toast('Assignment removed. Quote remains available.');await loadQuotes()}async function deleteCloudQuote(quoteId){let q=window._cloudQuotes?.find(x=>x.id===quoteId),name=`${q?.customer?.first_name||''} ${q?.customer?.last_name||''}`.trim()||q?.project_name||'this quote';let confirmed=confirm(`Permanently delete the quote for ${name}?\n\nThis will also remove any linked scheduled job and immediately remove it from the installer dashboard. The customer record will remain available for future work.\n\nThis cannot be undone.`);if(!confirmed)return;let{error:jobError}=await sb.from('jobs').delete().eq('quote_id',quoteId);if(jobError)return toast('Quote was not deleted because the linked job could not be removed: '+jobError.message);let{error:quoteError}=await sb.from('quotes').delete().eq('id',quoteId);if(quoteError)return toast(quoteError.message);if(editingQuoteId===quoteId)clearQuoteForm(false);toast('Quote and linked assignment permanently deleted.');await loadQuotes()}async function openScheduleJob(quoteId){$('scheduleMessage').textContent='Loading installers…';let quote=window._cloudQuotes?.find(q=>q.id===quoteId);if(!quote){let{data,error}=await sb.from('quotes').select('*,customer:customers(first_name,last_name)').eq('id',quoteId).single();if(error)return toast(error.message);quote=data}let[{data:people,error:peopleError},{data:existing,error:jobError}]=await Promise.all([sb.from('profiles').select('id,full_name,email,role,active').eq('active',true).in('role',['installer','manager','owner']).order('full_name'),sb.from('jobs').select('*').eq('quote_id',quoteId).order('created_at',{ascending:false}).limit(1).maybeSingle()]);if(peopleError||jobError)return toast((peopleError||jobError).message);if(!people?.length)return toast('No active installer accounts were found.');let selected=existing?.assigned_installers?.length?existing.assigned_installers:(existing?.assigned_to?[existing.assigned_to]:[people.find(p=>String(p.role)==='installer')?.id||people[0].id]);$('scheduleInstallers').innerHTML=(people||[]).map(p=>`<label class="installer-option"><input type="checkbox" value="${p.id}" ${selected.includes(p.id)?'checked':''}><span>${esc(p.full_name||p.email)}<small>${esc(String(p.role))}</small></span></label>`).join('');$('scheduleQuoteId').value=quoteId;$('scheduleQuoteName').textContent=`${quote.customer?.first_name||''} ${quote.customer?.last_name||''} • ${quote.project_name||'Project'}`.trim();$('scheduleTitle').value=existing?.title||`${quote.customer?.last_name||quote.customer?.first_name||'Customer'} — ${quote.project_name||'Window Film Installation'}`;$('scheduleNotes').value=existing?.notes||quote.notes||'';$('scheduleStatus').value=existing?.status||'Scheduled';$('scheduleStart').value=toLocalInput(existing?.scheduled_start);$('scheduleEnd').value=toLocalInput(existing?.scheduled_end);$('scheduleJobModal').dataset.jobId=existing?.id||'';$('scheduleJobModal').dataset.originalStatus=existing?.status||'Scheduled';$('scheduleMessage').textContent=existing?'This quote already has an assigned job. Saving will update it.':'Choose one or more installers and the installation time.';$('scheduleJobModal').classList.add('show');loadScheduleMaterialPlan(quote,existing?.id||'')}function toLocalInput(value){if(!value)return'';let d=new Date(value),off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,16)}async function saveScheduledJob(){
  let quoteId=$('scheduleQuoteId').value,assigned=[...$('scheduleInstallers').querySelectorAll('input:checked')].map(x=>x.value),start=$('scheduleStart').value,title=$('scheduleTitle').value.trim();
  if(!quoteId||!assigned.length||!start||!title){$('scheduleMessage').textContent='At least one installer, start time, and job title are required.';return}
  let quote=window._cloudQuotes?.find(q=>q.id===quoteId);if(!quote){let{data}=await sb.from('quotes').select('*').eq('id',quoteId).single();quote=data}
  let selectedStatus=$('scheduleStatus').value,existingJobId=$('scheduleJobModal').dataset.jobId,originalStatus=$('scheduleJobModal').dataset.originalStatus||'Scheduled',interimStatus=selectedStatus==='Completed'?(originalStatus==='Completed'?'Scheduled':originalStatus):selectedStatus,now=new Date().toISOString();
  let payload={quote_id:quoteId,title,service_address:quote?.service_address||'',scheduled_start:new Date(start).toISOString(),scheduled_end:$('scheduleEnd').value?new Date($('scheduleEnd').value).toISOString():null,status:interimStatus,archived_at:null,notes:$('scheduleNotes').value.trim(),assigned_to:assigned[0],assigned_installers:assigned,updated_at:now},res;
  if(existingJobId)res=await sb.from('jobs').update(payload).eq('id',existingJobId).select('id').single();else res=await sb.from('jobs').insert(payload).select('id').single();
  if(res.error){$('scheduleMessage').textContent=res.error.message;return}
  let jobId=res.data?.id||existingJobId;try{await saveScheduleMaterialPlan(jobId)}catch(e){$('scheduleMessage').textContent='Job saved, but material plan failed: '+e.message;return}
  if(selectedStatus==='Completed'){
    try{
      let actualRaw=$('scheduleMaterialActualFt')?.value??'',
          finalInv=await finalizeScheduledJobInventory(jobId,actualRaw===''?null:Number(actualRaw));
      if(finalInv?.canceled){$('scheduleMessage').textContent='Completion canceled. Enter actual film used to close the job.';return}
    }catch(e){$('scheduleMessage').textContent='Job saved, but final inventory deduction failed: '+e.message;return}
    let r=await sb.from('jobs').update({status:'Completed',archived_at:now,updated_at:now}).eq('id',jobId);
    if(r.error){$('scheduleMessage').textContent='Inventory finalized, but completion failed: '+r.error.message;return}
  }
  let{error:qError}=await sb.from('quotes').update({status:selectedStatus==='Completed'?'Completed':selectedStatus==='Canceled'?'Approved':'Scheduled',assigned_to:assigned[0],updated_at:now}).eq('id',quoteId);if(qError){$('scheduleMessage').textContent='Job saved, but quote status update failed: '+qError.message;return}
  let calendarAction=calendarActionForJobStatus(selectedStatus),calendarWarning='';
  if(calendarAction){
    try{await applyCalendarStatus(jobId,selectedStatus)}
    catch(e){
      calendarWarning=e?.message||String(e);
      console.warn('Calendar sync warning:',calendarWarning);
    }
  }
  $('scheduleJobModal').classList.remove('show');
  if(calendarWarning){
    toast('Job saved successfully. Calendar sync needs attention.');
  }else{
    toast(calendarAction==='delete'?'Job saved and removed from calendar.':calendarAction==='sync'?'Job saved and calendar updated.':'Job saved. No calendar change for this status.');
  }
  await loadQuotes();await dashboard();
  if($('operations')?.classList.contains('active'))await loadOperations();
  if(calendarWarning)setTimeout(()=>toast('Calendar: '+calendarWarning),350);
}
async function loadOperations(){
  if(!operationsDefaultsApplied){
    if($('operationView'))$('operationView').value='all';
    if($('operationStatus'))$('operationStatus').value='';
    if($('operationRange'))$('operationRange').value='all';
    operationsDefaultsApplied=true;
  }
  let{data,error}=await sb.from('jobs').select('*,quote:quotes!jobs_quote_id_fkey(id,project_name,total_sqft,measurements,status,notes,square_catalog_item_name,customer:customers(first_name,last_name)),assignee:profiles!jobs_assigned_to_fkey(full_name,email)').order('scheduled_start',{ascending:true});if(error)return toast(error.message);let ids=[...new Set((data||[]).flatMap(j=>j.assigned_installers||[]))],people=[];if(ids.length){let r=await sb.from('profiles').select('id,full_name,email').in('id',ids);people=r.data||[]}let map=Object.fromEntries(people.map(p=>[p.id,p]));let jobs=data||[],jobIds=jobs.map(j=>j.id),plans=[];if(jobIds.length){let pr=await sb.from('job_material_plans').select('job_id,planned_linear_inches,actual_linear_inches,source,product:film_inventory_products(name)').in('job_id',jobIds);plans=pr.data||[]}let planMap=Object.fromEntries(plans.map(p=>[p.job_id,p]));operationsCache=jobs.map(j=>({...j,installer_names:(j.assigned_installers||[]).map(id=>map[id]?.full_name||map[id]?.email).filter(Boolean),material_plan:planMap[j.id]||null}));try{await loadIcloudViewEvents()}catch(e){console.warn('Calendar view refresh warning:',e)}renderOperations()}
async function refreshOperationsSchedule(){
  let b=$('refreshOperations');
  if(b){b.disabled=true;b.classList.add('is-refreshing')}
  try{
    await loadOperations();
    if(operationsSelectedDate)await renderSelectedCalendarDate();
    toast('Schedule refreshed.');
  }catch(e){
    console.error('Schedule refresh failed:',e);
    toast('Schedule refresh failed: '+(e?.message||String(e)));
  }finally{
    if(b){b.disabled=false;b.classList.remove('is-refreshing')}
  }
}
function ensureArchiveControls(){let host=$('operations')?.querySelector('.card');if(!host||$('operationView'))return;let controls=document.createElement('div');controls.className='grid2';controls.style.marginTop='12px';controls.innerHTML=`<div class="field"><label>Board View</label><select id="operationView"><option value="active">Active Jobs</option><option value="archive">Archived Jobs</option></select></div><div class="field"><label>Search Jobs</label><input id="operationSearch" placeholder="Customer, address, installer, project..."></div>`;host.appendChild(controls);$('operationView').onchange=renderOperations;$('operationSearch').oninput=renderOperations}
let operationsCalendarDate=new Date(),operationsSelectedDate=null,operationsDefaultsApplied=false;
let icloudViewEventsCache=[];
async function loadIcloudViewEvents(){
  let ids=getIcloudViewCalendarIds();
  if(!ids.length){icloudViewEventsCache=[];return}

  let range=$('operationRange')?.value||'all',
      selected=operationsSelectedDate,
      now=new Date(),
      rangeStart=null,
      rangeEnd=null;

  if(selected){
    let parts=selected.split('-').map(Number);
    rangeStart=new Date(parts[0],parts[1]-1,parts[2],0,0,0,0);
    rangeEnd=new Date(parts[0],parts[1]-1,parts[2]+1,0,0,0,0);
  }else if(range==='today'){
    rangeStart=new Date(now);rangeStart.setHours(0,0,0,0);
    rangeEnd=new Date(rangeStart.getTime()+86400000);
  }else if(range==='7'){
    rangeStart=new Date(now);rangeStart.setHours(0,0,0,0);
    rangeEnd=new Date(rangeStart.getTime()+7*86400000);
  }else if(range==='30'){
    rangeStart=new Date(now);rangeStart.setHours(0,0,0,0);
    rangeEnd=new Date(rangeStart.getTime()+30*86400000);
  }else if(range==='month'){
    let bounds=operationsMonthBounds();
    rangeStart=bounds.start;
    rangeEnd=bounds.end;
  }else{
    let jobDates=operationsCache.map(operationDisplayDate).filter(Boolean).map(x=>new Date(x)).filter(x=>!Number.isNaN(x.getTime()));
    let earliest=jobDates.length?new Date(Math.min(...jobDates.map(x=>x.getTime()))):new Date(now.getFullYear()-1,now.getMonth(),1);
    let latest=jobDates.length?new Date(Math.max(...jobDates.map(x=>x.getTime()))):now;
    rangeStart=new Date(Math.min(earliest.getTime(),new Date(now.getFullYear()-1,now.getMonth(),1).getTime()));
    rangeStart.setDate(rangeStart.getDate()-31);
    rangeEnd=new Date(Math.max(latest.getTime(),now.getTime()));
    rangeEnd.setFullYear(rangeEnd.getFullYear()+1);
    rangeEnd.setDate(rangeEnd.getDate()+31);
  }

  if(!(rangeStart instanceof Date)||Number.isNaN(rangeStart.getTime())||!(rangeEnd instanceof Date)||Number.isNaN(rangeEnd.getTime())){
    console.warn('Invalid iCloud schedule range.',{range,selected,rangeStart,rangeEnd});
    icloudViewEventsCache=[];
    return;
  }

  try{
    let{data,error}=await sb.functions.invoke('icloud-calendar-events',{body:{
      calendar_ids:ids,
      start:rangeStart.toISOString(),
      end:rangeEnd.toISOString()
    }});
    if(error||data?.ok===false)throw new Error(error?.message||data?.error||'Could not load iCloud view calendars.');
    icloudViewEventsCache=(data.events||[]).map(e=>({...e,_external:true}));
  }catch(e){
    console.warn('View-only iCloud calendar load:',e);
    icloudViewEventsCache=[];
  }
}
async function loadSelectedDayIcloudEvents(dateKey){
  let ids=getIcloudViewCalendarIds();
  if(!ids.length)return [];
  let parts=String(dateKey||'').split('-').map(Number);
  if(!parts[0]||!parts[1]||!parts[2])return [];
  let dayStart=new Date(parts[0],parts[1]-1,parts[2],0,0,0,0),
      dayEnd=new Date(parts[0],parts[1]-1,parts[2]+1,0,0,0,0);
  try{
    let{data,error}=await sb.functions.invoke('icloud-calendar-events',{body:{
      calendar_ids:ids,
      start:dayStart.toISOString(),
      end:dayEnd.toISOString()
    }});
    if(error||data?.ok===false)throw new Error(error?.message||data?.error||'Could not load iCloud events for this date.');
    return (data.events||[]).map(e=>({...e,_external:true}));
  }catch(e){
    console.warn('Selected-day iCloud load:',e);
    return [];
  }
}
function externalCalendarEventMatches(e,{ignoreRange=false}={}){
  let view=$('operationView')?.value||'active',
      status=$('operationStatus')?.value||'',
      range=$('operationRange')?.value||'7',
      search=($('operationSearch')?.value||'').toLowerCase();
  if(view==='archive'||status)return false;
  if(search&&!JSON.stringify(e).toLowerCase().includes(search))return false;
  if(!ignoreRange){
    let now=new Date(),start=new Date(now);start.setHours(0,0,0,0),end=null,d=new Date(e.start);
    if(range==='today')end=new Date(start.getTime()+86400000);
    else if(range==='7')end=new Date(start.getTime()+7*86400000);
    else if(range==='30')end=new Date(start.getTime()+30*86400000);
    else if(range==='month'){let b=operationsMonthBounds();start=b.start;end=b.end}
    if(end&&(d<start||d>=end))return false;
  }
  return true;
}


function operationDisplayDate(j){
  return j.scheduled_start||j.archived_at||j.updated_at||j.created_at||null;
}
function operationLocalDateKey(value){
  if(!value)return '';
  let d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function operationsMonthBounds(){
  let y=operationsCalendarDate.getFullYear(),m=operationsCalendarDate.getMonth();
  return {
    start:new Date(y,m,1,0,0,0,0),
    end:new Date(y,m+1,1,0,0,0,0)
  };
}
function operationMatchesBaseFilters(j,{ignoreRange=false}={}){
  let view=$('operationView')?.value||'active',
      status=$('operationStatus')?.value||'',
      range=$('operationRange')?.value||'7',
      search=($('operationSearch')?.value||'').toLowerCase(),
      archived=j.status==='Completed'||!!j.archived_at;

  if(view==='active'&&archived)return false;
  if(view==='archive'&&!archived)return false;
  if(status&&j.status!==status)return false;
  if(search&&!JSON.stringify(j).toLowerCase().includes(search))return false;

  if(!ignoreRange){
    let now=new Date(),start=new Date(now);start.setHours(0,0,0,0);
    let end=null,dateValue=view==='archive'?(j.archived_at||j.updated_at):j.scheduled_start;
    if(range==='today')end=new Date(start.getTime()+86400000);
    else if(range==='7')end=new Date(start.getTime()+7*86400000);
    else if(range==='30')end=new Date(start.getTime()+30*86400000);
    else if(range==='month'){
      let b=operationsMonthBounds();start=b.start;end=b.end;
    }
    if(end&&(!dateValue||new Date(dateValue)<start||new Date(dateValue)>=end))return false;
  }
  return true;
}

function renderOperationsCalendar(){
  let grid=$('operationsCalendarGrid'),label=$('operationsMonthLabel'),summary=$('operationsMonthSummary');
  if(!grid||!label)return;

  let y=operationsCalendarDate.getFullYear(),m=operationsCalendarDate.getMonth();
  let monthStart=new Date(y,m,1),monthEnd=new Date(y,m+1,1);
  label.textContent=monthStart.toLocaleDateString([],{month:'long',year:'numeric'});

  let filtered=operationsCache.filter(j=>operationMatchesBaseFilters(j,{ignoreRange:true})),
      external=icloudViewEventsCache.filter(e=>externalCalendarEventMatches(e,{ignoreRange:true})),
      byDate={};

  filtered.forEach(j=>{
    let key=operationLocalDateKey(operationDisplayDate(j));if(!key)return;
    (byDate[key]??=[]).push({kind:'job',value:j,date:operationDisplayDate(j)});
  });
  external.forEach(e=>{
    let key=operationLocalDateKey(e.start);if(!key)return;
    (byDate[key]??=[]).push({kind:'external',value:e,date:e.start});
  });

  let monthJobs=filtered.filter(j=>{let d=operationDisplayDate(j);if(!d)return false;d=new Date(d);return d>=monthStart&&d<monthEnd}),
      monthExternal=external.filter(e=>{let d=new Date(e.start);return d>=monthStart&&d<monthEnd}),
      completed=monthJobs.filter(j=>j.status==='Completed'||j.archived_at).length;
  if(summary)summary.textContent=`${monthJobs.length} job${monthJobs.length===1?'':'s'} • ${monthExternal.length} personal/calendar • ${completed} completed`;

  let firstDay=monthStart.getDay(),daysInMonth=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate(),cells=[];
  for(let i=0;i<42;i++){
    let dayNum=i-firstDay+1,cellDate,muted=false;
    if(dayNum<1){cellDate=new Date(y,m-1,prevDays+dayNum);muted=true}
    else if(dayNum>daysInMonth){cellDate=new Date(y,m+1,dayNum-daysInMonth);muted=true}
    else cellDate=new Date(y,m,dayNum);

    let key=operationLocalDateKey(cellDate),
        entries=(byDate[key]||[]).sort((a,b)=>new Date(a.date||0)-new Date(b.date||0)),
        todayKey=operationLocalDateKey(new Date()),selected=operationsSelectedDate===key;

    cells.push(`<button class="operations-day-cell ${muted?'outside-month':''} ${key===todayKey?'is-today':''} ${selected?'is-selected':''}" data-opdate="${key}">
      <span class="day-number">${cellDate.getDate()}</span>
      <span class="day-job-count">${entries.length?`${entries.length} item${entries.length===1?'':'s'}`:''}</span>
      <span class="day-dots">${entries.slice(0,4).map(x=>x.kind==='external'?'<i class="status-dot dot-external"></i>':`<i class="status-dot dot-${String(x.value.status||'Scheduled').toLowerCase().replaceAll(' ','-')}"></i>`).join('')}</span>
      ${entries[0]?`<span class="day-preview">${esc(entries[0].kind==='external'?(entries[0].value.summary||'Calendar Event'):(entries[0].value.title||entries[0].value.quote?.project_name||'Installation'))}</span>`:''}
    </button>`);
  }
  grid.innerHTML=cells.join('');
  grid.querySelectorAll('[data-opdate]').forEach(b=>b.onclick=async()=>{
    operationsSelectedDate=b.dataset.opdate;
    renderOperationsCalendar();
    await renderSelectedCalendarDate();
    setTimeout(()=>$('operationsSelectedDayPanel')?.scrollIntoView({behavior:'smooth',block:'nearest'}),30);
  });
}

async function renderSelectedCalendarDate(){
  let panel=$('operationsSelectedDayPanel'),title=$('operationsSelectedDayTitle'),host=$('operationsSelectedDayItems');
  if(!panel||!host)return;
  if(!operationsSelectedDate){panel.classList.add('hidden');host.innerHTML='';return}

  let [yy,mm,dd]=operationsSelectedDate.split('-').map(Number),d=new Date(yy,mm-1,dd);
  title.textContent=d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric'});
  panel.classList.remove('hidden');
  host.innerHTML='<div class="app-empty">Loading this date…</div>';

  let jobs=operationsCache.filter(j=>operationLocalDateKey(operationDisplayDate(j))===operationsSelectedDate),
      external=await loadSelectedDayIcloudEvents(operationsSelectedDate),
      entries=[...jobs.map(j=>({kind:'job',date:operationDisplayDate(j),value:j})),...external.map(e=>({kind:'external',date:e.start,value:e}))].sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));

  host.innerHTML=entries.length?entries.map(entry=>{
    if(entry.kind==='external'){
      let e=entry.value,s=e.start?new Date(e.start):null,time=e.all_day?'All Day':s?.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})||'—';
      return `<div class="selected-day-row external">
        <span class="selected-day-time">${esc(time)}</span>
        <div><b>${esc(e.summary||'Calendar Event')}</b><small>${esc(e.calendar_name||'iCloud')} • VIEW ONLY${e.location?' • '+esc(e.location):''}</small>${e.description?`<small class="selected-day-description">${esc(e.description)}</small>`:''}</div>
        <span class="selected-day-type">PERSONAL</span>
      </div>`;
    }
    let j=entry.value,s=j.scheduled_start?new Date(j.scheduled_start):null,time=s?.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})||'—',
        customer=j.quote?.customer?`${j.quote.customer.first_name||''} ${j.quote.customer.last_name||''}`.trim():'';
    return `<div class="selected-day-row">
      <span class="selected-day-time">${esc(time)}</span>
      <div><b>${esc(customer||j.title||j.quote?.project_name||'Installation')}</b><small>${esc(j.service_address||j.title||'Dynamic Tintz Job')}</small></div>
      <span class="selected-day-type job">${esc(j.status||'Scheduled')}</span>
    </div>`;
  }).join(''):'<div class="app-empty">Nothing is scheduled on this date.</div>';
}

function renderUpcomingDynamicTintzJobs(){
  let host=$('operationsUpcomingList'),meta=$('operationsUpcomingMeta');
  if(!host)return;

  let now=new Date(),
      upcoming=operationsCache.filter(j=>{
        if(!j.scheduled_start)return false;
        let d=new Date(j.scheduled_start);
        if(Number.isNaN(d.getTime())||d<now)return false;
        return !['Completed','Canceled'].includes(String(j.status||''));
      }).sort((a,b)=>new Date(a.scheduled_start)-new Date(b.scheduled_start));

  if(meta)meta.textContent=`${upcoming.length} upcoming job${upcoming.length===1?'':'s'}`;

  host.innerHTML=upcoming.length?upcoming.map(j=>{
    let d=new Date(j.scheduled_start),
        day=d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}),
        time=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),
        customer=j.quote?.customer?`${j.quote.customer.first_name||''} ${j.quote.customer.last_name||''}`.trim():'',
        film=j.material_plan?.product?.name||j.quote?.square_catalog_item_name||'';
    return `<button class="operations-upcoming-row" data-opsupcoming="${j.quote_id||''}">
      <span class="operations-upcoming-date"><small>${esc(day)}</small><b>${esc(time)}</b></span>
      <span class="operations-upcoming-copy">
        <b>${esc(customer||j.title||j.quote?.project_name||'Window Film Installation')}</b>
        <small>${esc(j.service_address||'')}${film?` • ${esc(film.replace(' Tint Install',''))}`:''}</small>
      </span>
      <span class="app-status-pill status-${String(j.status||'Scheduled').toLowerCase().replaceAll(' ','-')}">${esc(j.status||'Scheduled')}</span>
      <span class="app-chevron">›</span>
    </button>`;
  }).join(''):'<div class="app-empty">No upcoming Dynamic Tintz jobs are currently scheduled.</div>';

  host.querySelectorAll('[data-opsupcoming]').forEach(b=>b.onclick=()=>{
    let qid=b.dataset.opsupcoming;
    if(qid)openScheduleJob(qid);
  });
}

function renderOperations(){
  ensureArchiveControls();
  renderUpcomingDynamicTintzJobs();
  renderOperationsCalendar();

  let view=$('operationView')?.value||'active',
      jobs=operationsCache.filter(j=>operationMatchesBaseFilters(j)),
      external=icloudViewEventsCache.filter(e=>externalCalendarEventMatches(e));

  if(operationsSelectedDate){renderSelectedCalendarDate()}else{$('operationsSelectedDayPanel')?.classList.add('hidden')}

  let agenda=[
    ...jobs.map(j=>({kind:'job',value:j,date:operationDisplayDate(j)}))
  ];
  agenda.sort((a,b)=>{
    let ad=new Date(a.date||0),bd=new Date(b.date||0);
    return view==='archive'?bd-ad:ad-bd;
  });

  let title=$('operationsAgendaTitle'),meta=$('operationsAgendaMeta'),clear=$('operationsClearDate');
  if(title)title.textContent=view==='archive'?'Completed Job Details':view==='all'?'All Dynamic Tintz Job Details':'Filtered Dynamic Tintz Jobs';
  if(meta)meta.textContent=`${jobs.length} Dynamic Tintz job${jobs.length===1?'':'s'}`;
  if(operationsSelectedDate)clear?.classList.remove('hidden');else clear?.classList.add('hidden');

  $('operationsList').innerHTML=agenda.length?agenda.map(entry=>{
    let j=entry.value,archived=j.status==='Completed'||!!j.archived_at,
        start=j.scheduled_start?new Date(j.scheduled_start):null,
        opTime=start?start.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'—',
        opDate=start?start.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}):'',
        customer=j.quote?.customer?`${j.quote.customer.first_name||''} ${j.quote.customer.last_name||''}`.trim():'',
        film=j.material_plan?.product?.name||j.quote?.square_catalog_item_name||'';

    return `<div class="operation-card app-operation-card calendar-agenda-card">
      <div class="app-operation-top">
        ${archived?`<span class="app-time-tile completed-tile">DONE</span>`:`<span class="app-time-tile"><small>${esc(opDate)}</small>${esc(opTime)}</span>`}
        <div class="app-operation-copy">
          <h2>${esc(customer||j.title||j.quote?.project_name||'Installation')}</h2>
          <div class="muted">${esc(j.title||j.quote?.project_name||'Window Film Installation')}<br>${esc(j.service_address||'')}</div>
        </div>
        <span class="app-status-pill status-${String(j.status||'Scheduled').toLowerCase().replaceAll(' ','-')}">${archived?'Completed':esc(j.status||'Scheduled')}</span>
      </div>
      <div class="calendar-job-facts">
        <div><span>Installer</span><b>${esc(j.installer_names?.join(', ')||j.assignee?.full_name||j.assignee?.email||'Unassigned')}</b></div>
        <div><span>Glass</span><b>${Number(j.quote?.total_sqft||0).toFixed(2)} sq ft</b></div>
        ${film?`<div><span>Film</span><b>${esc(film.replace(' Tint Install',''))}</b></div>`:''}
      </div>
      ${j.notes?`<div class="operation-notes"><b>Field Notes:</b> ${esc(j.notes)}</div>`:''}
      ${j.material_plan?`<div class="operation-notes"><b>Film Plan:</b> ${esc(j.material_plan.product?.name||'Film')} • ${invFmt(invFeet(j.material_plan.planned_linear_inches),1)} linear ft planned${j.material_plan.actual_linear_inches!=null?` • ${invFmt(invFeet(j.material_plan.actual_linear_inches),1)} ft actual`:''} • ${esc(j.material_plan.source||'manual')}</div>`:''}
      <div class="actions">
        ${archived?`<button class="btn warn" data-restorejob="${j.id}">Restore Job</button>`:
        `<button class="btn primary" data-opsedit="${j.quote_id}">Edit Assignment</button>
         <button class="btn" data-jobid="${j.id}" data-opsstatus="En Route">En Route</button>
         <button class="btn" data-jobid="${j.id}" data-opsstatus="In Progress">In Progress</button>
         <button class="btn" data-jobid="${j.id}" data-opsstatus="Completed">Complete</button>
         <a class="btn" target="_blank" href="https://maps.apple.com/?q=${encodeURIComponent(j.service_address||'')}">Directions</a>`}
      </div>
    </div>`;
  }).join(''):`<div class="app-empty">${view==='archive'?'No completed jobs match these filters.':'No schedule items match the selected filters.'}</div>`;

  $('operationsList').querySelectorAll('[data-opsedit]').forEach(b=>b.onclick=()=>openScheduleJob(b.dataset.opsedit));
  $('operationsList').querySelectorAll('[data-opsstatus]').forEach(b=>b.onclick=()=>ownerUpdateJobStatus(b.dataset.jobid,b.dataset.opsstatus));
  $('operationsList').querySelectorAll('[data-restorejob]').forEach(b=>b.onclick=()=>restoreArchivedJob(b.dataset.restorejob));
}

async function ownerUpdateJobStatus(jobId,status){let j=operationsCache.find(x=>x.id===jobId);if(!j)return toast('Job not found.');if(status==='Completed'){if(!confirm('Mark this job completed and move it to the archive?\n\nYou will confirm the actual film used before inventory is finalized.'))return;try{let f=await finalizeScheduledJobInventory(j.id);if(f?.canceled)return toast('Completion canceled. Inventory was not changed.')}catch(e){return toast('Inventory finalization failed: '+e.message)}}let now=new Date().toISOString(),{error}=await sb.from('jobs').update({status,archived_at:status==='Completed'?now:null,updated_at:now}).eq('id',j.id);if(error)return toast(error.message);if(j.quote_id)await sb.from('quotes').update({status:status==='Completed'?'Completed':'Scheduled',updated_at:now}).eq('id',j.quote_id);let calendarAction=calendarActionForJobStatus(status);if(calendarAction){try{await applyCalendarStatus(j.id,status)}catch(e){console.warn('Calendar sync warning:',e)}}toast(status==='Completed'?'Job completed and archived.':status==='Canceled'?'Job canceled and removed from calendar.':`Job marked ${status}.`);await loadOperations();dashboard()}
async function restoreArchivedJob(jobId){let j=operationsCache.find(x=>x.id===jobId);if(!j)return toast('Archived job not found.');if(!confirm('Restore this job to the active Operations board?'))return;let now=new Date().toISOString(),{error}=await sb.from('jobs').update({status:'Scheduled',archived_at:null,updated_at:now}).eq('id',jobId);if(error)return toast(error.message);if(j.quote_id)await sb.from('quotes').update({status:'Scheduled',updated_at:now}).eq('id',j.quote_id);toast('Job restored to Active Jobs.');await loadOperations();dashboard()}
async function openCloudQuote(id){$('quoteBuilderPanel')?.setAttribute('open','');let{data:q,error}=await sb.from('quotes').select('*,customer:customers(*)').eq('id',id).single();if(error)return toast(error.message);editingQuoteId=q.id;editingCustomerId=q.customer_id;$('qFirst').value=q.customer?.first_name||'';$('qLast').value=q.customer?.last_name||'';$('qEmail').value=q.customer?.email||'';$('qPhone').value=q.customer?.phone||'';$('qAddress').value=q.service_address||'';$('qProject').value=q.project_name||'';$('qType').value=q.project_type||'Residential';if($('qSquareItem'))$('qSquareItem').value=q.square_catalog_item_name||'25% Ceramic Tint Install';$('qStatus').value=q.status||'New Lead';$('qMiles').value=q.miles||0;quoteMilesManual=true;setMileageAutoStatus('Stored mileage from this quote');$('qLead').value=q.customer?.lead_source||'Other';$('qNotes').value=q.notes||'';measures=Array.isArray(q.measurements)?q.measurements:[{id:1,area:'',w:0,h:0,qty:1}];nextMeasure=Math.max(0,...measures.map(x=>Number(x.id)||0))+1;renderMeasures();calculateQuote();saveQuoteDraftLocal();
  setTimeout(()=>{
    let target=$('quoteMeasurementsCard')||$('qSqft');
    target?.scrollIntoView({behavior:'smooth',block:'start'});
  },120);
  toast('Quote loaded — jumped to measurements.')}
function shortcutCategories(){return ['All',...new Set(shortcutData.map(s=>s.category||'Custom'))]}
function populateShortcutCategories(){
  let select=$('shortcutCategoryFilter');
  if(!select)return;
  let current=select.value||'All';
  select.innerHTML=shortcutCategories().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  select.value=shortcutCategories().includes(current)?current:'All';
}
function renderShortcuts(){
  populateShortcutCategories();
  let q=($('shortcutSearch')?.value||'').toLowerCase().trim(),category=$('shortcutCategoryFilter')?.value||'All';
  let filtered=shortcutData.filter(s=>(category==='All'||(s.category||'Custom')===category)&&(s.key.toLowerCase().includes(q)||(s.category||'').toLowerCase().includes(q)||s.text.toLowerCase().includes(q)));
  $('shortcutCountLabel').textContent=`${filtered.length} response${filtered.length===1?'':'s'}`;
  $('shortcutList').innerHTML=filtered.length?filtered.map(s=>{let i=shortcutData.indexOf(s);return `<div class="item shortcut-card"><div class="head"><div><h2>/${esc(s.key)}</h2><span class="pill">${esc(s.category||'Custom')}</span></div><div class="actions"><button class="btn primary" data-copyshortcut="${i}">Copy</button><button class="btn" data-editshortcut="${i}">Edit</button></div></div><div class="shortcut-message">${esc(s.text)}</div></div>`}).join(''):'<div class="card muted">No matching responses.</div>';
  $('shortcutList').querySelectorAll('[data-copyshortcut]').forEach(b=>b.onclick=()=>navigator.clipboard.writeText(shortcutData[Number(b.dataset.copyshortcut)].text).then(()=>toast('Response copied')));
  $('shortcutList').querySelectorAll('[data-editshortcut]').forEach(b=>b.onclick=()=>openShortcut(Number(b.dataset.editshortcut)));
}
function openShortcut(i=null){
  $('shortcutIndex').value=i===null?'':i;
  $('shortcutModalTitle').textContent=i===null?'Add Shortcut':'Edit Shortcut';
  $('shortcutKey').value=i===null?'':shortcutData[i].key;
  $('shortcutText').value=i===null?'':shortcutData[i].text;
  $('shortcutCategory').value=i===null?'Custom':(shortcutData[i].category||'Custom');
  $('shortcutModal').classList.add('show');
}
function saveShortcut(){
  let i=$('shortcutIndex').value,x={key:$('shortcutKey').value.trim().toLowerCase().replace(/^\/+/,''),category:$('shortcutCategory').value.trim()||'Custom',text:$('shortcutText').value.trim(),builtin:false};
  if(!x.key||!x.text)return toast('Keyword and message are required.');
  if(i==='')shortcutData.push(x);else shortcutData[Number(i)]={...shortcutData[Number(i)],...x};
  localStorage.setItem('dt.cloud.shortcuts',JSON.stringify(shortcutData));
  $('shortcutModal').classList.remove('show');
  renderShortcuts();
  toast('Shortcut saved');
}
function refreshBuiltInShortcuts(){
  if(!confirm('Refresh the built-in Dynamic Tintz responses? Your custom shortcuts will be preserved.'))return;
  let custom=shortcutData.filter(s=>!s.builtin&&!defaultShortcuts.some(d=>d.key===s.key));
  shortcutData=[...defaultShortcuts,...custom];
  localStorage.setItem('dt.cloud.shortcuts',JSON.stringify(shortcutData));
  localStorage.setItem('dt.cloud.shortcuts.version',SHORTCUT_LIBRARY_VERSION);
  renderShortcuts();
  toast('Built-in responses refreshed');
}


function setupEmployeeAdmin(){
  if(!owner()||$('employeeAdminCard'))return;
  let account=$('account');
  if(!account)return;
  let card=document.createElement('div');
  card.id='employeeAdminCard';
  card.className='card';
  card.innerHTML=`
    <div class="head">
      <div>
        <h2>Employee Access</h2>
        <div class="muted">Create accounts, assign roles, change temporary passwords, and disable access.</div>
      </div>
      <button class="btn primary" id="addEmployeeAccount">Add Employee</button>
    </div>
    <div id="employeeAdminMessage" class="muted" style="margin:12px 0"></div>
    <div id="employeeAdminList"><div class="muted">Open Account to load employees.</div></div>`;
  account.appendChild(card);
  $('addEmployeeAccount').onclick=()=>openEmployeeEditor();
}
async function callUserAdmin(action,payload={}){
  let{data,error}=await sb.functions.invoke('manage-users',{body:{action,...payload}});
  if(error)throw error;
  if(data?.error)throw new Error(data.error);
  return data;
}
async function loadEmployeeAdmin(){
  if(!owner()||!$('employeeAdminList'))return;
  $('employeeAdminMessage').textContent='Loading employee accounts…';
  try{
    let result=await callUserAdmin('list');
    let users=result.users||[];
    $('employeeAdminMessage').textContent=`${users.length} account${users.length===1?'':'s'}`;
    $('employeeAdminList').innerHTML=users.length?users.map(u=>`
      <div class="item">
        <div class="head">
          <div>
            <h2>${esc(u.full_name||u.email||'Employee')}</h2>
            <div class="muted">${esc(u.email||'')} ${u.username?`• @${esc(u.username)}`:''}</div>
          </div>
          <span class="pill">${u.active===false?'Disabled':esc(u.role||'installer')}</span>
        </div>
        <div class="actions">
          <button class="btn" data-useredit="${u.id}">Manage</button>
          <button class="btn" data-userpassword="${u.id}">Set Temporary Password</button>
          <button class="btn ${u.active===false?'primary':'danger'}" data-useractive="${u.id}" data-active="${u.active===false?'true':'false'}">${u.active===false?'Reactivate':'Disable'}</button>
        </div>
      </div>`).join(''):'<div class="muted">No employee accounts found.</div>';
    window._adminUsers=users;
    $('employeeAdminList').querySelectorAll('[data-useredit]').forEach(b=>b.onclick=()=>openEmployeeEditor(window._adminUsers.find(u=>u.id===b.dataset.useredit)));
    $('employeeAdminList').querySelectorAll('[data-userpassword]').forEach(b=>b.onclick=()=>setEmployeePassword(b.dataset.userpassword));
    $('employeeAdminList').querySelectorAll('[data-useractive]').forEach(b=>b.onclick=()=>setEmployeeActive(b.dataset.useractive,b.dataset.active==='true'));
  }catch(e){
    $('employeeAdminMessage').textContent=e.message||'Could not load employee accounts.';
  }
}
function ensureEmployeeModal(){
  if($('employeeAdminModal'))return;
  let modal=document.createElement('div');
  modal.id='employeeAdminModal';
  modal.className='modal';
  modal.innerHTML=`<div class="modal-card">
    <div class="head"><h2 id="employeeAdminModalTitle">Add Employee</h2><button class="btn" id="closeEmployeeAdminModal">Close</button></div>
    <input id="employeeAdminId" type="hidden">
    <label>Full Name<input id="employeeAdminName" autocomplete="off"></label>
    <label>Email<input id="employeeAdminEmail" type="email" autocomplete="off"></label>
    <label>Username<input id="employeeAdminUsername" autocomplete="off" placeholder="justin"></label>
    <label>Role<select id="employeeAdminRole"><option value="installer">Installer</option><option value="office">Office</option><option value="manager">Manager</option><option value="owner">Owner</option></select></label>
    <label id="employeePasswordLabel">Temporary Password<input id="employeeAdminPassword" type="password" autocomplete="new-password" placeholder="At least 8 characters"></label>
    <div class="actions"><button class="btn primary" id="saveEmployeeAdmin">Save Employee</button></div>
    <div id="employeeAdminModalMessage" class="muted" style="margin-top:10px"></div>
  </div>`;
  document.body.appendChild(modal);
  $('closeEmployeeAdminModal').onclick=()=>modal.classList.remove('show');
  $('saveEmployeeAdmin').onclick=saveEmployeeAdmin;
}
function openEmployeeEditor(user=null){
  ensureEmployeeModal();
  $('employeeAdminId').value=user?.id||'';
  $('employeeAdminName').value=user?.full_name||'';
  $('employeeAdminEmail').value=user?.email||'';
  $('employeeAdminUsername').value=user?.username||'';
  $('employeeAdminRole').value=user?.role||'installer';
  $('employeeAdminPassword').value='';
  $('employeeAdminEmail').disabled=!!user;
  $('employeePasswordLabel').style.display=user?'none':'block';
  $('employeeAdminModalTitle').textContent=user?'Manage Employee':'Add Employee';
  $('employeeAdminModalMessage').textContent='';
  $('employeeAdminModal').classList.add('show');
}
async function saveEmployeeAdmin(){
  let id=$('employeeAdminId').value,name=$('employeeAdminName').value.trim(),email=$('employeeAdminEmail').value.trim(),username=$('employeeAdminUsername').value.trim().toLowerCase(),role=$('employeeAdminRole').value,password=$('employeeAdminPassword').value;
  if(!name||!email||!username)return $('employeeAdminModalMessage').textContent='Name, email, and username are required.';
  if(!id&&password.length<8)return $('employeeAdminModalMessage').textContent='Temporary password must be at least 8 characters.';
  $('employeeAdminModalMessage').textContent='Saving…';
  try{
    if(id)await callUserAdmin('update_profile',{user_id:id,full_name:name,username,role});
    else await callUserAdmin('create',{full_name:name,email,username,role,password});
    $('employeeAdminModal').classList.remove('show');
    toast(id?'Employee updated.':'Employee account created.');
    await loadEmployeeAdmin();
  }catch(e){$('employeeAdminModalMessage').textContent=e.message}
}
async function setEmployeePassword(userId){
  let user=window._adminUsers?.find(u=>u.id===userId);
  let password=prompt(`Enter a new temporary password for ${user?.full_name||user?.email||'this employee'}.\n\nUse at least 8 characters.`);
  if(password===null)return;
  if(password.length<8)return toast('Password must be at least 8 characters.');
  try{await callUserAdmin('set_password',{user_id:userId,password});toast('Temporary password updated.')}catch(e){toast(e.message)}
}
async function setEmployeeActive(userId,active){
  let user=window._adminUsers?.find(u=>u.id===userId);
  if(!confirm(`${active?'Reactivate':'Disable'} access for ${user?.full_name||user?.email||'this employee'}?`))return;
  try{await callUserAdmin('set_active',{user_id:userId,active});toast(active?'Employee reactivated.':'Employee access disabled.');await loadEmployeeAdmin()}catch(e){toast(e.message)}
}


/* ============================================================
   Dynamic Tintz Roll Optimization Engine
   Strip-packing heuristic with multi-start pattern comparison.
   Objective order: linear footage, waste, cutter changes, workflow.
   ============================================================ */
let rollOptimizerResult=null;
let rollOptimizerQuoteId=null;

function optimizerEsc(value){return esc(String(value??''))}
function optimizerRound(value,digits=2){let p=10**digits;return Math.round((Number(value)||0)*p)/p}
function optimizerFeet(inches){return `${optimizerRound(inches/12,2)} ft`}
function optimizerInches(inches){return `${optimizerRound(inches,2)}"`}

function parseOptimizerInput(text){
  const lines=String(text||'').replace(/[×X]/g,'x').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const pieces=[];
  let pendingLabel='';
  let pendingDimension=null;

  const push=(label,w,h,qty=1)=>{
    w=Number(w);h=Number(h);qty=Math.max(1,Math.round(Number(qty)||1));
    if(w>0&&h>0)pieces.push({label:label||`Piece ${pieces.length+1}`,w,h,qty,rotatable:true});
  };

  for(let i=0;i<lines.length;i++){
    let line=lines[i];

    // Dynamic Tintz OS generated format:
    // "Windows bottom pane: 4 @ 34x39"
    let labeledQty=line.match(/^\s*(.*?)\s*:\s*(\d+)\s*@\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*$/i);
    if(labeledQty){
      push(labeledQty[1].trim(),labeledQty[3],labeledQty[4],labeledQty[2]);
      pendingDimension=null;
      continue;
    }

    // Quantity-first pasted format:
    // "4 @ 34x39 Bedroom"
    let direct=line.match(/^\s*(\d+)\s*(?:@|pcs?\s*@?|pieces?\s*@?)\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*(.*))?$/i);
    if(direct){
      push((direct[4]||pendingLabel).trim(),direct[2],direct[3],direct[1]);
      pendingDimension=null;
      continue;
    }

    let qtyTail=line.match(/^(.+?)\s+qty\s*[:=]?\s*(\d+)\s*$/i);
    if(qtyTail&&pendingDimension){
      push(pendingLabel,pendingDimension.w,pendingDimension.h,qtyTail[2]);
      pendingDimension=null;
      continue;
    }

    let dimension=line.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s|$)/i);
    if(dimension){
      let before=line.slice(0,dimension.index).replace(/[-:]+$/,'').trim();

      // Recognize a quantity immediately before @ even when a room label precedes it:
      // "Bedroom: 4 @ 34x39"
      let embeddedQty=before.match(/^(.*?)\s*:?\s*(\d+)\s*@\s*$/i);
      let qtyBefore=line.match(/^\s*(\d+)\s*(?:@|pcs?|pieces?)\s*/i);
      let qtyAfter=line.match(/(?:qty|quantity)\s*[:=]?\s*(\d+)/i);

      let qty=embeddedQty?.[2]||qtyBefore?.[1]||qtyAfter?.[1]||1;
      let label=embeddedQty
        ? embeddedQty[1].replace(/:$/,'').trim()
        : before.replace(/^\d+\s*(?:@|pcs?|pieces?)\s*/i,'').trim()||pendingLabel;

      let next=lines[i+1]||'';
      let nextQty=next.match(/^qty\s*[:=]?\s*(\d+)$/i);
      if(nextQty){qty=nextQty[1];i++}

      push(label,dimension[1],dimension[2],qty);
      pendingDimension=null;
      continue;
    }

    let qtyOnly=line.match(/^qty\s*[:=]?\s*(\d+)$/i);
    if(qtyOnly&&pendingDimension){
      push(pendingLabel,pendingDimension.w,pendingDimension.h,qtyOnly[1]);
      pendingDimension=null;
      continue;
    }

    pendingLabel=line.replace(/:$/,'').trim();
  }

  return pieces;
}

function quoteOptimizerPieces(quote){
  const raw=Array.isArray(quote?.measurements)?quote.measurements:[];
  return raw.filter(x=>Number(x.w)>0&&Number(x.h)>0&&Number(x.qty||1)>0).map((x,i)=>({
    label:x.area||`Window ${i+1}`,w:Number(x.w),h:Number(x.h),qty:Number(x.qty)||1,rotatable:x.rotatable!==false
  }));
}
function optimizerPiecesToText(pieces){
  return pieces.map(p=>`${p.label?`${p.label}: `:''}${p.qty} @ ${optimizerRound(p.w,3)}x${optimizerRound(p.h,3)}`).join('\n');
}
async function loadRollOptimizer(){
  let select=$('optimizerQuote');
  if(!select)return;
  let quotes=window._cloudQuotes||[];
  if(!quotes.length){
    let{data,error}=await sb.from('quotes').select('id,project_name,service_address,measurements,square_catalog_item_name,customer:customers(first_name,last_name)').order('created_at',{ascending:false});
    if(!error)quotes=data||[];
  }
  window._optimizerQuotes=quotes;
  let current=select.value;
  select.innerHTML='<option value="">Manual / pasted measurements</option>'+quotes.map(q=>`<option value="${q.id}">${optimizerEsc(`${q.customer?.first_name||''} ${q.customer?.last_name||''}`.trim()||q.project_name||'Quote')} — ${optimizerEsc(q.project_name||'Project')}</option>`).join('');
  if(current&&quotes.some(q=>q.id===current))select.value=current;
}
function openQuoteInOptimizer(id){
  rollOptimizerQuoteId=id;
  show('optimizer');
  setTimeout(()=>{if($('optimizerQuote')){$('optimizerQuote').value=id;loadSelectedOptimizerQuote()}},0);
}
function loadSelectedOptimizerQuote(){
  let id=$('optimizerQuote')?.value||'';
  let q=(window._optimizerQuotes||window._cloudQuotes||[]).find(x=>x.id===id);
  if(!q){rollOptimizerQuoteId=null;return toast('Select a saved quote first.')}
  let pieces=quoteOptimizerPieces(q);
  if(!pieces.length)return toast('This quote has no usable window dimensions.');
  rollOptimizerQuoteId=id;
  $('optimizerInput').value=optimizerPiecesToText(pieces);
  $('optimizerMessage').textContent=`Loaded ${pieces.reduce((s,p)=>s+p.qty,0)} pieces from ${q.project_name||'saved quote'}.`;
  applyInventoryToOptimizer(q);
}


function scrapFitsPiece(scrap,piece,allowRotation=true){
  let sw=Number(scrap.width_inches),sh=Number(scrap.height_inches),pw=Number(piece.w),ph=Number(piece.h);
  let normal=sw>=pw&&sh>=ph,rotated=allowRotation&&sw>=ph&&sh>=pw;
  if(!normal&&!rotated)return null;
  return {rotated:!normal&&rotated,wasteArea:sw*sh-pw*ph};
}

function rebuildGroupsAfterScrap(groups,matches){
  let used={};
  matches.forEach(m=>used[m.group]=(used[m.group]||0)+1);
  return groups.map((g,i)=>({...g,qty:Math.max(0,Number(g.qty||1)-(used[i]||0))})).filter(g=>g.qty>0);
}

async function optimizerScrapFirst(groups,quote,settings){
  if(!quote||$('optimizerUseScrap')?.checked===false)return {groups,matches:[],diagnostics:null};
  let filmName=String(quote.square_catalog_item_name||'').trim();
  if(!filmName)return {groups,matches:[],diagnostics:{reason:'Quote has no film type selected.'}};

  let{data:product,error:productError}=await sb.from('film_inventory_products').select('id,name').eq('name',filmName).maybeSingle();
  if(productError||!product)return {groups,matches:[],diagnostics:{reason:'No matching inventory film record.',filmName}};

  let{data:scraps,error}=await sb.from('film_scrap_inventory')
    .select('id,product_id,width_inches,height_inches,square_feet,status,reserved_quote_id,product:film_inventory_products(name)')
    .eq('product_id',product.id)
    .in('status',['available','reserved'])
    .order('square_feet',{ascending:true});
  if(error)return {groups,matches:[],diagnostics:{reason:error.message}};

  // A scrap already reserved to THIS quote is still eligible when the optimizer is rerun.
  // Scraps reserved to another quote are excluded.
  let eligible=(scraps||[]).filter(s=>s.status==='available'||(s.status==='reserved'&&s.reserved_quote_id===quote.id));

  let instances=expandOptimizerPieces(groups);

  // Most constrained / largest windows first. This prevents a small window from
  // consuming a large cutoff that is the only possible fit for a larger window.
  instances.sort((a,b)=>{
    let aFits=eligible.filter(s=>scrapFitsPiece(s,a,settings.allowRotation)).length;
    let bFits=eligible.filter(s=>scrapFitsPiece(s,b,settings.allowRotation)).length;
    return aFits-bFits || (b.w*b.h)-(a.w*a.h) || Math.max(b.w,b.h)-Math.max(a.w,a.h);
  });

  let available=[...eligible],matches=[];
  for(let piece of instances){
    let candidates=available
      .map(scrap=>({scrap,fit:scrapFitsPiece(scrap,piece,settings.allowRotation)}))
      .filter(x=>x.fit)
      .sort((a,b)=>
        a.fit.wasteArea-b.fit.wasteArea ||
        Math.abs(Number(a.scrap.width_inches)-Number(piece.w))-Math.abs(Number(b.scrap.width_inches)-Number(piece.w)) ||
        Math.abs(Number(a.scrap.height_inches)-Number(piece.h))-Math.abs(Number(b.scrap.height_inches)-Number(piece.h)) ||
        String(a.scrap.id).localeCompare(String(b.scrap.id))
      );
    if(!candidates.length)continue;

    let best=candidates[0];
    matches.push({
      scrap_id:best.scrap.id,
      scrap_width:Number(best.scrap.width_inches),
      scrap_height:Number(best.scrap.height_inches),
      scrap_sqft:Number(best.scrap.square_feet),
      scrap_status:best.scrap.status,
      piece_id:piece.id,
      group:piece.group,
      label:piece.label,
      piece_width:piece.w,
      piece_height:piece.h,
      piece_sqft:piece.w*piece.h/144,
      rotated:best.fit.rotated,
      leftover_scrap_sqft:Math.max(0,best.fit.wasteArea/144),
      film_name:filmName
    });
    available=available.filter(s=>s.id!==best.scrap.id);
  }

  return {
    groups:rebuildGroupsAfterScrap(groups,matches),
    matches,
    diagnostics:{
      filmName,
      totalPieces:instances.length,
      scrapRecordsFound:(scraps||[]).length,
      eligibleScraps:eligible.length,
      matched:matches.length,
      unmatched:Math.max(0,instances.length-matches.length),
      excludedReserved:(scraps||[]).filter(s=>s.status==='reserved'&&s.reserved_quote_id!==quote.id).length
    }
  };
}

function emptyOptimizerResult(groups,settings){
  return {patterns:[],linear:0,totalArea:0,wasteArea:0,distinct:0,changes:0,groups,settings,instances:[],trials:0,remaining:settings.rollLength,efficiency:100,wastePct:0};
}

function expandOptimizerPieces(groups){
  let out=[],n=1;
  groups.forEach((g,gi)=>{for(let i=0;i<g.qty;i++)out.push({id:`p${n++}`,group:gi,label:g.label||`Piece ${gi+1}`,w:Number(g.w),h:Number(g.h),rotatable:g.rotatable!==false})});
  return out;
}
function orientationsFor(piece,rollWidth,allowRotation,kerf){
  let options=[];
  const add=(across,length,rotated)=>{
    if(across+kerf<=rollWidth+1e-7&&!options.some(o=>Math.abs(o.across-across)<1e-7&&Math.abs(o.length-length)<1e-7))
      options.push({piece,across,length,rotated});
  };
  add(piece.w,piece.h,false);
  if(allowRotation&&piece.rotatable)add(piece.h,piece.w,true);
  return options;
}
function patternSignature(lanes){
  return lanes.map(x=>optimizerRound(x.across,3)).sort((a,b)=>b-a).join('|');
}
function normalizePattern(lanes,rollWidth,kerf){
  lanes=[...lanes].sort((a,b)=>b.across-a.across||b.length-a.length);
  let used=lanes.reduce((s,x)=>s+x.across+kerf,0),pull=Math.max(...lanes.map(x=>x.length)),area=lanes.reduce((s,x)=>s+x.piece.w*x.piece.h,0);
  return {lanes,pull,usedWidth:used,stripWaste:Math.max(0,rollWidth-used),wasteArea:rollWidth*pull-area,signature:patternSignature(lanes)};
}
function candidatePatterns(anchor,remaining,settings,rng,strategy){
  const {rollWidth,maxLanes,allowRotation,kerf}=settings;
  let patterns=[];
  let anchorOptions=orientationsFor(anchor,rollWidth,allowRotation,kerf);
  const pool=remaining.filter(x=>x.id!==anchor.id);
  for(const a of anchorOptions){
    patterns.push(normalizePattern([a],rollWidth,kerf));
    if(maxLanes<2)continue;
    let ranked=pool.map(p=>({p,opts:orientationsFor(p,rollWidth,allowRotation,kerf)})).filter(x=>x.opts.length);
    ranked.sort((x,y)=>{
      const ax=x.p.w*x.p.h,ay=y.p.w*y.p.h;
      if(strategy==='width')return Math.max(y.p.w,y.p.h)-Math.max(x.p.w,x.p.h);
      if(strategy==='length')return Math.max(y.p.w,y.p.h)-Math.max(x.p.w,x.p.h);
      if(strategy==='random')return rng()-.5;
      return ay-ax;
    });
    ranked=ranked.slice(0,Math.min(18,ranked.length));
    for(let i=0;i<ranked.length;i++)for(const b of ranked[i].opts){
      if(a.across+b.across+2*kerf>rollWidth+1e-7)continue;
      patterns.push(normalizePattern([a,b],rollWidth,kerf));
      if(maxLanes<3)continue;
      for(let j=i+1;j<ranked.length;j++)for(const c of ranked[j].opts){
        if(new Set([a.piece.id,b.piece.id,c.piece.id]).size<3)continue;
        if(a.across+b.across+c.across+3*kerf>rollWidth+1e-7)continue;
        patterns.push(normalizePattern([a,b,c],rollWidth,kerf));
      }
    }
  }
  const unique=new Map();
  patterns.forEach(p=>{
    let key=p.lanes.map(x=>`${x.piece.id}:${x.across}:${x.length}`).sort().join(',');
    if(!unique.has(key)||unique.get(key).wasteArea>p.wasteArea)unique.set(key,p);
  });
  return [...unique.values()];
}
function seededRandom(seed){
  let x=(seed||123456789)>>>0;
  return ()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296}
}
function buildOptimizerPlan(instances,settings,trial){
  let rng=seededRandom(911+trial*7919),remaining=[...instances],patterns=[],lastSig='';
  const strategies=['area','width','length','random'];
  let strategy=strategies[trial%strategies.length];
  while(remaining.length){
    remaining.sort((a,b)=>{
      if(strategy==='random')return rng()-.5;
      if(strategy==='width')return Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h;
      if(strategy==='length')return Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h;
      return b.w*b.h-a.w*a.h||Math.max(b.w,b.h)-Math.max(a.w,a.h);
    });
    let anchor=remaining[0];
    let candidates=candidatePatterns(anchor,remaining,settings,rng,strategy);
    let best=null,bestScore=Infinity;
    for(const p of candidates){
      let setupPenalty=p.signature===lastSig?0:settings.setupWeight;
      let laneBonus=(p.lanes.length-1)*settings.laneReward;
      let score=p.pull*100000+p.wasteArea*10+setupPenalty-laneBonus+rng()*settings.randomness;
      // Reward similar-length lanes because they minimize lane-end scrap.
      let minLen=Math.min(...p.lanes.map(x=>x.length));
      score+=(p.pull-minLen)*p.lanes.length*20;
      if(score<bestScore){bestScore=score;best=p}
    }
    patterns.push(best);
    let used=new Set(best.lanes.map(x=>x.piece.id));
    remaining=remaining.filter(x=>!used.has(x.id));
    lastSig=best.signature;
  }
  // Group identical cutter setups to minimize adjustments.
  let grouped=new Map();
  patterns.forEach(p=>{if(!grouped.has(p.signature))grouped.set(p.signature,[]);grouped.get(p.signature).push(p)});
  let ordered=[...grouped.entries()].sort((a,b)=>{
    let la=a[1].reduce((s,p)=>s+p.pull,0),lb=b[1].reduce((s,p)=>s+p.pull,0);
    return lb-la;
  }).flatMap(x=>x[1]);
  let linear=ordered.reduce((s,p)=>s+p.pull,0);
  let totalArea=instances.reduce((s,p)=>s+p.w*p.h,0);
  let wasteArea=settings.rollWidth*linear-totalArea;
  let changes=0;for(let i=1;i<ordered.length;i++)if(ordered[i].signature!==ordered[i-1].signature)changes++;
  let distinct=new Set(ordered.map(p=>p.signature)).size;
  return {patterns:ordered,linear,totalArea,wasteArea,changes,distinct};
}
function compareOptimizerPlans(a,b){
  const eps=.001;
  if(Math.abs(a.linear-b.linear)>eps)return a.linear-b.linear;
  if(Math.abs(a.wasteArea-b.wasteArea)>eps)return a.wasteArea-b.wasteArea;
  if(a.changes!==b.changes)return a.changes-b.changes;
  if(a.distinct!==b.distinct)return a.distinct-b.distinct;
  return a.patterns.length-b.patterns.length;
}
function optimizeFilmRoll(groups,settings){
  const instances=expandOptimizerPieces(groups);
  for(const p of instances){
    if(!orientationsFor(p,settings.rollWidth,settings.allowRotation,settings.kerf).length)
      throw new Error(`${p.label} (${p.w}" × ${p.h}") cannot fit across a ${settings.rollWidth}" roll in any allowed orientation.`);
  }
  let trials=settings.depth==='deep'?240:settings.depth==='fast'?35:110;
  let best=null;
  for(let t=0;t<trials;t++){
    let plan=buildOptimizerPlan(instances,{...settings,setupWeight:t%5===0?5000:1200,laneReward:t%3===0?900:350,randomness:t<4?0:450},t);
    if(!best||compareOptimizerPlans(plan,best)<0)best=plan;
  }
  best.groups=groups;best.settings=settings;best.instances=instances;best.trials=trials;
  best.remaining=settings.rollLength-best.linear;
  best.efficiency=best.linear?best.totalArea/(settings.rollWidth*best.linear)*100:0;
  best.wastePct=100-best.efficiency;
  return best;
}
function optimizerSetupText(pattern,rollWidth,kerf=0){
  let widths=pattern.lanes.map(x=>optimizerRound(x.across,3));
  let positions=[],sum=0;
  widths.slice(0,-1).forEach(w=>{sum+=w;positions.push(optimizerRound(sum,3));sum+=kerf});
  let remainder=Math.max(0,rollWidth-widths.reduce((s,w)=>s+w,0)-kerf*widths.length);
  return {widths,positions,remainder};
}
function consolidateOptimizerPulls(patterns){
  let out=[];
  patterns.forEach((p,i)=>{
    let setup=optimizerSetupText(p,p._rollWidth||72,p._kerf||0),last=out[out.length-1];
    let pieceKey=p.lanes.map(x=>`${x.piece.label}|${x.across}|${x.length}|${x.rotated}`).sort().join(';;');
    if(last&&last.signature===p.signature&&last.pull===p.pull&&last.pieceKey===pieceKey){
      last.repeat++;
      last.patterns.push(p);
    }else out.push({signature:p.signature,pull:p.pull,pieceKey,repeat:1,patterns:[p],setup});
  });
  return out;
}
function renderOptimizerResult(result,title='Manual Job'){
  let scrapMatches=result.scrapMatches||[],scrapCovered=scrapMatches.reduce((s,m)=>s+Number(m.piece_sqft||0),0),originalGlass=Number(result.originalTotalArea||result.totalArea)/144;
  let scrapHtml=scrapMatches.length?`<div class="card optimizer-scrap-match-card">
    <div class="head" style="margin-top:0"><div><h3>♻ SCRAP FIRST — ${scrapMatches.length} Match${scrapMatches.length===1?'':'es'} Found</h3><div class="muted">These windows do not need fresh roll film.</div></div><span class="pill">${optimizerRound(scrapCovered,2)} sq ft glass covered</span></div>
    ${scrapMatches.map(m=>`<div class="optimizer-scrap-match"><div><b>${optimizerEsc(m.label)}</b><div class="muted">Window ${optimizerInches(m.piece_width)} × ${optimizerInches(m.piece_height)}</div></div><div><b>USE SCRAP ${optimizerInches(m.scrap_width)} × ${optimizerInches(m.scrap_height)}</b><div class="muted">${optimizerEsc(m.film_name)}${m.rotated?' • rotate scrap':''}</div></div><span class="pill">SAVE ROLL CUT</span></div>`).join('')}
    <div class="optimizer-command"><b>Installer command:</b> Pull these scrap pieces before cutting the roll. Saving this optimization reserves them so another job does not claim the same cutoff.</div>
  </div>`:'';
  let {settings}=result;
  result.patterns.forEach(p=>{p._rollWidth=settings.rollWidth;p._kerf=settings.kerf});
  let pulls=consolidateOptimizerPulls(result.patterns);
  let setupGroups=[],last=null;
  result.patterns.forEach((p,index)=>{
    if(!last||last.signature!==p.signature){
      last={signature:p.signature,start:index+1,end:index+1,setup:optimizerSetupText(p,settings.rollWidth,settings.kerf)};
      setupGroups.push(last);
    }else last.end=index+1;
  });
  let totalPieces=result.instances.length,remainingOk=result.remaining>=-1e-7;
  let pieceRows=result.groups.map(g=>`<tr><td>${optimizerEsc(g.label)}</td><td>${g.qty}</td><td>${optimizerInches(g.w)} × ${optimizerInches(g.h)}</td><td>${optimizerRound(g.w*g.h*g.qty/144,2)} sq ft</td></tr>`).join('');
  let pullHtml=pulls.map((g,gi)=>{
    let p=g.patterns[0],setup=optimizerSetupText(p,settings.rollWidth,settings.kerf);
    let lanes=p.lanes.map((x,li)=>{let endScrap=Math.max(0,p.pull-x.length);return `<li><b>Lane ${li+1}:</b> ${optimizerEsc(x.piece.label)} — cut ${optimizerInches(x.across)} across × ${optimizerInches(x.length)} pull length ${x.rotated?'<span class="pill warn">Rotated</span>':''}${endScrap>.01?` <small>• lane-end scrap ${optimizerInches(endScrap)}</small>`:''}</li>`}).join('');
    let strip=setup.remainder>0.01?`<div class="optimizer-scrap">Unused width on this pull: ${optimizerInches(setup.remainder)}</div>`:'';
    return `<div class="optimizer-pull">
      <div class="head"><h3>Pull ${gi+1}${g.repeat>1?` — Repeat ${g.repeat} times`:''}</h3><span class="pill">${optimizerInches(g.pull)}</span></div>
      <div><b>Cutter lanes:</b> ${setup.widths.map(optimizerInches).join(' | ')}</div>
      <div class="muted"><b>Head positions from left edge:</b> ${setup.positions.length?setup.positions.map(optimizerInches).join(' | '):'No internal head needed'}</div>
      <ol>${lanes}</ol>${strip}
      <div class="optimizer-command"><b>Installer command:</b> Pull ${optimizerInches(g.pull)}, cross-cut, ${g.repeat>1?`repeat ${g.repeat} total pulls`:'continue to next instruction'}.</div>
    </div>`;
  }).join('');
  let setupHtml=setupGroups.map((s,i)=>`<div class="optimizer-setup">
    <b>Setup ${i+1}</b>
    <span>Lane widths: ${s.setup.widths.map(optimizerInches).join(' | ')}</span>
    <span>Head positions: ${s.setup.positions.length?s.setup.positions.map(optimizerInches).join(' | '):'No internal head needed'}</span>
    <small>Use for pulls ${s.start}${s.end!==s.start?`–${s.end}`:''}</small>
  </div>`).join('');
  $('optimizerResultTitle').textContent=title;
  $('optimizerOutput').innerHTML=`
    ${scrapHtml}
    <div class="grid3 optimizer-metrics">
      <div class="mini-stat"><b>${optimizerInches(settings.rollWidth)}</b><span>Roll Width</span></div>
      <div class="mini-stat"><b>${optimizerFeet(settings.rollLength)}</b><span>Available Length</span></div>
      <div class="mini-stat"><b>${optimizerRound(originalGlass,2)}</b><span>Total Job Glass</span></div>
      <div class="mini-stat"><b>${optimizerInches(result.linear)}</b><span>Linear Inches Required</span></div>
      <div class="mini-stat ${remainingOk?'':'optimizer-danger'}"><b>${remainingOk?optimizerFeet(result.remaining):'SHORT'}</b><span>Remaining Roll</span></div>
      <div class="mini-stat"><b>${optimizerRound(result.efficiency,1)}%</b><span>Material Efficiency</span></div>
    </div>
    ${remainingOk?'':`<div class="card optimizer-alert"><b>Insufficient inventory:</b> This plan requires ${optimizerFeet(result.linear-settings.rollLength)} more film than the entered roll length.</div>`}
    <div class="card"><div class="head" style="margin-top:0"><h3>Roll Summary</h3><span class="pill">${totalPieces} pieces</span></div>
      <div class="optimizer-summary-grid">
        <div><span>Total job glass</span><b>${optimizerRound(originalGlass,2)} sq ft</b></div>
        <div><span>Glass covered from scraps</span><b>${optimizerRound(scrapCovered,2)} sq ft</b></div>
        <div><span>Glass requiring fresh roll</span><b>${optimizerRound(result.totalArea/144,2)} sq ft</b></div>
        <div><span>Total roll material pulled</span><b>${optimizerRound(settings.rollWidth*result.linear/144,2)} sq ft</b></div>
        <div><span>Calculated job waste</span><b>${optimizerRound(result.wasteArea/144,2)} sq ft</b></div>
        <div><span>Linear footage pulled</span><b>${optimizerFeet(result.linear)}</b></div>
        <div><span>Waste percentage</span><b>${optimizerRound(result.wastePct,1)}%</b></div>
        <div><span>Efficiency percentage</span><b>${optimizerRound(result.efficiency,1)}%</b></div>
        <div><span>Cutter setups</span><b>${result.distinct}</b></div>
        <div><span>Head changes</span><b>${result.changes}</b></div>
      </div>
    </div>
    <div class="card"><div class="head" style="margin-top:0"><h3>Cutter Setup</h3><span class="pill">${settings.maxLanes} heads available</span></div>${setupHtml}
      <div class="muted" style="margin-top:10px">The plan minimizes linear footage first. Equal-footage layouts are ranked by waste, cutter changes, then workflow simplicity. ${result.trials} candidate layouts were compared.</div>
    </div>
    <div class="card"><h3>Pull Sequence & Piece Schedule</h3>${pullHtml}</div>
    <div class="card"><h3>Fresh Roll Piece Schedule</h3><div class="table-wrap"><table class="optimizer-table"><thead><tr><th>Area</th><th>Qty</th><th>Size</th><th>Area</th></tr></thead><tbody>${pieceRows}</tbody></table></div></div>
    <div class="card"><h3>Waste Report</h3>
      <div class="optimizer-summary-grid">
        <div><span>Total unused film area</span><b>${optimizerRound(result.wasteArea/144,2)} sq ft</b></div>
        <div><span>Width/length waste</span><b>${optimizerRound(result.wastePct,1)}%</b></div>
        <div><span>Usable roll remaining</span><b>${remainingOk?optimizerFeet(result.remaining):'None — inventory short'}</b></div>
        <div><span>Future use</span><b>${result.remaining>=12?'Retain remaining roll for future jobs':'Small remnants only'}</b></div>
      </div>
      <div class="optimizer-inventory-deduction"><b>Inventory deduction:</b> ${optimizerRound(settings.rollWidth*result.linear/144,2)} sq ft total will be reserved/deducted for this job. That total already includes ${optimizerRound(result.wasteArea/144,2)} sq ft of calculated cutting waste.</div>
      <p class="muted">Long continuous remainder stays on the roll and remains fully usable. Short lane-end scraps and narrow strips are counted as job waste unless you intentionally retain and track them as a separate usable remnant.</p>
    </div>
    <div class="card"><h3>Optimization Notes</h3>
      <p>Selected the lowest-linear-footage solution found across ${result.trials} internally compared layouts. Rotation was ${settings.allowRotation?'enabled':'disabled'}. The plan uses no more than ${settings.maxLanes} simultaneous lanes and prioritizes repeated setups where linear footage remains equal.</p>
    </div>`;
  $('optimizerResults').classList.remove('hidden');
}
async function runRollOptimizer(){
  let message=$('optimizerMessage');
  try{
    let groups=parseOptimizerInput($('optimizerInput').value);
    if(!groups.length)throw new Error('Enter or load at least one valid window dimension.');
    let settings={
      rollWidth:Number($('optimizerRollWidth').value)||72,
      rollLength:(Number($('optimizerRollLength').value)||0)*12,
      maxLanes:Math.max(1,Math.round(Number($('optimizerHeads').value)||3)),
      kerf:Math.max(0,Number($('optimizerKerf').value)||0),
      allowRotation:$('optimizerRotation').value==='yes',
      depth:$('optimizerDepth').value
    };
    if(settings.rollWidth<=0)throw new Error('Roll width must be greater than zero.');
    let q=(window._optimizerQuotes||window._cloudQuotes||[]).find(x=>x.id===rollOptimizerQuoteId);
    message.textContent='Checking scrap inventory before cutting fresh roll…';
    let scrapPlan=await optimizerScrapFirst(groups,q,settings);
    let sd=scrapPlan.diagnostics;
    message.textContent=scrapPlan.matches.length
      ?`${scrapPlan.matches.length} scrap match${scrapPlan.matches.length===1?'':'es'} found from ${sd?.eligibleScraps??'?'} eligible cutoff${(sd?.eligibleScraps??0)===1?'':'s'}. Optimizing remaining fresh-roll cuts…`
      :`No usable scrap matches${sd?` (${sd.eligibleScraps} eligible scraps checked for ${sd.totalPieces} pieces)`:''}. Comparing fresh-roll cutting layouts…`;
    await new Promise(r=>setTimeout(r,30));

    let originalTotalArea=groups.reduce((s,g)=>s+Number(g.w)*Number(g.h)*Number(g.qty||1),0);
    let result=scrapPlan.groups.length?optimizeFilmRoll(scrapPlan.groups,settings):emptyOptimizerResult([],settings);
    result.scrapMatches=scrapPlan.matches;
    result.originalGroups=groups;
    result.originalTotalArea=originalTotalArea;
    result.scrapCoveredArea=scrapPlan.matches.reduce((s,m)=>s+Number(m.piece_width)*Number(m.piece_height),0);
    rollOptimizerResult=result;
    renderOptimizerResult(result,q?.project_name||`${q?.customer?.first_name||''} ${q?.customer?.last_name||''}`.trim()||'Manual Job');
    message.textContent=scrapPlan.matches.length?`Optimization complete. ${scrapPlan.matches.length} window${scrapPlan.matches.length===1?'':'s'} assigned to scrap before fresh-roll cutting.`:`Optimization complete. ${result.trials} layouts compared.`;
    $('optimizerResults').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){message.textContent=e.message}
}

async function saveRollOptimizerPlan(){
  if(!rollOptimizerResult)return toast('Run the optimizer first.');
  let payload={
    quote_id:rollOptimizerQuoteId||null,
    roll_width:rollOptimizerResult.settings.rollWidth,
    roll_length_available:rollOptimizerResult.settings.rollLength,
    linear_inches_required:rollOptimizerResult.linear,
    efficiency_percentage:rollOptimizerResult.efficiency,
    waste_percentage:rollOptimizerResult.wastePct,
    input_data:rollOptimizerResult.groups,
    result_data:rollOptimizerResult,
    created_by:session?.user?.id||null
  };
  let{error}=await sb.from('roll_optimization_plans').insert(payload);
  if(error){
    if(String(error.message).includes('roll_optimization_plans'))return toast('Run ROLL-OPTIMIZER-MIGRATION.sql before saving plans.');
    return toast(error.message);
  }
  let matches=rollOptimizerResult.scrapMatches||[];
  if(matches.length&&rollOptimizerQuoteId){
    let ids=[...new Set(matches.map(m=>m.scrap_id))];
    let{error:scrapError}=await sb.from('film_scrap_inventory').update({
      status:'reserved',reserved_quote_id:rollOptimizerQuoteId,reserved_at:new Date().toISOString()
    }).in('id',ids);
    if(scrapError)return toast('Plan saved, but scrap reservation failed: '+scrapError.message);
  }
  toast(matches.length?`Optimization saved and ${matches.length} scrap piece${matches.length===1?'':'s'} reserved.`:'Optimization plan saved to cloud.');
}
function printRollOptimizer(){
  if(!rollOptimizerResult)return toast('Run the optimizer first.');
  window.print();
}
function clearRollOptimizer(){
  $('optimizerInput').value='';$('optimizerQuote').value='';$('optimizerMessage').textContent='';$('optimizerResults').classList.add('hidden');$('optimizerOutput').innerHTML='';rollOptimizerResult=null;rollOptimizerQuoteId=null;
}

function bindOwnerCommandCenter(){
  const wire=(metricId,action)=>{
    const metric=$(metricId),card=metric?.closest('.card.metric');
    if(!card||card.dataset.commandCenterBound==='true')return;
    card.dataset.commandCenterBound='true';
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    card.onclick=action;
    card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action()}};
  };
  wire('newLeads',()=>{let filter=$('leadStatusFilter');if(filter)filter.value='new';show('leads')});
  wire('dueLeads',()=>show('followups'));
  wire('clocked',()=>show('team'));
  wire('pendingQuotes',()=>{let filter=$('quoteStatusFilter');if(filter)filter.value='';show('quotes')});
  wire('scheduledJobs',()=>{let status=$('operationStatus'),range=$('operationRange');if(status)status.value='';if(range)range.value='all';show('operations')});
  wire('completedMonth',()=>{let status=$('operationStatus'),range=$('operationRange');if(status)status.value='';if(range)range.value='30';show('operations');setTimeout(()=>{if($('operationView')){$('operationView').value='archive';renderOperations()}},0)});
}

function bind(id,event,handler){let el=$(id);if(el)el[event]=handler}


function icloudViewCalendarKey(){return `dt.icloudViewCalendars.${session?.user?.id||'guest'}`}
function getIcloudViewCalendarIds(){
  try{let v=JSON.parse(localStorage.getItem(icloudViewCalendarKey())||'[]');return Array.isArray(v)?v:[]}catch{return []}
}
function setIcloudViewCalendarIds(ids){
  localStorage.setItem(icloudViewCalendarKey(),JSON.stringify([...new Set(ids||[])]));
}
function icloudSyncCalendarKey(){return `dt.icloud.syncCalendars.${session?.user?.id||'guest'}`}
function getIcloudSyncCalendarIds(){
  try{
    let raw=localStorage.getItem(icloudSyncCalendarKey());
    if(raw===null)return null;
    let v=JSON.parse(raw);
    return Array.isArray(v)?v:[];
  }catch{return []}
}
function setIcloudSyncCalendarIds(ids){
  localStorage.setItem(icloudSyncCalendarKey(),JSON.stringify([...new Set(ids||[])]));
}
async function loadIcloudCalendarStatus(){
  let st=$('icloudCalendarStatus'),m=$('icloudCalendarMessage'),wrap=$('icloudCalendarPickerWrap'),test=$('testIcloudCalendar');
  if(!st)return;
  let{data,error}=await sb.functions.invoke('icloud-calendar-auth',{body:{action:'status'}});
  if(error||data?.ok===false){st.textContent='Needs setup';m.textContent=error?.message||data?.error||'Add the iCloud secrets and deploy the iCloud functions.';wrap?.classList.add('hidden');if(test)test.disabled=true;return}
  if(!data.configured){st.textContent='Not configured';m.textContent='Add ICLOUD_APPLE_ID and ICLOUD_APP_SPECIFIC_PASSWORD in Supabase Edge Function secrets.';wrap?.classList.add('hidden');if(test)test.disabled=true;return}
  let remoteSyncSelected=data.selected_calendars||[],
      localSyncIds=getIcloudSyncCalendarIds(),
      syncSelected=localSyncIds===null?remoteSyncSelected:remoteSyncSelected.filter(c=>localSyncIds.includes(c.id)),
      viewIds=getIcloudViewCalendarIds();
  st.textContent=`${viewIds.length} View • ${localSyncIds===null?syncSelected.length:localSyncIds.length} Sync`;
  m.textContent='VIEW calendars appear read-only on the Operations schedule. SYNC JOBS calendars are the only calendars Dynamic Tintz may create, update, or remove job events on.';
  wrap?.classList.remove('hidden');if(test)test.disabled=(localSyncIds===null?!syncSelected.length:!localSyncIds.length);
  await loadIcloudCalendarChoices(syncSelected);
}
async function loadIcloudCalendarChoices(syncSelected=[]){
  let picker=$('icloudCalendarPicker'),m=$('icloudCalendarMessage');if(!picker)return;
  picker.innerHTML='<div class="muted">Loading iCloud calendars…</div>';
  let{data,error}=await sb.functions.invoke('icloud-calendar-auth',{body:{action:'calendars'}});
  if(error||data?.ok===false){picker.innerHTML='';m.textContent=error?.message||data?.error||'Could not load iCloud calendars.';return}
  let syncIds=new Set((syncSelected.length?syncSelected:data.selected_calendars||[]).map(c=>c.id)),
      viewIds=new Set(getIcloudViewCalendarIds());
  picker.innerHTML=(data.calendars||[]).map(c=>`<div class="icloud-calendar-row">
    <div class="icloud-calendar-name">
      <b>${esc(c.name)}</b>
      <small>${c.writable?'Writable calendar':'Read-only calendar'}</small>
    </div>
    <label class="calendar-permission-toggle">
      <input type="checkbox" data-icloudview value="${esc(c.id)}" ${viewIds.has(c.id)?'checked':''}>
      <span><b>VIEW</b><small>Show events in Operations</small></span>
    </label>
    <label class="calendar-permission-toggle ${c.writable?'':'calendar-readonly'}">
      <input type="checkbox" data-icloudsync value="${esc(c.id)}" ${syncIds.has(c.id)?'checked':''} ${c.writable?'':'disabled'}>
      <span><b>SYNC JOBS</b><small>${c.writable?'Allow Dynamic Tintz job writes':'Not writable'}</small></span>
    </label>
  </div>`).join('')||'<div class="muted">No iCloud calendars were found.</div>';
}
async function saveIcloudCalendarSelection(){
  let picker=$('icloudCalendarPicker'),b=$('saveIcloudCalendarSelection'),m=$('icloudCalendarMessage');
  let viewIds=[...picker.querySelectorAll('[data-icloudview]:checked')].map(x=>x.value),
      syncIds=[...picker.querySelectorAll('[data-icloudsync]:checked')].map(x=>x.value);
  setIcloudViewCalendarIds(viewIds);
  setIcloudSyncCalendarIds(syncIds);
  b.disabled=true;m.textContent='Saving iCloud calendar permissions…';
  if(syncIds.length){
    let{data,error}=await sb.functions.invoke('icloud-calendar-auth',{body:{action:'select',calendar_ids:syncIds}});
    if(error||data?.ok===false){b.disabled=false;m.textContent=error?.message||data?.error||'View calendars were saved locally, but Sync Jobs selection could not be saved.';return}
  }else{
    // Explicit local zero means VIEW ONLY. Do not allow stale remote selections
    // to cause job writes from this PWA.
    m.textContent='View calendars saved. iCloud job syncing is OFF for this device.';
  }
  b.disabled=false;
  toast(`${viewIds.length} view-only calendar${viewIds.length===1?'':'s'} • ${syncIds.length} job-sync calendar${syncIds.length===1?'':'s'}.`);
  await loadIcloudCalendarStatus();
  if($('operations')?.classList.contains('active'))await loadOperations();
}
async function testIcloudCalendarConnection(){
  let b=$('testIcloudCalendar'),m=$('icloudCalendarMessage'),st=$('icloudCalendarStatus');
  let localSyncIds=getIcloudSyncCalendarIds();
  if(localSyncIds!==null&&!localSyncIds.length){m.textContent='iCloud is configured as VIEW ONLY. No calendars are allowed to receive Dynamic Tintz jobs.';return}
  b.disabled=true;m.textContent='Testing calendars allowed to receive Dynamic Tintz jobs…';
  let{data,error}=await sb.functions.invoke('icloud-calendar-sync',{body:{test:true}});b.disabled=false;
  if(error||data?.ok===false){
    st.textContent='Needs attention';
    m.textContent=error?await functionErrorDetail(error,'iCloud job-sync calendar test failed.'):data?.error||'iCloud job-sync calendar test failed.';
    return
  }
  let viewCount=getIcloudViewCalendarIds().length;
  st.textContent=`${viewCount} View • ${data.calendars.length} Sync`;
  m.textContent=`Job sync connected to ${data.calendars.join(', ')}. View-only calendars remain read-only.`;
}

async function loadCalendarStatus(){let st=$('calendarStatus'),m=$('calendarMessage'),connect=$('connectCalendar'),disconnect=$('disconnectCalendar'),test=$('testCalendar'),wrap=$('calendarPickerWrap'),refresh=$('refreshCalendars');if(!st)return;let{data,error}=await sb.functions.invoke('google-calendar-auth',{body:{action:'status'}});if(error||data?.ok===false){st.textContent='Needs setup';m.textContent=error?.message||data?.error||'Could not read calendar connection status.';connect?.classList.remove('hidden');disconnect?.classList.add('hidden');refresh?.classList.add('hidden');wrap?.classList.add('hidden');test.disabled=true;return}if(data.connected){let selected=data.selected_calendars||[];st.textContent=selected.length?`${selected.length} Selected`:'Connected';m.textContent=`${data.email||'Google account connected'}${selected.length?' • '+selected.map(c=>c.name).join(', '):' • Choose calendars below'}`;connect?.classList.add('hidden');disconnect?.classList.remove('hidden');refresh?.classList.remove('hidden');wrap?.classList.remove('hidden');test.disabled=!selected.length;await loadCalendarChoices(selected)}else{st.textContent='Not connected';m.textContent='Connect dynamictintzllc@gmail.com to choose which calendars receive scheduled jobs.';connect?.classList.remove('hidden');disconnect?.classList.add('hidden');refresh?.classList.add('hidden');wrap?.classList.add('hidden');test.disabled=true}}
async function loadCalendarChoices(selected=[]){let picker=$('calendarPicker'),m=$('calendarMessage');if(!picker)return;picker.innerHTML='<div class="muted">Loading calendars…</div>';let{data,error}=await sb.functions.invoke('google-calendar-auth',{body:{action:'calendars'}});if(error||data?.ok===false){picker.innerHTML='';m.textContent=error?.message||data?.error||'Could not load calendars.';return}let selectedIds=new Set((selected.length?selected:data.selected_calendars||[]).map(c=>c.id));picker.innerHTML=(data.calendars||[]).map(c=>`<label class="installer-option ${c.writable?'':'calendar-readonly'}"><input type="checkbox" value="${esc(c.id)}" ${selectedIds.has(c.id)?'checked':''} ${c.writable?'':'disabled'}><span>${esc(c.name)}${c.primary?' <b>Primary</b>':''}<small>${c.writable?'Can sync jobs':`Read only • ${esc(c.access_role)}`}</small></span></label>`).join('')||'<div class="muted">No Google calendars were found.</div>'}
async function saveCalendarSelection(){let ids=[...$('calendarPicker').querySelectorAll('input:checked')].map(x=>x.value),b=$('saveCalendarSelection'),m=$('calendarMessage');if(!ids.length){m.textContent='Choose at least one calendar you can edit.';return}b.disabled=true;m.textContent='Saving calendar selection…';let{data,error}=await sb.functions.invoke('google-calendar-auth',{body:{action:'select',calendar_ids:ids}});b.disabled=false;if(error||data?.ok===false){m.textContent=error?.message||data?.error||'Could not save calendar selection.';return}toast(`${data.selected_calendars.length} calendar${data.selected_calendars.length===1?'':'s'} selected.`);await loadCalendarStatus()}
async function connectGoogleCalendar(){let b=$('connectCalendar'),m=$('calendarMessage');b.disabled=true;m.textContent='Opening Google sign-in…';let{data,error}=await sb.functions.invoke('google-calendar-auth',{body:{action:'start'}});b.disabled=false;if(error||data?.ok===false||!data?.auth_url){m.textContent=error?.message||data?.error||'Could not start Google connection.';return}let popup=window.open(data.auth_url,'dynamicTintzGoogleCalendar','width=620,height=760');if(!popup){location.href=data.auth_url;return}let checks=0,timer=setInterval(async()=>{checks++;if(popup.closed||checks>60){clearInterval(timer);await loadCalendarStatus()}},2000)}
async function disconnectGoogleCalendar(){if(!confirm('Disconnect Google Calendar? Existing calendar events will stay in Google, but future job changes will stop syncing.'))return;let{data,error}=await sb.functions.invoke('google-calendar-auth',{body:{action:'disconnect'}});if(error||data?.ok===false)return toast(error?.message||data?.error||'Could not disconnect calendar.');toast('Google Calendar disconnected.');await loadCalendarStatus()}
async function testCalendarConnection(){let b=$('testCalendar'),m=$('calendarMessage'),st=$('calendarStatus');b.disabled=true;m.textContent='Testing selected calendars…';let{data,error}=await sb.functions.invoke('google-calendar-sync',{body:{test:true}});b.disabled=false;if(error||data?.ok===false){st.textContent='Needs attention';m.textContent=error?.message||data?.error||'Calendar test failed.';return}st.textContent=`${data.calendars.length} Selected`;m.textContent=`Connected to ${data.calendars.join(', ')}.`}
if($('inventoryRollReceivedDate'))$('inventoryRollReceivedDate').value=new Date().toISOString().slice(0,10);if($('inventoryBackfillFrom'))$('inventoryBackfillFrom').value=new Date(new Date().setMonth(new Date().getMonth()-6)).toISOString().slice(0,10);bind('inventoryAddProduct','onclick',addInventoryProduct);bind('inventoryAddRoll','onclick',addInventoryRoll);bind('saveManualFilmPull','onclick',saveManualFilmPull);bind('scrapQuickAdd','onclick',addScrapFromQuickEntry);bind('scrapManualAdd','onclick',addScrapManual);bind('scrapRefresh','onclick',loadScrapInventory);bind('markSelectedScrapsUsed','onclick',markSelectedScrapsUsed);bind('clearSelectedScraps','onclick',clearScrapSelection);bind('mobileMenuBrand','onclick',openMoreMenu);bind('closeMoreMenu','onclick',closeMoreMenu);$('moreMenu')?.querySelector('.more-sheet-backdrop')?.addEventListener('click',closeMoreMenu);bind('inventoryRefresh','onclick',loadInventory);bind('inventoryQuickAddRoll','onclick',()=>openAddRollModal());bind('inventoryQuickAddFilm','onclick',openAddFilmTypeModal);bind('metricAddRoll','onclick',metricEditorAddRoll);bind('metricPullFilm','onclick',openPullFromMetricFilm);bind('metricAddFilmType','onclick',openAddFilmTypeModal);bind('saveInventoryMetricEditor','onclick',saveInventoryMetricEditor);bind('metricEditorAddRoll','onclick',metricEditorAddRoll);bind('inventoryLoadBackfill','onclick',loadInventoryBackfill);bind('inventoryAutoBackfill','onclick',autoBackfillCompletedJobs);bind('scheduleMaterialLinearFt','oninput',()=>{$('scheduleMaterialLinearFt').dataset.source='manual';$('scheduleMaterialLinearFt').dataset.optimizerPlanId='';$('scheduleMaterialLinearFt').dataset.rollWidth='';updateScheduleMaterialProjection()});bind('scheduleFilmProduct','onchange',updateScheduleMaterialProjection);bind('optimizerLoadQuote','onclick',loadSelectedOptimizerQuote);bind('optimizerRun','onclick',runRollOptimizer);bind('optimizerClear','onclick',clearRollOptimizer);bind('optimizerSavePlan','onclick',saveRollOptimizerPlan);bind('optimizerPrint','onclick',printRollOptimizer);bind('saveInstallerJobUpdate','onclick',saveInstallerJobUpdate);bind('saveScheduledJob','onclick',saveScheduledJob);bind('newQuote','onclick',()=>clearQuoteForm(false));bind('newQuoteTop','onclick',()=>{$('quoteBuilderPanel')?.setAttribute('open','');clearQuoteForm();setTimeout(()=>$('qFirst')?.focus(),50)});bind('addMeasure','onclick',()=>addMeasure());bind('duplicateLastMeasure','onclick',duplicateLastMeasure);bind('mobileAddWindow','onclick',()=>addMeasure());bind('mobileSaveQuote','onclick',saveCloudQuote);['qFirst','qLast','qEmail','qPhone','qAddress','qProject','qType','qSquareItem','qStatus','qMiles','qLead','qNotes'].forEach(id=>{
  let el=$(id);if(!el)return;
  el.addEventListener(el.tagName==='SELECT'?'change':'input',scheduleQuoteAutosave);
});
window.addEventListener('beforeunload',()=>{if(!quoteAutosaveMuted)saveQuoteDraftLocal()});
bind('saveQuote','onclick',saveCloudQuote);bind('quoteSaveDockButton','onclick',saveCloudQuote);bind('copyQuote','onclick',()=>navigator.clipboard.writeText(currentQuoteText()).then(()=>toast('Quote copied')));bind('emailQuote','onclick',()=>location.href=`mailto:${encodeURIComponent($('qEmail').value)}?subject=${encodeURIComponent('Your Window Film Proposal — '+($('qProject').value||$('qFirst').value))}&body=${encodeURIComponent(currentQuoteText())}`);bind('clearQuote','onclick',()=>clearQuoteForm(true));bind('qMiles','oninput',()=>{quoteMilesManual=true;setMileageAutoStatus('Manual mileage');calculateQuote()});bind('qAddress','oninput',scheduleQuoteMileageAutofill);bind('qAddress','onblur',()=>autoFillQuoteMiles($('qAddress').value));bind('addShortcut','onclick',()=>openShortcut());bind('saveShortcut','onclick',saveShortcut);bind('shortcutSearch','oninput',renderShortcuts);bind('shortcutCategoryFilter','onchange',renderShortcuts);bind('refreshShortcuts','onclick',refreshBuiltInShortcuts);
bindOwnerCommandCenter();
bind('addOrganicLeadBtn','onclick',()=>openNewLeadQuote('Organic'));document.querySelectorAll('[data-homequick="quote"]').forEach(b=>b.onclick=()=>{clearQuoteForm(false);show('quotes');$('quoteBuilderPanel')?.setAttribute('open','');setTimeout(()=>$('qFirst')?.focus(),80)});document.querySelectorAll('[data-homequick="lead"]').forEach(b=>b.onclick=()=>openNewLeadQuote('Organic'));bind('saveOrganicLeadBtn','onclick',saveOrganicLead);bind('leadSearch','oninput',renderLeadResults);bind('leadStatusFilter','onchange',renderLeadResults);bind('quoteSearch','oninput',renderQuoteResults);bind('quoteStatusFilter','onchange',renderQuoteResults);bind('operationView','onchange',async()=>{
  operationsSelectedDate=null;
  if($('operationView').value==='all'){
    if($('operationStatus'))$('operationStatus').value='';
    if($('operationRange'))$('operationRange').value='all';
  }
  await loadIcloudViewEvents();
  renderOperations();
});bind('operationSearch','oninput',renderOperations);bind('operationStatus','onchange',async()=>{
  operationsSelectedDate=null;
  if($('operationStatus').value){
    if($('operationView'))$('operationView').value='all';
    if($('operationRange'))$('operationRange').value='all';
  }
  await loadIcloudViewEvents();
  renderOperations();
});bind('operationRange','onchange',async()=>{
  operationsSelectedDate=null;
  await loadIcloudViewEvents();
  renderOperations();
});bind('operationsPrevMonth','onclick',()=>{operationsCalendarDate=new Date(operationsCalendarDate.getFullYear(),operationsCalendarDate.getMonth()-1,1);operationsSelectedDate=null;loadIcloudViewEvents().then(renderOperations)});
bind('operationsNextMonth','onclick',()=>{operationsCalendarDate=new Date(operationsCalendarDate.getFullYear(),operationsCalendarDate.getMonth()+1,1);operationsSelectedDate=null;loadIcloudViewEvents().then(renderOperations)});
bind('operationsToday','onclick',async()=>{operationsCalendarDate=new Date();operationsSelectedDate=operationLocalDateKey(new Date());renderOperationsCalendar();await renderSelectedCalendarDate();});
bind('operationsClearDate','onclick',()=>{operationsSelectedDate=null;renderOperationsCalendar();renderOperations()});
bind('operationsSelectedDayClose','onclick',()=>{operationsSelectedDate=null;renderOperationsCalendar();renderOperations()});bind('refreshOperations','onclick',refreshOperationsSchedule);bind('windowMeasurementsCloseX','onclick',closeWindowMeasurementsModal);bind('copyWindowMeasurements','onclick',copyWindowMeasurements);bind('shareWindowMeasurements','onclick',shareWindowMeasurements);bind('enablePushNotifications','onclick',enablePushNotifications);bind('disablePushNotifications','onclick',disablePushNotifications);bind('testPushNotification','onclick',testPushNotification);bind('notifyNewLeads','onchange',savePushPreferences);bind('notifyFollowups','onchange',savePushPreferences);bind('notifyAssignments','onchange',savePushPreferences);bind('notifyJobTomorrow','onchange',savePushPreferences);bind('notifyJobSoon','onchange',savePushPreferences);bind('notifyScheduleChanges','onchange',savePushPreferences);bind('notifyLowInventory','onchange',savePushPreferences);bind('refreshIcloudCalendars','onclick',()=>loadIcloudCalendarStatus());bind('saveIcloudCalendarSelection','onclick',saveIcloudCalendarSelection);bind('testIcloudCalendar','onclick',testIcloudCalendarConnection);bind('connectCalendar','onclick',connectGoogleCalendar);bind('disconnectCalendar','onclick',disconnectGoogleCalendar);bind('testCalendar','onclick',testCalendarConnection);bind('refreshCalendars','onclick',()=>loadCalendarStatus());bind('saveCalendarSelection','onclick',saveCalendarSelection);bind('exportTimeCsv','onclick',exportTimeCsv);document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));document.addEventListener('click',e=>{
  let navButton=e.target.closest('#nav [data-v]');
  if(navButton){
    e.preventDefault();
    navButton.dataset.v==='more'?openMoreMenu():show(navButton.dataset.v);
    return;
  }
  let moreButton=e.target.closest('#moreMenu [data-more-go]');
  if(moreButton){
    e.preventDefault();
    show(moreButton.dataset.moreGo);
    return;
  }
  let goButton=e.target.closest('[data-go]');
  if(goButton){
    e.preventDefault();
    show(goButton.dataset.go);
  }
});
bind('login','onclick',login);bind('reset','onclick',reset);bind('logout','onclick',()=>sb.auth.signOut());bind('addLead','onclick',()=>openNewLeadQuote('Angi'));bind('saveLead','onclick',saveLead);bind('saveActivity','onclick',saveActivity);document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close)?.classList.remove('show'));sb.auth.onAuthStateChange(async(_,s)=>{session=s;if(s){try{await enter()}catch(e){$('message').textContent=e.message}}else{$('app').classList.add('hidden');$('auth').classList.remove('hidden')}});session=(await sb.auth.getSession()).data.session;if(session){try{await enter()}catch(e){$('message').textContent=e.message}}if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js');

function routePushTarget(target){
  let raw=typeof target==='string'?target:(target?.url||'./'),
      hash=String(raw).includes('#')?String(raw).split('#')[1]:'',
      route=hash.split('?')[0]||'home',
      params=new URLSearchParams(hash.includes('?')?hash.split('?').slice(1).join('?'):'');
  let allowed=['home','leads','followups','operations','inventory','quotes','account'];
  if(!allowed.includes(route))route='home';
  show(route);
  // Keep the entity identifiers available for detail routing as those views evolve.
  window.dynamicTintzPushContext={
    route,
    lead_id:params.get('lead_id')||target?.lead_id||null,
    job_id:params.get('job_id')||target?.job_id||null,
    product_id:params.get('product_id')||target?.product_id||null
  };
  if(route==='leads'&&typeof loadLeads==='function')loadLeads();
  if(route==='followups'&&typeof loadFollowups==='function')loadFollowups();
  if(route==='operations'&&typeof loadOperations==='function')loadOperations();
  if(route==='inventory'&&typeof loadInventory==='function')loadInventory();
}
navigator.serviceWorker?.addEventListener?.('message',e=>{
  if(e.data?.type==='OPEN_PUSH_TARGET')routePushTarget(e.data);
});
function routeInitialPushHash(){
  let h=location.hash||'';
  if(/^#(leads|followups|operations|inventory|quotes|account)(\?|$)/.test(h)){
    setTimeout(()=>routePushTarget('./'+h),250);
  }
}
window.addEventListener('hashchange',routeInitialPushHash);


window.addEventListener('load',routeInitialPushHash);

document.addEventListener('click',e=>{
  if(e.target?.id==='windowMeasurementsModal')closeWindowMeasurementsModal();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('windowMeasurementsModal')?.classList.contains('show'))closeWindowMeasurementsModal();
});
