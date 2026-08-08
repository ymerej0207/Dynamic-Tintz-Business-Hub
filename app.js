import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
let operationsCache=[],teamTimeCache=[];
const sb=createClient("https://jypfmjuesuezlmgfmrjq.supabase.co","sb_publishable_pAu0w7YvY4vk5sMect4LQw_-SG6ngls",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}),$=id=>document.getElementById(id);let session,profile,leads=[];
function toast(m){$("toast").textContent=m;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1800)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function when(v){return v?new Date(v).toLocaleString():"—"}function owner(){return ["owner","manager"].includes(profile.role)}
async function login(){$("message").textContent="Signing in…";let{error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});$("message").textContent=error?error.message:""}
async function reset(){let e=$("email").value.trim();if(!e)return $("message").textContent="Enter your email first.";let{error}=await sb.auth.resetPasswordForEmail(e,{redirectTo:location.href});$("message").textContent=error?error.message:"Password reset sent."}
function lastViewKey(){return `dt.lastView.${session?.user?.id||"guest"}`}
function allowedView(id){return [...document.querySelectorAll('#nav button')].some(button=>button.dataset.v===id)}
async function enter(){let{data,error}=await sb.from("profiles").select("*").eq("id",session.user.id).single();if(error)throw error;profile=data;$("auth").classList.add("hidden");$("app").classList.remove("hidden");$("userline").textContent=`${profile.full_name||profile.email} • ${profile.role}`;$("accountInfo").innerHTML=`<b>${esc(profile.full_name)}</b><br>${esc(profile.email)}<br><span class="pill">${profile.role}</span>`;renderNav();setupEmployeeAdmin();if(owner()){$("calendarIntegrationCard")?.classList.remove("hidden");$("icloudCalendarCard")?.classList.remove("hidden");}let saved=localStorage.getItem(lastViewKey()),fallback=owner()?"owner":"employee";show(saved&&allowedView(saved)?saved:fallback)}
function renderNav(){let t=owner()?[['owner','⌂','Home'],['leads','📞','Leads'],['followups','🔁','Follow-Ups'],['quotes','🧾','Quotes'],['optimizer','✂','Roll Optimizer'],['operations','📅','Operations'],['shortcuts','💬','Responses'],['team','⏱','Team'],['account','⚙','Account']]:[['employee','⌂','Home'],['time','⏱','Clock'],['account','⚙','Account']];$("nav").style.gridTemplateColumns=`repeat(${t.length},1fr)`;$("nav").innerHTML=t.map((x,i)=>`<button data-v="${x[0]}" class="${i?'':'active'}"><b>${x[1]}</b>${x[2]}</button>`).join('');$("nav").querySelectorAll('button').forEach(b=>b.onclick=()=>show(b.dataset.v))}
async function show(id){if(!$(id)||!allowedView(id))id=owner()?'owner':'employee';localStorage.setItem(lastViewKey(),id);document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.v===id));if(id==='owner')dashboard();if(id==='leads')loadLeads();if(id==='followups')loadFollowups();if(id==='time')loadTime();if(id==='employee')loadEmployee();if(id==='team')loadTeam();if(id==='quotes'){loadQuotes();renderMeasures()}if(id==='optimizer')loadRollOptimizer();if(id==='shortcuts')renderShortcuts();if(id==='operations')loadOperations();if(id==='account'&&owner()){loadEmployeeAdmin();loadCalendarStatus();loadIcloudCalendarStatus()}}
async function dashboard(){let now=new Date(),iso=now.toISOString(),monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString();let[a,b,c,pending,scheduled,completed,jobsResult,quotesResult]=await Promise.all([sb.from('leads').select('*',{count:'exact',head:true}).eq('status','new'),sb.from('leads').select('*',{count:'exact',head:true}).lte('next_follow_up_at',iso).not('status','in','("approved","lost","do_not_contact","no_response")'),sb.from('time_entries').select('*',{count:'exact',head:true}).eq('status','open'),sb.from('quotes').select('*',{count:'exact',head:true}).in('status',['New Lead','Estimate Requested','Quote Sent','Follow-Up Needed','Approved']),sb.from('jobs').select('*',{count:'exact',head:true}).in('status',['Scheduled','Confirmed','En Route','In Progress']),sb.from('jobs').select('*',{count:'exact',head:true}).eq('status','Completed').gte('updated_at',monthStart),sb.from('jobs').select('id,title,status,service_address,scheduled_start,assigned_to,assignee:profiles!jobs_assigned_to_fkey(full_name,email)').in('status',['Scheduled','Confirmed','En Route','In Progress']).order('scheduled_start'),sb.from('quotes').select('status')]);$('newLeads').textContent=a.count||0;$('dueLeads').textContent=b.count||0;$('clocked').textContent=c.count||0;$('pendingQuotes').textContent=pending.count||0;$('scheduledJobs').textContent=scheduled.count||0;$('completedMonth').textContent=completed.count||0;let tasks=[];if(a.count)tasks.push(`${a.count} new lead${a.count===1?' needs':'s need'} immediate contact.`);if(b.count)tasks.push(`${b.count} follow-up${b.count===1?' is':'s are'} due.`);if(pending.count)tasks.push(`${pending.count} active quote${pending.count===1?' remains':'s remain'} in the pipeline.`);$('mission').innerHTML=tasks.length?tasks.map(x=>`• ${x}`).join('<br>'):'Everything is caught up right now.';let jobs=jobsResult.data||[];$('liveJobs').innerHTML=jobs.length?jobs.slice(0,6).map(j=>`<div class="live-job"><div><b>${esc(j.title||'Installation')}</b><div class="muted">${when(j.scheduled_start)} • ${esc(j.service_address||'')}<br>${esc(j.assignee?.full_name||j.assignee?.email||'Unassigned')}</div></div><span class="pill">${esc(j.status)}</span></div>`).join(''):'No active jobs right now.';let counts={};(quotesResult.data||[]).forEach(q=>counts[q.status]=(counts[q.status]||0)+1);let pipeline=['New Lead','Estimate Requested','Quote Sent','Follow-Up Needed','Approved','Scheduled','Completed'],max=Math.max(1,...pipeline.map(s=>counts[s]||0));$('pipelineSnapshot').innerHTML=pipeline.map(s=>`<div class="pipeline-row"><span>${esc(s)}</span><div class="pipeline-track"><i style="width:${((counts[s]||0)/max)*100}%"></i></div><b>${counts[s]||0}</b></div>`).join('')}
function card(l,due=false){return `<div class="item"><div class="head"><div><h2>${esc((l.first_name+' '+l.last_name).trim()||'Unnamed Lead')}</h2><div class="muted">${esc(l.source||'Angi')} • ${when(l.received_at)}</div></div><span class="pill">${esc(String(l.status||'new').replaceAll('_',' '))}</span></div><div class="muted">${esc(l.phone)}${l.email?` • ${esc(l.email)}`:''}<br>${esc(l.city||l.service_address||'')}<br>${esc(l.service_requested||'')}<br>Attempts: ${l.attempt_count||0}${due?`<br><b>Follow-up:</b> ${when(l.next_follow_up_at)}`:''}</div><div class="actions"><a class="btn" href="tel:${esc(l.phone)}">Call</a><button class="btn" data-copyphone="${esc(l.phone)}">Copy Phone</button><button class="btn primary" data-log="${l.id}">Log Attempt</button><button class="btn" data-leadquote="${l.id}">Create Quote</button>${owner()?`<button class="btn danger" data-deletelead="${l.id}">Delete Lead</button>`:''}</div></div>`}
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
function renderLeadResults(){let q=($('leadSearch')?.value||'').toLowerCase(),status=$('leadStatusFilter')?.value||'',items=leads.filter(l=>(!status||l.status===status)&&JSON.stringify(l).toLowerCase().includes(q));$('leadList').innerHTML=items.length?items.map(x=>card(x)).join(''):'<div class="card muted">No matching leads.</div>';bindLeadActions($('leadList'))}
async function loadLeads(){let{data,error}=await sb.from('leads').select('*').order('received_at',{ascending:false});if(error)return toast(error.message);leads=data||[];renderLeadResults()}
async function loadFollowups(){let now=new Date(),future=new Date(now);future.setDate(future.getDate()+7);let{data,error}=await sb.from('leads').select('*').not('status','in','("approved","lost","do_not_contact","no_response")').not('next_follow_up_at','is',null).lte('next_follow_up_at',future.toISOString()).order('next_follow_up_at');if(error)return toast(error.message);let due=(data||[]).filter(x=>new Date(x.next_follow_up_at)<=now),upcoming=(data||[]).filter(x=>new Date(x.next_follow_up_at)>now);$('overdueFollowups').textContent=due.length;$('upcomingFollowups').textContent=upcoming.length;$('followList').innerHTML=due.length?due.map(x=>card(x,true)).join(''):'<div class="card muted">No follow-ups due right now.</div>';$('upcomingFollowList').innerHTML=upcoming.length?upcoming.map(x=>card(x,true)).join(''):'<div class="card muted">No follow-ups scheduled in the next seven days.</div>';bindLeadActions($('followList'));bindLeadActions($('upcomingFollowList'))}
function createQuoteFromLead(id){let l=leads.find(x=>x.id===id);if(!l)return toast('Lead not found.');clearQuoteForm(false);$('qFirst').value=l.first_name||'';$('qLast').value=l.last_name||'';$('qEmail').value=l.email||'';$('qPhone').value=l.phone||'';$('qAddress').value=l.service_address||'';$('qProject').value=l.service_requested||'Window Film Project';$('qLead').value=l.source||'Angi';$('qNotes').value=l.original_message||'';$('qStatus').value='Estimate Requested';show('quotes');toast('Lead loaded into Quote Builder.')}
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
async function loadEmployee(){renderClock($('employeeClock'),await openShift());let{data,error}=await sb.from('jobs').select('*,quote:quotes!jobs_quote_id_fkey(id,project_name,project_type,total_sqft,measurements,notes,status)').neq('status','Completed').order('scheduled_start');data=(data||[]).filter(j=>j.assigned_to===session.user.id||(j.assigned_installers||[]).includes(session.user.id));if(error){$('jobs').innerHTML=`<div class="item muted">${esc(error.message)}</div>`;return}window._assignedJobs=data||[];$('jobs').innerHTML=data?.length?data.map((j,i)=>{let q=j.quote,roomCount=Array.isArray(q?.measurements)?q.measurements.length:0,status=j.status||'Scheduled';return `<div class="item"><div class="head"><div><b>${esc(j.title||q?.project_name||'Installation')}</b><div class="muted">${when(j.scheduled_start)}<br>${esc(j.service_address)}</div></div><span class="pill">${esc(status)}</span></div>${q?`<div class="muted">${Number(q.total_sqft||0).toFixed(2)} total sq ft • ${roomCount} measurement row${roomCount===1?'':'s'}</div><div class="actions"><button class="btn primary" data-jobdetails="${i}">Open Job</button><a class="btn" target="_blank" href="https://maps.apple.com/?q=${encodeURIComponent(j.service_address||'')}">Directions</a>${status==='Scheduled'?`<button class="btn warn" data-jobstatus="${i}" data-status="En Route">Mark En Route</button>`:''}${status==='En Route'?`<button class="btn warn" data-jobstatus="${i}" data-status="In Progress">Start Job</button>`:''}${status==='In Progress'?`<button class="btn primary" data-jobstatus="${i}" data-status="Completed">Mark Complete</button>`:''}</div>`:`<div class="muted">No quote is linked to this job yet.</div>`}</div>`}).join(''):'No assigned jobs yet.';$('jobs').querySelectorAll('[data-jobdetails]').forEach(b=>b.onclick=()=>openJobDetails(Number(b.dataset.jobdetails)));$('jobs').querySelectorAll('[data-jobstatus]').forEach(b=>b.onclick=()=>updateJobStatus(Number(b.dataset.jobstatus),b.dataset.status))}function openJobDetails(i){let j=window._assignedJobs?.[i],q=j?.quote;if(!q)return toast('No quote is linked to this job.');let measurements=Array.isArray(q.measurements)?q.measurements:[];$('jobDetailModal').dataset.jobIndex=i;$('jobDetailTitle').textContent=j.title||q.project_name||'Job Details';$('jobDetailMeta').innerHTML=`${esc(j.service_address||'')}<br>${Number(q.total_sqft||0).toFixed(2)} total sq ft<br><b>Status:</b> ${esc(j.status||'Scheduled')}${q.notes?`<br><b>Project notes:</b> ${esc(q.notes)}`:''}`;$('jobInstallerNotes').value=j.notes||'';$('jobStatusSelect').value=j.status||'Scheduled';$('jobDimensionList').innerHTML=measurements.length?measurements.map((m,n)=>{let area=Number(m.w||0)*Number(m.h||0)*Number(m.qty||1)/144;return `<div class="dimension-card"><div><b>${n+1}. ${esc(m.area||'Window')}</b><div class="muted">${Number(m.w||0)}″ W × ${Number(m.h||0)}″ H • Qty ${Number(m.qty||1)}</div></div><strong>${area.toFixed(2)} sq ft</strong></div>`}).join(''):'<div class="muted">No measurements are stored on this quote.</div>';$('jobDetailModal').classList.add('show')}async function updateJobStatus(i,status){let j=window._assignedJobs?.[i];if(!j)return toast('Job not found.');if(status==='Completed'&&!confirm('Mark this installation complete?'))return;let{error}=await sb.from('jobs').update({status,archived_at:status==='Completed'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',j.id);if(error)return toast(error.message);if(j.quote_id){let quoteStatus=status==='Completed'?'Completed':'Scheduled';await sb.from('quotes').update({status:quoteStatus,updated_at:new Date().toISOString()}).eq('id',j.quote_id)}toast(`Job marked ${status}.`);await loadEmployee()}async function saveInstallerJobUpdate(){let i=Number($('jobDetailModal').dataset.jobIndex),j=window._assignedJobs?.[i];if(!j)return toast('Job not found.');let status=$('jobStatusSelect').value,notes=$('jobInstallerNotes').value.trim();let{error}=await sb.from('jobs').update({status,notes,archived_at:status==='Completed'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',j.id);if(error)return toast(error.message);if(j.quote_id){let quoteStatus=status==='Completed'?'Completed':'Scheduled';await sb.from('quotes').update({status:quoteStatus,updated_at:new Date().toISOString()}).eq('id',j.quote_id)}$('jobDetailModal').classList.remove('show');toast('Job update saved.');await loadEmployee()}
async function loadTeam(){let{data,error}=await sb.from('time_entry_totals').select('*,employee:profiles!time_entries_employee_id_fkey(full_name,email)').gte('clock_in',week()).order('clock_in',{ascending:false});if(error)return toast(error.message);teamTimeCache=data||[];let groups={};teamTimeCache.forEach(x=>{let id=x.employee_id;groups[id]??={name:x.employee?.full_name||x.employee?.email||'Employee',total:0,entries:[]};groups[id].total+=Number(x.net_hours||0);groups[id].entries.push(x)});$('teamList').innerHTML=Object.values(groups).length?Object.values(groups).map(g=>`<div class="card"><div class="head"><h2>${esc(g.name)}</h2><span class="pill">${g.total.toFixed(2)} hrs</span></div>${g.entries.map(x=>`<div class="time-row"><span>${when(x.clock_in)} → ${when(x.clock_out)}</span><b>${Number(x.net_hours||0).toFixed(2)} hrs</b></div>`).join('')}</div>`).join(''):'<div class="card muted">No time entries this week.</div>'}
function exportTimeCsv(){if(!teamTimeCache.length)return toast('No weekly time records to export.');let rows=[['Employee','Clock In','Clock Out','Net Hours','Status'],...teamTimeCache.map(x=>[x.employee?.full_name||x.employee?.email||'Employee',when(x.clock_in),when(x.clock_out),Number(x.net_hours||0).toFixed(2),x.status||''])],csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'),blob=new Blob([csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`dynamic-tintz-time-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);toast('Weekly time CSV exported.')}

const ceramicMatrix=[[0,49,12],[50,99,11],[100,199,10],[200,299,9],[300,399,8],[400,499,7],[500,999999,6.5]],solarMatrix=[[0,99,7.5],[100,199,6.5],[200,299,6],[300,399,5.5],[400,999999,5]];
let measures=[{id:1,area:'',w:0,h:0,qty:1}],nextMeasure=2,editingQuoteId=null,editingCustomerId=null;
const SHORTCUT_LIBRARY_VERSION='4.1';
const defaultShortcuts=[{"key": "newlead", "category": "New Leads", "text": "Hi! This is Jeremy with Dynamic Tintz. Thank you for reaching out to us. We’re a local, veteran-owned family business serving homeowners and businesses throughout DFW, and we’d be grateful for the opportunity to help with your window film project. Send over a few photos, your service address, and what you’re hoping to improve—heat, glare, privacy, fading, or all of the above—and we’ll take it from there.", "builtin": true}, {"key": "quote", "category": "Estimates", "text": "Thank you for giving Dynamic Tintz the opportunity to earn your business. We take pride in providing honest recommendations, quality workmanship, and straightforward pricing for our neighbors throughout DFW. Send us your window photos, approximate measurements, service address, and the main concerns you’d like to solve, and we’ll put together a free estimate for you.", "builtin": true}, {"key": "photos", "category": "Estimates", "text": "To help us prepare the most accurate estimate possible, please send clear photos of each window from inside the home or business, along with approximate width and height measurements. Please also include the service address and let us know whether your main concern is heat, glare, privacy, UV protection, or appearance. Once we have that, we can recommend the best option for your space.", "builtin": true}, {"key": "followup", "category": "Follow-Ups", "text": "Hi {{Customer}}, this is Jeremy with Dynamic Tintz checking back in with you. I wanted to make sure you had everything you needed regarding your window film estimate. We know home and business projects are an investment, so there’s never any pressure from us—just honest answers and dependable service when you’re ready.", "builtin": true}, {"key": "followup2", "category": "Follow-Ups", "text": "Hi {{Customer}}, I wanted to follow up one more time regarding your window tinting project. We’d truly appreciate the opportunity to earn your business and help make your space more comfortable. If your plans have changed, no problem at all. Just let us know where things stand, and we’ll be happy to help whenever the timing is right.", "builtin": true}, {"key": "evening", "category": "Follow-Ups", "text": "Hi {{Customer}}, this is Jeremy with Dynamic Tintz checking back in this evening. I know the day can get busy, so I wanted to make sure you saw my earlier message. We’d be happy to answer any questions and help whenever it’s convenient for you.", "builtin": true}, {"key": "nextmorning", "category": "Follow-Ups", "text": "Good morning, {{Customer}}! This is Jeremy with Dynamic Tintz. I wanted to try you again regarding your window film request. We’d be glad to learn more about the project and provide an honest recommendation whenever you have a moment.", "builtin": true}, {"key": "threeDay", "category": "Follow-Ups", "text": "Hi {{Customer}}, this is Jeremy with Dynamic Tintz following up on your window film project. I wanted to make sure you weren’t still waiting on anything from us. There’s no pressure at all—we’re here whenever you’re ready or if any questions come up.", "builtin": true}, {"key": "finalfollowup", "category": "Follow-Ups", "text": "Hi {{Customer}}, I wanted to reach out one final time regarding your window film request. We’d still be honored to help, but I also don’t want to crowd your inbox. Feel free to save our number and reach out whenever the timing is right. Thank you again for considering Dynamic Tintz.", "builtin": true}, {"key": "ceramic", "category": "Residential", "text": "Our premium ceramic window film is one of the best upgrades you can make for comfort without changing the look and feel of your home. It helps reduce heat, glare, and UV exposure while maintaining excellent visibility. It’s the option we recommend most often because it delivers strong performance, a clean appearance, and long-term value.", "builtin": true}, {"key": "residential", "category": "Residential", "text": "At Dynamic Tintz, we understand that your home is more than just a property—it’s where your family lives, relaxes, and makes memories. Our residential window film is designed to make your home more comfortable while helping protect your floors, furniture, and belongings from sun exposure. Every residential installation includes a lifetime warranty for added peace of mind.", "builtin": true}, {"key": "commercial", "category": "Commercial", "text": "Thank you for considering Dynamic Tintz for your commercial project. We work with local businesses throughout DFW to improve comfort, reduce glare, enhance privacy, and create a more professional appearance. We understand the importance of working cleanly, staying on schedule, and minimizing disruption to your daily operations.", "builtin": true}, {"key": "warranty", "category": "Warranty", "text": "We stand behind our work because our name and reputation are attached to every installation. Residential projects include a lifetime warranty, and commercial projects include a 12-year warranty. We want our customers to feel confident knowing they’re working with a local company that will still be here if they ever need us.", "builtin": true}, {"key": "booking", "category": "Scheduling", "text": "We’d be happy to get your project on the schedule. Send us a few dates and times that work well for you, and we’ll check availability. A 50% deposit is due at invoicing to reserve the installation, with the remaining balance due once the job is completed and you’re satisfied with the finished result.", "builtin": true}, {"key": "reminder", "category": "Scheduling", "text": "Hi {{Customer}}, this is a friendly reminder from Dynamic Tintz about your upcoming window film installation. We’re looking forward to taking care of your project. Before we arrive, please make sure the window areas are accessible and move any fragile items or decorations nearby. We appreciate you choosing a local, veteran-owned business.", "builtin": true}, {"key": "late", "category": "Scheduling", "text": "Hi {{Customer}}, this is Jeremy with Dynamic Tintz. I wanted to personally let you know that we’re running a little behind schedule. We respect your time and don’t want to leave you wondering, so we’ll keep you updated with a more accurate arrival time. Thank you for your patience and understanding.", "builtin": true}, {"key": "reschedule", "category": "Scheduling", "text": "Hi {{Customer}}, we need to make a small adjustment to your scheduled installation. I apologize for the inconvenience, and we’ll do everything possible to find another date and time that works well for you. We appreciate your flexibility and your trust in Dynamic Tintz.", "builtin": true}, {"key": "review", "category": "Reviews", "text": "Thank you again for choosing Dynamic Tintz. As a local, veteran-owned family business, word of mouth means everything to us. If you’re happy with the finished work and your experience, we’d be incredibly grateful if you took a moment to leave us a Google review. Your support helps other homeowners and businesses in our community feel confident choosing us.", "builtin": true}, {"key": "thanks", "category": "Thank You", "text": "Thank you for trusting Dynamic Tintz with your project. We know you had options, and we never take your business for granted. Supporting our company means supporting a local veteran-owned family business, and we truly appreciate the opportunity to serve you.", "builtin": true}, {"key": "payment", "category": "Payments", "text": "Hi {{Customer}}, this is a friendly payment reminder from Dynamic Tintz. The remaining balance for your project is due upon completion. Please let us know if you need the invoice resent or have any questions. Thank you again for supporting our local business.", "builtin": true}, {"key": "deposit", "category": "Payments", "text": "Hi {{Customer}}, your Dynamic Tintz project is ready to reserve. A 50% deposit is due at invoicing to secure the installation date, with the remaining balance due upon completion. Let us know if you need the invoice resent or have any questions.", "builtin": true}, {"key": "minimum", "category": "Pricing", "text": "Our minimum project price is $250 for locations within 35 miles of our Anna service area and $350 for locations beyond 35 miles. This allows us to cover professional materials, travel, preparation, installation, and warranty support while maintaining the quality our customers expect from Dynamic Tintz.", "builtin": true}, {"key": "noauto", "category": "General", "text": "Thank you for reaching out to Dynamic Tintz. We specialize exclusively in residential and commercial window film, so we don’t currently offer automotive tinting. We appreciate you thinking of us and would be happy to help with any home, office, storefront, or commercial glass project.", "builtin": true}, {"key": "facebook", "category": "Community", "text": "Dynamic Tintz would be honored to help! We’re a local, veteran-owned family business serving homeowners and businesses throughout DFW. We specialize in residential and commercial window film for heat reduction, glare control, privacy, UV protection, and improved comfort. Free estimates are available—call or text us at 469-840-4008.", "builtin": true}, {"key": "nextdoor", "category": "Community", "text": "Hi neighbors! I’m Jeremy, the owner of Dynamic Tintz. We’re a local, veteran-owned family business based right here in the area, specializing in residential and commercial window film. We take pride in honest recommendations, clean installations, and treating every customer’s property like it was our own. Call or text us at 469-840-4008 for a free estimate.", "builtin": true}, {"key": "recommendation", "category": "Community", "text": "We truly appreciate the recommendation. Dynamic Tintz is a veteran-owned family business, and we take a lot of pride in every home and business we work in. If we have the opportunity to earn your business, we’ll treat your property with the same care and respect we’d want for our own.", "builtin": true}, {"key": "referral", "category": "Referrals", "text": "Thank you so much for recommending Dynamic Tintz. Referrals from our customers and neighbors are one of the biggest compliments we can receive. We’ll take great care of anyone you send our way and make sure they receive the same honest, dependable service you experienced.", "builtin": true}, {"key": "referralthanks", "category": "Referrals", "text": "Thank you for sending your friends and family our way. Word of mouth has helped build Dynamic Tintz from day one, and we never take that trust for granted. We truly appreciate your support.", "builtin": true}, {"key": "complete", "category": "Job Completion", "text": "Hi {{Customer}}, your installation is complete! Thank you again for trusting Dynamic Tintz with your home or business. We hope you immediately notice the improvement in comfort, glare control, and overall appearance. Please reach out anytime if you have questions.", "builtin": true}, {"key": "care", "category": "Job Completion", "text": "For the best results, please avoid cleaning or touching the newly installed film while it cures. A slightly hazy appearance or small moisture pockets can be normal during the drying process and will clear as the film fully cures.", "builtin": true}, {"key": "privacy", "category": "Education", "text": "Window film can provide excellent daytime privacy when the outside is brighter than the inside. At night, interior lighting can reduce that privacy effect, so curtains or blinds may still be needed after dark. We’ll help you choose the best option for your goals and glass.", "builtin": true}, {"key": "uv", "category": "Education", "text": "Quality window film can block up to 99% of harmful UV rays, helping protect flooring, furniture, artwork, and other belongings from sun-related fading while making the room more comfortable.", "builtin": true}, {"key": "heat", "category": "Education", "text": "Window film helps reduce the solar heat entering through your glass, which can improve comfort, reduce hot spots, and lessen the workload on your HVAC system. Performance depends on the film selected, glass type, window direction, and overall building conditions.", "builtin": true}, {"key": "glare", "category": "Education", "text": "Window film is an excellent way to reduce harsh glare on televisions, computer screens, and living spaces without permanently covering the windows or eliminating natural light.", "builtin": true}, {"key": "freeestimate", "category": "Estimates", "text": "We provide free estimates for residential and commercial window film projects throughout DFW. Send us a few photos, approximate measurements, the service address, and what you’d like to improve, and we’ll help guide you toward the right solution.", "builtin": true}];
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
function qSqft(){return measures.reduce((s,r)=>s+(Number(r.w)*Number(r.h)*Number(r.qty||1))/144,0)}
function calculateQuote(){let s=qSqft(),m=Number($('qMiles').value)||0,c=qPrice(ceramicMatrix,s,m),o=qPrice(solarMatrix,s,m),list=12*s,save=Math.max(0,list-c.price),pct=list?Math.round(save/list*100):0;$('qSqft').textContent=s.toFixed(2);$('qCerPrice').textContent=money(c.price);$('qCerTier').textContent=c.label;$('qSolarPrice').textContent=money(o.price);$('qSolarTier').textContent=o.label;$('qListPrice').textContent=money(list);$('qTierPrice').textContent=money(c.price);$('qSavings').textContent=money(save)+' ('+pct+'%)';$('qDeposit').textContent=money(c.price*1.0625/2);if($('mobileSqft'))$('mobileSqft').textContent=s.toFixed(2)+' sq ft';if($('mobilePrice'))$('mobilePrice').textContent=money(c.price)}
function renderMeasures(){let el=$('measureRows');if(!el)return;el.innerHTML='';measures.forEach((r,index)=>{let d=document.createElement('div');d.className='measure-row';let area=(Number(r.w)*Number(r.h)*Number(r.qty||1)/144).toFixed(2);d.innerHTML=`<div class="measure-index">${index+1}</div><input class="area" data-mid="${r.id}" data-k="area" placeholder="Living room" value="${esc(r.area)}"><input data-mid="${r.id}" data-k="w" inputmode="decimal" placeholder="Width" value="${r.w||''}"><input data-mid="${r.id}" data-k="h" inputmode="decimal" placeholder="Height" value="${r.h||''}"><input data-mid="${r.id}" data-k="qty" inputmode="numeric" placeholder="Qty" value="${r.qty||1}"><div class="measure-total">${area} sq ft</div><button class="btn mini" data-duplicate="${r.id}" title="Duplicate window">⧉</button><button class="btn danger mini" data-remove="${r.id}" title="Delete window">×</button>`;el.appendChild(d)});el.querySelectorAll('input').forEach(i=>{i.oninput=()=>{let r=measures.find(x=>x.id===Number(i.dataset.mid));r[i.dataset.k]=i.dataset.k==='area'?i.value:Number(i.value)||0;calculateQuote();let row=i.closest('.measure-row'),total=row?.querySelector('.measure-total');if(total)total.textContent=((Number(r.w)*Number(r.h)*Number(r.qty||1))/144).toFixed(2)+' sq ft'};i.onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();let order=['area','w','h','qty'],position=order.indexOf(i.dataset.k);if(position<order.length-1){i.closest('.measure-row')?.querySelector(`[data-k="${order[position+1]}"]`)?.focus()}else{addMeasure(true)}}});el.querySelectorAll('[data-duplicate]').forEach(b=>b.onclick=()=>duplicateMeasure(Number(b.dataset.duplicate)));el.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{measures=measures.filter(x=>x.id!==Number(b.dataset.remove));if(!measures.length)measures=[{id:nextMeasure++,area:'',w:0,h:0,qty:1}];renderMeasures()});calculateQuote()}
function addMeasure(focus=true,preset=null){let id=nextMeasure++,last=measures[measures.length-1],row=preset||{id,area:last?.area||'',w:0,h:0,qty:1};row={...row,id};measures.push(row);renderMeasures();if(focus)setTimeout(()=>document.querySelector(`[data-mid="${id}"][data-k="${row.area?'w':'area'}"]`)?.focus(),40)}
function duplicateMeasure(id){let source=measures.find(x=>x.id===id);if(!source)return;addMeasure(false,{...source});toast('Window duplicated')}
function duplicateLastMeasure(){let last=measures[measures.length-1];if(!last)return;duplicateMeasure(last.id)}
function clearQuoteForm(confirmFirst=true){if(confirmFirst&&!confirm('Clear this quote and start another?'))return;['qFirst','qLast','qEmail','qPhone','qAddress','qProject','qNotes'].forEach(id=>$(id).value='');$('qMiles').value='0';$('qType').value='Residential';if($('qSquareItem'))$('qSquareItem').value='25% Ceramic Tint Install';$('qStatus').value='New Lead';$('qLead').value='Angi';measures=[{id:1,area:'',w:0,h:0,qty:1}];nextMeasure=2;editingQuoteId=null;editingCustomerId=null;renderMeasures()}
function currentQuoteText(){let s=qSqft(),m=Number($('qMiles').value)||0,c=qPrice(ceramicMatrix,s,m),o=qPrice(solarMatrix,s,m),list=12*s,save=Math.max(0,list-c.price),pct=list?Math.round(save/list*100):0;return `Dynamic Tintz Window Film Proposal\n\nCustomer: ${$('qFirst').value} ${$('qLast').value}\nProject: ${$('qProject').value||'Window Film Project'}\nAddress: ${$('qAddress').value}\nTotal glass: ${s.toFixed(2)} sq ft\n\nPremium Ceramic normal price: ${money(list)}\nVolume-tier price: ${money(c.price)}\nCustomer savings: ${money(save)} (${pct}%)\nSolar Control: ${money(o.price)}\n\n50% deposit due at invoicing; balance due upon completion.\nResidential Lifetime Warranty • 12 Year Commercial Warranty\nProudly Veteran Owned and Operated\nDynamic Tintz • 469-840-4008`}
async function saveCloudQuote(){let customer={first_name:$('qFirst').value.trim(),last_name:$('qLast').value.trim(),email:$('qEmail').value.trim(),phone:$('qPhone').value.trim(),service_address:$('qAddress').value.trim(),lead_source:$('qLead').value.trim(),notes:$('qNotes').value.trim(),updated_at:new Date().toISOString()};let customerId=editingCustomerId;if(customerId){let{error}=await sb.from('customers').update(customer).eq('id',customerId);if(error)return toast(error.message)}else{let{data,error}=await sb.from('customers').insert(customer).select().single();if(error)return toast(error.message);customerId=data.id}let s=qSqft(),c=qPrice(ceramicMatrix,s,Number($('qMiles').value)||0),o=qPrice(solarMatrix,s,Number($('qMiles').value)||0),list=12*s,payload={customer_id:customerId,project_name:$('qProject').value.trim(),project_type:$('qType').value,square_catalog_item_name:$('qSquareItem')?.value||'25% Ceramic Tint Install',status:$('qStatus').value,service_address:$('qAddress').value.trim(),miles:Number($('qMiles').value)||0,total_sqft:s,ceramic_list_price:list,ceramic_price:c.price,ceramic_savings:Math.max(0,list-c.price),solar_price:o.price,tax_rate:6.25,notes:$('qNotes').value.trim(),measurements:measures,updated_at:new Date().toISOString()};let res;if(editingQuoteId)res=await sb.from('quotes').update(payload).eq('id',editingQuoteId);else res=await sb.from('quotes').insert(payload);if(res.error)return toast(res.error.message);toast(editingQuoteId?'Quote updated in cloud.':'Quote saved to cloud.');clearQuoteForm(false);loadQuotes()}
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
  if(button){button.disabled=true;button.textContent='Creating Square Draft…'}
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
    toast(data.duplicate?'Square draft already exists.':`Square draft created: ${data.billedSqft} sq ft • ${data.catalogItemName}`);
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

function renderQuoteResults(){
  let data=window._cloudQuotes||[],
      q=($('quoteSearch')?.value||'').toLowerCase(),
      status=$('quoteStatusFilter')?.value||'',
      filtered=data.filter(x=>(!status||x.status===status)&&JSON.stringify(x).toLowerCase().includes(q)),
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
        billed=Math.ceil(actual),
        squareItem=q.square_catalog_item_name||'25% Ceramic Tint Install',
        squareButton=q.square_invoice_id
          ? `<button class="btn" disabled>Square Draft ${esc(q.square_invoice_number||q.square_status||'Created')}</button>`
          : `<button class="btn primary" data-squaredraft="${q.id}">Create Square Draft</button>`;
    return `<div class="quote-card">
      <div class="head"><div><h2>${esc((q.customer?.first_name||'')+' '+(q.customer?.last_name||''))}</h2>
      <div class="muted">${esc(q.project_name||'Project')} • ${new Date(q.created_at).toLocaleDateString()}</div></div><span class="pill">${esc(q.status)}</span></div>
      <div class="muted">${esc(q.service_address)}<br>
      ${actual.toFixed(2)} sq ft • Ceramic ${money(q.ceramic_price)}
      <br><b>Square Draft:</b> ${esc(squareItem)} • ${billed||0} whole sq ft
      ${q.square_invoice_id?`<br><b>Square:</b> Draft ${esc(q.square_invoice_number||q.square_status||'Created')}`:''}
      ${job?`<br><b>Assigned job:</b> ${when(job.scheduled_start)} • ${esc(job.status)}`:'<br><b>Not scheduled yet</b>'}</div>
      <div class="actions">
        <button class="btn primary" data-openquote="${q.id}">Open</button>
        ${squareButton}
        <button class="btn" data-optimizequote="${q.id}">Optimize Roll</button>
        <button class="btn" data-duplicatequote="${q.id}">Duplicate</button>
        <button class="btn" data-schedulequote="${q.id}">${job?'Edit Assignment':'Schedule & Assign'}</button>
        ${job?`<button class="btn warn" data-removeassignment="${q.id}" data-jobid="${job.id}">Remove Assignment</button>`:''}
        <button class="btn" data-copycloud="${globalIndex}">Copy</button>
        <button class="btn danger" data-deletequote="${q.id}">Delete Quote</button>
      </div>
    </div>`
  }).join(''):'<div class="card muted">No matching cloud quotes.</div>';
  $('savedQuotes').querySelectorAll('[data-openquote]').forEach(b=>b.onclick=()=>openCloudQuote(b.dataset.openquote));
  $('savedQuotes').querySelectorAll('[data-squaredraft]').forEach(b=>b.onclick=()=>createSquareDraft(b.dataset.squaredraft,b));
  $('savedQuotes').querySelectorAll('[data-optimizequote]').forEach(b=>b.onclick=()=>openQuoteInOptimizer(b.dataset.optimizequote));
  $('savedQuotes').querySelectorAll('[data-duplicatequote]').forEach(b=>b.onclick=()=>duplicateCloudQuote(b.dataset.duplicatequote));
  $('savedQuotes').querySelectorAll('[data-schedulequote]').forEach(b=>b.onclick=()=>openScheduleJob(b.dataset.schedulequote));
  $('savedQuotes').querySelectorAll('[data-removeassignment]').forEach(b=>b.onclick=()=>removeAssignment(b.dataset.removeassignment,b.dataset.jobid));
  $('savedQuotes').querySelectorAll('[data-deletequote]').forEach(b=>b.onclick=()=>deleteCloudQuote(b.dataset.deletequote));
  $('savedQuotes').querySelectorAll('[data-copycloud]').forEach(b=>b.onclick=()=>navigator.clipboard.writeText(cloudQuoteText(data[Number(b.dataset.copycloud)])).then(()=>toast('Quote copied')));
}
async function openCloudQuote(id){let{data:q,error}=await sb.from('quotes').select('*,customer:customers(*)').eq('id',id).single();if(error)return toast(error.message);editingQuoteId=q.id;editingCustomerId=q.customer_id;$('qFirst').value=q.customer?.first_name||'';$('qLast').value=q.customer?.last_name||'';$('qEmail').value=q.customer?.email||'';$('qPhone').value=q.customer?.phone||'';$('qAddress').value=q.service_address||'';$('qProject').value=q.project_name||'';$('qType').value=q.project_type||'Residential';if($('qSquareItem'))$('qSquareItem').value=q.square_catalog_item_name||'25% Ceramic Tint Install';$('qStatus').value=q.status||'New Lead';$('qMiles').value=q.miles||0;$('qLead').value=q.customer?.lead_source||'';$('qNotes').value=q.notes||'';measures=Array.isArray(q.measurements)?q.measurements:[{id:1,area:'',w:0,h:0,qty:1}];nextMeasure=Math.max(0,...measures.map(x=>Number(x.id)||0))+1;renderMeasures();scrollTo({top:0,behavior:'smooth'});toast('Quote loaded from cloud.')}
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
    let direct=line.match(/^\s*(\d+)\s*(?:@|pcs?\s*@?|pieces?\s*@?)\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*(.*))?$/i);
    if(direct){push((direct[4]||pendingLabel).trim(),direct[2],direct[3],direct[1]);pendingDimension=null;continue}
    let qtyTail=line.match(/^(.+?)\s+qty\s*[:=]?\s*(\d+)\s*$/i);
    if(qtyTail&&pendingDimension){push(pendingLabel,pendingDimension.w,pendingDimension.h,qtyTail[2]);pendingDimension=null;continue}
    let dimension=line.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s|$)/i);
    if(dimension){
      let before=line.slice(0,dimension.index).replace(/[-:]+$/,'').trim();
      let qtyBefore=line.match(/^\s*(\d+)\s*(?:@|pcs?|pieces?)\s*/i);
      let qtyAfter=line.match(/(?:qty|quantity)\s*[:=]?\s*(\d+)/i);
      let qty=qtyBefore?.[1]||qtyAfter?.[1]||1;
      let label=before.replace(/^\d+\s*(?:@|pcs?|pieces?)\s*/i,'').trim()||pendingLabel;
      let next=lines[i+1]||'';
      let nextQty=next.match(/^qty\s*[:=]?\s*(\d+)$/i);
      if(nextQty){qty=nextQty[1];i++}
      push(label,dimension[1],dimension[2],qty);
      pendingDimension=null;
      continue;
    }
    let qtyOnly=line.match(/^qty\s*[:=]?\s*(\d+)$/i);
    if(qtyOnly&&pendingDimension){push(pendingLabel,pendingDimension.w,pendingDimension.h,qtyOnly[1]);pendingDimension=null;continue}
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
    let{data,error}=await sb.from('quotes').select('id,project_name,service_address,measurements,customer:customers(first_name,last_name)').order('created_at',{ascending:false});
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
    <div class="grid3 optimizer-metrics">
      <div class="mini-stat"><b>${optimizerInches(settings.rollWidth)}</b><span>Roll Width</span></div>
      <div class="mini-stat"><b>${optimizerFeet(settings.rollLength)}</b><span>Available Length</span></div>
      <div class="mini-stat"><b>${optimizerRound(result.totalArea/144,2)}</b><span>Sq Ft Needed</span></div>
      <div class="mini-stat"><b>${optimizerInches(result.linear)}</b><span>Linear Inches Required</span></div>
      <div class="mini-stat ${remainingOk?'':'optimizer-danger'}"><b>${remainingOk?optimizerFeet(result.remaining):'SHORT'}</b><span>Remaining Roll</span></div>
      <div class="mini-stat"><b>${optimizerRound(result.efficiency,1)}%</b><span>Material Efficiency</span></div>
    </div>
    ${remainingOk?'':`<div class="card optimizer-alert"><b>Insufficient inventory:</b> This plan requires ${optimizerFeet(result.linear-settings.rollLength)} more film than the entered roll length.</div>`}
    <div class="card"><div class="head" style="margin-top:0"><h3>Roll Summary</h3><span class="pill">${totalPieces} pieces</span></div>
      <div class="optimizer-summary-grid">
        <div><span>Total material area</span><b>${optimizerRound(result.totalArea/144,2)} sq ft</b></div>
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
    <div class="card"><h3>Piece Schedule</h3><div class="table-wrap"><table class="optimizer-table"><thead><tr><th>Area</th><th>Qty</th><th>Size</th><th>Area</th></tr></thead><tbody>${pieceRows}</tbody></table></div></div>
    <div class="card"><h3>Waste Report</h3>
      <div class="optimizer-summary-grid">
        <div><span>Total unused film area</span><b>${optimizerRound(result.wasteArea/144,2)} sq ft</b></div>
        <div><span>Width/length waste</span><b>${optimizerRound(result.wastePct,1)}%</b></div>
        <div><span>Usable roll remaining</span><b>${remainingOk?optimizerFeet(result.remaining):'None — inventory short'}</b></div>
        <div><span>Future use</span><b>${result.remaining>=12?'Retain remaining roll for future jobs':'Small remnants only'}</b></div>
      </div>
      <p class="muted">Long continuous remainder stays on the roll and remains fully usable. Short lane-end scraps and narrow strips should be labeled by width and length before disposal or remnant storage.</p>
    </div>
    <div class="card"><h3>Optimization Notes</h3>
      <p>Selected the lowest-linear-footage solution found across ${result.trials} internally compared layouts. Rotation was ${settings.allowRotation?'enabled':'disabled'}. The plan uses no more than ${settings.maxLanes} simultaneous lanes and prioritizes repeated setups where linear footage remains equal.</p>
    </div>`;
  $('optimizerResults').classList.remove('hidden');
}
function runRollOptimizer(){
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
    message.textContent='Comparing cutting layouts…';
    setTimeout(()=>{
      try{
        let result=optimizeFilmRoll(groups,settings);
        let q=(window._optimizerQuotes||window._cloudQuotes||[]).find(x=>x.id===rollOptimizerQuoteId);
        rollOptimizerResult=result;
        renderOptimizerResult(result,q?.project_name||`${q?.customer?.first_name||''} ${q?.customer?.last_name||''}`.trim()||'Manual Job');
        message.textContent=`Optimization complete. ${result.trials} layouts compared.`;
        $('optimizerResults').scrollIntoView({behavior:'smooth',block:'start'});
      }catch(e){message.textContent=e.message}
    },30);
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
  toast('Optimization plan saved to cloud.');
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


async function loadIcloudCalendarStatus(){
  let st=$('icloudCalendarStatus'),m=$('icloudCalendarMessage'),wrap=$('icloudCalendarPickerWrap'),test=$('testIcloudCalendar');
  if(!st)return;
  let{data,error}=await sb.functions.invoke('icloud-calendar-auth',{body:{action:'status'}});
  if(error||data?.ok===false){st.textContent='Needs setup';m.textContent=error?.message||data?.error||'Add the iCloud secrets and deploy the iCloud functions.';wrap?.classList.add('hidden');if(test)test.disabled=true;return}
  if(!data.configured){st.textContent='Not configured';m.textContent='Add ICLOUD_APPLE_ID and ICLOUD_APP_SPECIFIC_PASSWORD in Supabase Edge Function secrets.';wrap?.classList.add('hidden');if(test)test.disabled=true;return}
  let selected=data.selected_calendars||[];
  st.textContent=selected.length?`${selected.length} Selected`:'Connected';
  m.textContent=`iCloud credentials verified${selected.length?' • '+selected.map(c=>c.name).join(', '):' • Choose calendars below'}`;
  wrap?.classList.remove('hidden');if(test)test.disabled=!selected.length;
  await loadIcloudCalendarChoices(selected);
}
async function loadIcloudCalendarChoices(selected=[]){
  let picker=$('icloudCalendarPicker'),m=$('icloudCalendarMessage');if(!picker)return;
  picker.innerHTML='<div class="muted">Loading iCloud calendars…</div>';
  let{data,error}=await sb.functions.invoke('icloud-calendar-auth',{body:{action:'calendars'}});
  if(error||data?.ok===false){picker.innerHTML='';m.textContent=error?.message||data?.error||'Could not load iCloud calendars.';return}
  let selectedIds=new Set((selected.length?selected:data.selected_calendars||[]).map(c=>c.id));
  picker.innerHTML=(data.calendars||[]).map(c=>`<label class="installer-option ${c.writable?'':'calendar-readonly'}"><input type="checkbox" value="${esc(c.id)}" ${selectedIds.has(c.id)?'checked':''} ${c.writable?'':'disabled'}><span>${esc(c.name)}<small>${c.writable?'Can sync jobs':'Read only'}</small></span></label>`).join('')||'<div class="muted">No iCloud calendars were found.</div>';
}
async function saveIcloudCalendarSelection(){
  let ids=[...$('icloudCalendarPicker').querySelectorAll('input:checked')].map(x=>x.value),b=$('saveIcloudCalendarSelection'),m=$('icloudCalendarMessage');
  if(!ids.length){m.textContent='Choose at least one writable iCloud calendar.';return}
  b.disabled=true;m.textContent='Saving iCloud calendar selection…';
  let{data,error}=await sb.functions.invoke('icloud-calendar-auth',{body:{action:'select',calendar_ids:ids}});b.disabled=false;
  if(error||data?.ok===false){m.textContent=error?.message||data?.error||'Could not save iCloud calendar selection.';return}
  toast(`${data.selected_calendars.length} iCloud calendar${data.selected_calendars.length===1?'':'s'} selected.`);await loadIcloudCalendarStatus();
}
async function testIcloudCalendarConnection(){
  let b=$('testIcloudCalendar'),m=$('icloudCalendarMessage'),st=$('icloudCalendarStatus');b.disabled=true;m.textContent='Testing selected iCloud calendars…';
  let{data,error}=await sb.functions.invoke('icloud-calendar-sync',{body:{test:true}});b.disabled=false;
  if(error||data?.ok===false){st.textContent='Needs attention';m.textContent=error?.message||data?.error||'iCloud calendar test failed.';return}
  st.textContent=`${data.calendars.length} Selected`;m.textContent=`Connected to ${data.calendars.join(', ')}.`;
}

async function loadCalendarStatus(){let st=$('calendarStatus'),m=$('calendarMessage'),connect=$('connectCalendar'),disconnect=$('disconnectCalendar'),test=$('testCalendar'),wrap=$('calendarPickerWrap'),refresh=$('refreshCalendars');if(!st)return;let{data,error}=await sb.functions.invoke('google-calendar-auth',{body:{action:'status'}});if(error||data?.ok===false){st.textContent='Needs setup';m.textContent=error?.message||data?.error||'Could not read calendar connection status.';connect?.classList.remove('hidden');disconnect?.classList.add('hidden');refresh?.classList.add('hidden');wrap?.classList.add('hidden');test.disabled=true;return}if(data.connected){let selected=data.selected_calendars||[];st.textContent=selected.length?`${selected.length} Selected`:'Connected';m.textContent=`${data.email||'Google account connected'}${selected.length?' • '+selected.map(c=>c.name).join(', '):' • Choose calendars below'}`;connect?.classList.add('hidden');disconnect?.classList.remove('hidden');refresh?.classList.remove('hidden');wrap?.classList.remove('hidden');test.disabled=!selected.length;await loadCalendarChoices(selected)}else{st.textContent='Not connected';m.textContent='Connect dynamictintzllc@gmail.com to choose which calendars receive scheduled jobs.';connect?.classList.remove('hidden');disconnect?.classList.add('hidden');refresh?.classList.add('hidden');wrap?.classList.add('hidden');test.disabled=true}}
async function loadCalendarChoices(selected=[]){let picker=$('calendarPicker'),m=$('calendarMessage');if(!picker)return;picker.innerHTML='<div class="muted">Loading calendars…</div>';let{data,error}=await sb.functions.invoke('google-calendar-auth',{body:{action:'calendars'}});if(error||data?.ok===false){picker.innerHTML='';m.textContent=error?.message||data?.error||'Could not load calendars.';return}let selectedIds=new Set((selected.length?selected:data.selected_calendars||[]).map(c=>c.id));picker.innerHTML=(data.calendars||[]).map(c=>`<label class="installer-option ${c.writable?'':'calendar-readonly'}"><input type="checkbox" value="${esc(c.id)}" ${selectedIds.has(c.id)?'checked':''} ${c.writable?'':'disabled'}><span>${esc(c.name)}${c.primary?' <b>Primary</b>':''}<small>${c.writable?'Can sync jobs':`Read only • ${esc(c.access_role)}`}</small></span></label>`).join('')||'<div class="muted">No Google calendars were found.</div>'}
async function saveCalendarSelection(){let ids=[...$('calendarPicker').querySelectorAll('input:checked')].map(x=>x.value),b=$('saveCalendarSelection'),m=$('calendarMessage');if(!ids.length){m.textContent='Choose at least one calendar you can edit.';return}b.disabled=true;m.textContent='Saving calendar selection…';let{data,error}=await sb.functions.invoke('google-calendar-auth',{body:{action:'select',calendar_ids:ids}});b.disabled=false;if(error||data?.ok===false){m.textContent=error?.message||data?.error||'Could not save calendar selection.';return}toast(`${data.selected_calendars.length} calendar${data.selected_calendars.length===1?'':'s'} selected.`);await loadCalendarStatus()}
async function connectGoogleCalendar(){let b=$('connectCalendar'),m=$('calendarMessage');b.disabled=true;m.textContent='Opening Google sign-in…';let{data,error}=await sb.functions.invoke('google-calendar-auth',{body:{action:'start'}});b.disabled=false;if(error||data?.ok===false||!data?.auth_url){m.textContent=error?.message||data?.error||'Could not start Google connection.';return}let popup=window.open(data.auth_url,'dynamicTintzGoogleCalendar','width=620,height=760');if(!popup){location.href=data.auth_url;return}let checks=0,timer=setInterval(async()=>{checks++;if(popup.closed||checks>60){clearInterval(timer);await loadCalendarStatus()}},2000)}
async function disconnectGoogleCalendar(){if(!confirm('Disconnect Google Calendar? Existing calendar events will stay in Google, but future job changes will stop syncing.'))return;let{data,error}=await sb.functions.invoke('google-calendar-auth',{body:{action:'disconnect'}});if(error||data?.ok===false)return toast(error?.message||data?.error||'Could not disconnect calendar.');toast('Google Calendar disconnected.');await loadCalendarStatus()}
async function testCalendarConnection(){let b=$('testCalendar'),m=$('calendarMessage'),st=$('calendarStatus');b.disabled=true;m.textContent='Testing selected calendars…';let{data,error}=await sb.functions.invoke('google-calendar-sync',{body:{test:true}});b.disabled=false;if(error||data?.ok===false){st.textContent='Needs attention';m.textContent=error?.message||data?.error||'Calendar test failed.';return}st.textContent=`${data.calendars.length} Selected`;m.textContent=`Connected to ${data.calendars.join(', ')}.`}
bind('optimizerLoadQuote','onclick',loadSelectedOptimizerQuote);bind('optimizerRun','onclick',runRollOptimizer);bind('optimizerClear','onclick',clearRollOptimizer);bind('optimizerSavePlan','onclick',saveRollOptimizerPlan);bind('optimizerPrint','onclick',printRollOptimizer);bind('saveInstallerJobUpdate','onclick',saveInstallerJobUpdate);bind('saveScheduledJob','onclick',saveScheduledJob);bind('newQuote','onclick',()=>clearQuoteForm(false));bind('addMeasure','onclick',()=>addMeasure());bind('duplicateLastMeasure','onclick',duplicateLastMeasure);bind('mobileAddWindow','onclick',()=>addMeasure());bind('mobileSaveQuote','onclick',saveCloudQuote);bind('saveQuote','onclick',saveCloudQuote);bind('copyQuote','onclick',()=>navigator.clipboard.writeText(currentQuoteText()).then(()=>toast('Quote copied')));bind('emailQuote','onclick',()=>location.href=`mailto:${encodeURIComponent($('qEmail').value)}?subject=${encodeURIComponent('Your Window Film Proposal — '+($('qProject').value||$('qFirst').value))}&body=${encodeURIComponent(currentQuoteText())}`);bind('clearQuote','onclick',()=>clearQuoteForm(true));bind('qMiles','oninput',calculateQuote);bind('addShortcut','onclick',()=>openShortcut());bind('saveShortcut','onclick',saveShortcut);bind('shortcutSearch','oninput',renderShortcuts);bind('shortcutCategoryFilter','onchange',renderShortcuts);bind('refreshShortcuts','onclick',refreshBuiltInShortcuts);
bindOwnerCommandCenter();
bind('leadSearch','oninput',renderLeadResults);bind('leadStatusFilter','onchange',renderLeadResults);bind('quoteSearch','oninput',renderQuoteResults);bind('quoteStatusFilter','onchange',renderQuoteResults);bind('operationStatus','onchange',renderOperations);bind('operationRange','onchange',renderOperations);bind('refreshOperations','onclick',loadOperations);bind('refreshIcloudCalendars','onclick',()=>loadIcloudCalendarStatus());bind('saveIcloudCalendarSelection','onclick',saveIcloudCalendarSelection);bind('testIcloudCalendar','onclick',testIcloudCalendarConnection);bind('connectCalendar','onclick',connectGoogleCalendar);bind('disconnectCalendar','onclick',disconnectGoogleCalendar);bind('testCalendar','onclick',testCalendarConnection);bind('refreshCalendars','onclick',()=>loadCalendarStatus());bind('saveCalendarSelection','onclick',saveCalendarSelection);bind('exportTimeCsv','onclick',exportTimeCsv);document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));bind('login','onclick',login);bind('reset','onclick',reset);bind('logout','onclick',()=>sb.auth.signOut());bind('addLead','onclick',()=>$('leadModal').classList.add('show'));bind('saveLead','onclick',saveLead);bind('saveActivity','onclick',saveActivity);document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close)?.classList.remove('show'));sb.auth.onAuthStateChange(async(_,s)=>{session=s;if(s){try{await enter()}catch(e){$('message').textContent=e.message}}else{$('app').classList.add('hidden');$('auth').classList.remove('hidden')}});session=(await sb.auth.getSession()).data.session;if(session){try{await enter()}catch(e){$('message').textContent=e.message}}if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js');
