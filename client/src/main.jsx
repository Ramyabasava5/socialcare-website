import React, { useEffect, useState } from 'react';
import { pipeline } from '@huggingface/transformers';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API='http://localhost:5000/api';
const modules=[
 ['mobile','📱','Mobile Usage','Stay within your 60-minute daily target.'],
 ['cyber','🛡️','Cyber Awareness','Check a message and understand its meaning.'],
 ['health','❤️','Health & Hygiene','Complete today’s healthy habits.'],
 ['food','🍱','Food Management','Make smart choices and reduce food waste.'],
 ['environment','🌱','Plastic & Environment','Reduce plastic and reuse items creatively.']
];
const tokenKey='socialcare_token';
const authFetch=(url,opts={})=>fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${localStorage.getItem(tokenKey)||''}`}});
function formatMinutes(m){m=Math.max(0,Math.floor(Number(m)||0));const h=Math.floor(m/60),min=m%60;return h?`${h} hour${h!==1?'s':''}${min?` ${min} min`:''}`:`${min} minutes`;}

function useBrowserUsageTracker(onSync,enabled){
 const [tracker,setTracker]=useState({minutes:0,active:false,started:false,exceeded:false});
 useEffect(()=>{if(!enabled)return;const KEY='socialcare_browser_usage_v2';const day=()=>new Date().toISOString().slice(0,10);const fresh=()=>({date:day(),ms:0,start:Date.now(),active:true});let s;try{s=JSON.parse(localStorage.getItem(KEY)||'null')}catch{s=null}if(!s||s.date!==day())s=fresh();else{s.start=Date.now();s.active=true}localStorage.setItem(KEY,JSON.stringify(s));let timer;const current=()=>s.ms+(s.active?Math.max(0,Date.now()-s.start):0);const update=()=>{const minutes=Math.floor(current()/60000);setTracker({minutes,active:s.active,started:true,exceeded:minutes>60})};const sync=async()=>{const minutes=Math.floor(current()/60000);localStorage.setItem(KEY,JSON.stringify({...s,ms:current(),start:Date.now()}));try{await authFetch(`${API}/mobile`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({minutes,source:'browser-session'})});onSync?.()}catch{}};timer=setInterval(()=>{if(s.date!==day()){s=fresh();localStorage.setItem(KEY,JSON.stringify(s))}update();sync()},3000);update();sync();return()=>clearInterval(timer)},[enabled,onSync]);return tracker;
}

function App(){
 const [auth,setAuth]=useState(null);const [page,setPage]=useState('home');const [dashboard,setDashboard]=useState(null);const [adminData,setAdminData]=useState(null);const [loading,setLoading]=useState(true);const [authScreen,setAuthScreen]=useState('login');const [authMode,setAuthMode]=useState('student');const [error,setError]=useState('');
 const refresh=React.useCallback(async()=>{if(!auth||auth.role!=='student')return;try{const r=await authFetch(`${API}/dashboard`);if(!r.ok)throw new Error();setDashboard(await r.json());setError('')}catch{setError('Could not load your dashboard. Start the server and log in again.')}},[auth]);
 const refreshAdmin=React.useCallback(async()=>{try{const r=await authFetch(`${API}/admin/students`);if(!r.ok)throw new Error();setAdminData(await r.json());setError('')}catch{setError('Could not load student information.')}},[]);
 useEffect(()=>{const saved=localStorage.getItem(tokenKey);if(!saved){setLoading(false);return}authFetch(`${API}/auth/me`).then(r=>r.ok?r.json():Promise.reject()).then(a=>{setAuth(a);setPage(a.role==='admin'?'admin':'home')}).catch(()=>localStorage.removeItem(tokenKey)).finally(()=>setLoading(false))},[]);
 useEffect(()=>{if(auth?.role==='student')refresh();if(auth?.role==='admin')refreshAdmin()},[auth,refresh,refreshAdmin]);
 const tracker=useBrowserUsageTracker(refresh,auth?.role==='student');
 const loginDone=a=>{localStorage.setItem(tokenKey,a.token);setAuth({role:a.role,user:a.user});setPage(a.role==='admin'?'admin':'home');setError('')};
 const logout=async()=>{try{await authFetch(`${API}/auth/logout`,{method:'POST'})}catch{}localStorage.removeItem(tokenKey);setAuth(null);setDashboard(null);setAdminData(null);setPage('home');setAuthScreen('login');setAuthMode('student')};
 const nav=next=>{setPage(next);window.scrollTo(0,0)};
 if(loading)return <div className="loading-screen"><div className="loader">🌍</div><h2>Loading SocialCare...</h2></div>;
 if(!auth)return <Auth screen={authScreen} setScreen={setAuthScreen} mode={authMode} setMode={setAuthMode} onDone={loginDone}/>;
 if(auth.role==='admin')return <AdminDashboard data={adminData} refresh={refreshAdmin} logout={logout}/>;
 return <div className="app"><div className="floating f1"/><div className="floating f2"/><div className="floating f3"/><header className="topbar"><button className="brand" onClick={()=>nav('home')}>🌍 <span>SocialCare</span></button><div className="tagline">Hi, {auth.user.name} <b>→</b> Make an impact</div><button className="back-top" onClick={logout}>Logout</button></header>{error&&<div className="server-warning">⚠️ {error}</div>}<main className="container">{page!=='home'&&<button className="back-button" onClick={()=>nav('home')}>← Back to Dashboard</button>}{dashboard&&page==='home'&&<Home dashboard={dashboard} nav={nav} logout={logout}/>} {dashboard&&page==='mobile'&&<Mobile dashboard={dashboard} tracker={tracker}/>} {dashboard&&page==='cyber'&&<Cyber onDone={refresh}/>} {dashboard&&page==='health'&&<Checklist title="❤️ Health & Hygiene" subtitle="Today’s questions change automatically." questions={dashboard.dailyQuestions.health} endpoint="health" onDone={refresh}/>} {dashboard&&page==='food'&&<Checklist title="🍱 Food Waste Management" subtitle="Today’s questions change automatically." questions={dashboard.dailyQuestions.food} endpoint="food" onDone={refresh}/>} {dashboard&&page==='environment'&&<Environment questions={dashboard.dailyQuestions.environment} onDone={refresh}/>} {dashboard&&page==='alerts'&&<Alerts alerts={dashboard.alerts}/>} {dashboard&&page==='history'&&<History history={dashboard.history}/>}</main></div>;
}

function Auth({screen,setScreen,mode,setMode,onDone}){const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const chooseMode=m=>{setMode(m);setScreen('login');setError('');setName('');setEmail('');setPassword('')};const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{const url=screen==='register'?`${API}/auth/register`:mode==='admin'?`${API}/auth/admin-login`:`${API}/auth/login`;const body=screen==='register'?{name,email,password}:{email,password};const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.message||'Unable to continue');onDone(d)}catch(err){setError(err.message)}finally{setBusy(false)}};return <div className="auth-page"><div className="auth-card"><div className="auth-logo">🌍</div><p className="eyebrow dark">SOCIALCARE</p><div className="login-tabs"><button type="button" className={mode==='student'?'active':''} onClick={()=>chooseMode('student')}>🎓 Student</button><button type="button" className={mode==='admin'?'active':''} onClick={()=>chooseMode('admin')}>👨‍💼 Admin</button></div><h1>{mode==='admin'?'Admin Login':screen==='login'?'Student Login':'Create Student Account'}</h1><p className="muted">{mode==='admin'?'Authorized administrator access only.':'Login to continue your personal responsibility journey.'}</p><form onSubmit={submit}>{screen==='register'&&mode==='student'&&<label className="field-label">Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required/></label>}<label className="field-label">Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></label><label className="field-label">Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" minLength="6" required/></label>{error&&<div className="result warning-result">⚠️ {error}</div>}<button className="primary" disabled={busy}>{busy?'Please wait...':screen==='register'?'Create Account':mode==='admin'?'Admin Login':'Student Login'}</button></form>{mode==='student'&&<button className="link-button" onClick={()=>{setError('');setScreen(screen==='login'?'register':'login')}}>{screen==='login'?"Don't have an account? Register":"Already have an account? Login"}</button>}</div></div>}
function Home({dashboard,nav}){const statusClass=dashboard.status==='GOOD'?'good':dashboard.status==='AVERAGE'?'average':'bad';return <><section className="hero"><div className="hero-orb orb1"/><div className="hero-orb orb2"/><div className="hero-content"><div><p className="eyebrow">TODAY’S RESPONSIBILITY SCORE</p><h1>{dashboard.total}<span>/100</span></h1><div className={`status ${statusClass}`}>● {dashboard.status}</div><p className="hero-note">Today starts at <b>0/100</b>. Earn points by completing real actions.</p></div><div className="score-ring" style={{'--progress':`${dashboard.total*3.6}deg`}}><div><strong>{dashboard.total}%</strong><span>today</span></div></div><div className="streak-card"><div className="streak-icon">🔥</div><div><strong>{dashboard.streak} Day Streak</strong><small>Keep completing your daily missions.</small></div></div></div></section><div className="section-heading"><div><p className="eyebrow dark">YOUR FIVE MISSIONS</p><h2>Choose a mission</h2></div><button className="outline-button" onClick={()=>nav('history')}>📊 History</button></div><div className="score-grid">{modules.map(([id,icon,title,desc])=><button className={`module module-${id}`} key={id} onClick={()=>nav(id)}><div className="module-icon">{icon}</div><div className="module-copy"><b>{title}</b><p>{desc}</p></div><div className="module-score"><strong>{dashboard.score[id]||0}</strong><span>/20</span></div><div className="mini-progress"><span style={{width:`${(dashboard.score[id]||0)*5}%`}}/></div></button>)}</div><div className="bottom-actions"><button className="alert-button" onClick={()=>nav('alerts')}>🔔 Alerts <span>{dashboard.alerts.length}</span></button><div className="impact-card"><span>🌍</span><div><b>Today’s Impact</b><p>{dashboard.total===0?'Start your first mission.':dashboard.total>=80?'Excellent work!':'Keep going — every action matters.'}</p></div></div></div></>}

function Mobile({dashboard,tracker}){const minutes=Math.max(tracker?.minutes??dashboard.mobileMinutes??0,0),target=60,exceeded=minutes>target,percent=Math.min(100,Math.round(minutes/target*100));return <section className="panel"><div className="panel-title"><span className="big-icon">📱</span><div><p className="eyebrow dark">MISSION 01</p><h2>Mobile Usage Control</h2><p className="muted">Your SocialCare usage is counted automatically.</p></div><div className="live-score"><strong>{minutes>0&&!exceeded?20:0}/20</strong><span>points</span></div></div><div className="usage-card"><div className="tracking-pill">🟢 Tracking active</div><div className="usage-number">{formatMinutes(minutes)}</div><div className="target-text">Daily target: <b>60 minutes</b></div><div className="bar"><span style={{width:`${percent}%`}}/></div><p className={exceeded?'negative':'positive'}>{exceeded?'🔴 60-minute target exceeded — today’s 20 mobile points are lost.':'🟢 You are within today’s target.'}</p></div><div className="tiny-note"><b>How it works:</b> the timer keeps the day’s total in minutes. Moving between SocialCare pages does not reset it. A normal website cannot read other phone apps; device-wide tracking requires the Android companion.</div></section>}

function Cyber({onDone}){const[text,setText]=useState(''),[result,setResult]=useState(null),[loading,setLoading]=useState(false);const analyse=async()=>{if(!text.trim())return;setLoading(true);try{const r=await authFetch(`${API}/cyber/analyse`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});const d=await r.json();if(!r.ok)throw new Error(d.message);setResult(d);onDone()}catch(e){setResult({error:e.message})}finally{setLoading(false)}};return <section className="panel"><div className="panel-title"><span className="big-icon">🛡️</span><div><p className="eyebrow dark">MISSION 02</p><h2>Cyber Crime Awareness</h2><p className="muted">Paste a message to check risk and understand it in simple words.</p></div><div className="live-score"><strong>{result&&!result.error?20:0}/20</strong><span>points</span></div></div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Paste the message here..."/><button className="primary" disabled={!text.trim()||loading} onClick={analyse}>{loading?'🔎 Analysing...':'🔍 Analyse Message'}</button>{result?.error&&<div className="result warning-result">⚠️ {result.error}</div>}{result&&!result.error&&<div className="result cyber-result"><h3>{result.verdict}</h3><div className={`risk-badge risk-${result.level.toLowerCase().replace(' ','-')}`}>Risk: {result.risk}/100 · {result.level}</div><h4>💡 Meaning</h4><p>{result.meaning}</p><h4>🔎 Why?</h4><ul>{result.reasons.map((x,i)=><li key={i}>{x}</li>)}</ul><h4>🛡️ Safety advice</h4><p>{result.advice}</p></div>}</section>}

function Checklist({title,subtitle,questions,endpoint,onDone}){const[answers,setAnswers]=useState(Array(questions.length).fill(false)),[result,setResult]=useState(null);const completed=answers.filter(Boolean).length,livePoints=Math.round(completed/questions.length*20);const submit=async()=>{const r=await authFetch(`${API}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers})});const d=await r.json();setResult(d);onDone()};return <section className="panel"><div className="panel-title"><span className="big-icon">{title.slice(0,2)}</span><div><p className="eyebrow dark">DAILY MISSION</p><h2>{title.slice(2)}</h2><p className="muted">{subtitle}</p></div><div className="live-score"><strong>{livePoints}/20</strong><span>{completed}/{questions.length}</span></div></div><div className="checklist">{questions.map((q,i)=><label className={`check ${answers[i]?'checked':''}`} key={q}><input type="checkbox" checked={answers[i]} onChange={()=>setAnswers(a=>a.map((v,j)=>j===i?!v:v))}/><span>{q}</span></label>)}</div><button className="primary" onClick={submit}>Save Today’s Score</button>{result&&<div className="result">✅ {result.completed}/{result.total} completed → <b>{result.points}/20 points</b></div>}</section>}

function Environment({questions,onDone}) {
  const [answers,setAnswers]=useState(Array(questions.length).fill(false));
  const [photo,setPhoto]=useState(null);
  const [preview,setPreview]=useState('');
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [detected,setDetected]=useState(null);
  const [aiStatus,setAiStatus]=useState('');
  const completed=answers.filter(Boolean).length;
  const livePoints=Math.min(20,Math.round(completed/questions.length*15)+(photo?5:0));

  const CANDIDATES=[
    'a plastic water bottle','a plastic cup','a plastic shopping bag','a plastic container','a plastic bucket',
    'a plastic spoon','a plastic plate','a plastic bowl','a plastic jar','another plastic item'
  ];
  const ITEM_NAMES={
    'a plastic water bottle':'Plastic water bottle','a plastic cup':'Plastic cup','a plastic shopping bag':'Plastic bag',
    'a plastic container':'Plastic container','a plastic bucket':'Plastic bucket','a plastic spoon':'Plastic spoon',
    'a plastic plate':'Plastic plate','a plastic bowl':'Plastic bowl','a plastic jar':'Plastic jar','another plastic item':'Plastic item'
  };

  const analyzePhoto=async(file)=>{
    setAiStatus('🤖 Loading image model...');
    try{
      const classifier=await pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32');
      setAiStatus('🔎 AI is identifying the plastic item...');
      const output=await classifier(URL.createObjectURL(file),CANDIDATES);
      const best=output?.[0];
      const item=ITEM_NAMES[best?.label]||'Plastic item';
      const confidence=best?.score!=null?Math.round(best.score*100):null;
      setDetected({item,confidence,label:best?.label});
      setAiStatus('✅ Item identified');
      return {item,confidence};
    }catch(e){
      console.error(e);
      const objectUrl=URL.createObjectURL(file);
      const fallback=await new Promise(resolve=>{
        const img=new Image();
        img.onload=()=>{
          const ratio=img.height/Math.max(1,img.width);
          const name=(file.name||'').toLowerCase();
          if(/bottle|water/.test(name)) resolve('Plastic water bottle');
          else if(/cup|mug/.test(name)) resolve('Plastic cup');
          else if(/bag|cover/.test(name)) resolve('Plastic bag');
          else if(/box|container/.test(name)) resolve('Plastic container');
          else if(/bucket|pail/.test(name)) resolve('Plastic bucket');
          else if(/spoon/.test(name)) resolve('Plastic spoon');
          else if(/plate|dish/.test(name)) resolve('Plastic plate');
          else if(/bowl/.test(name)) resolve('Plastic bowl');
          else if(/jar|canister/.test(name)) resolve('Plastic jar');
          else if(name.includes('plastic') && ratio>1.25) resolve('Plastic water bottle');
          else resolve('Plastic item');
          URL.revokeObjectURL(objectUrl);
        };
        img.onerror=()=>{URL.revokeObjectURL(objectUrl);resolve('Plastic item')};
        img.src=objectUrl;
      });
      setDetected({item:fallback,confidence:null});
      setAiStatus(`ℹ️ Smart local fallback detected: ${fallback}`);
      return {item:fallback,confidence:null};
    }
  };

  const handlePhoto=async(file)=>{
    if(!file){setPhoto(null);setPreview('');setResult(null);setDetected(null);setAiStatus('');return;}
    setPhoto(file);setResult(null);setDetected(null);setAiStatus('🤖 Preparing image analysis...');
    const url=URL.createObjectURL(file);setPreview(url);
    await analyzePhoto(file);
  };

  const submit=async()=>{
    setLoading(true);
    try{
      let analysis=detected;
      let imageData='';
      let mimeType=photo?.type||'image/jpeg';
      if(photo){
        imageData=await new Promise((resolve,reject)=>{
          const fr=new FileReader();
          fr.onload=()=>resolve(fr.result);
          fr.onerror=reject;
          fr.readAsDataURL(photo);
        });
        if(!analysis) analysis=await analyzePhoto(photo);
      }
      const detectedItem=analysis?.item||'Plastic item';
      const r=await authFetch(`${API}/environment`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({answers,imageData,mimeType,detectedItem})
      });
      const d=await r.json();
      if(!r.ok)throw new Error(d.message||'Unable to save the environment activity.');
      setResult(d);onDone();
    }catch(e){setResult({error:e.message})}
    finally{setLoading(false)}
  };

  return <section className="panel">
    <div className="panel-title">
      <span className="big-icon">🌱</span>
      <div><p className="eyebrow dark">MISSION 05</p><h2>Plastic & Environment</h2><p className="muted">Complete the eco checklist or upload a plastic photo for a reuse idea.</p></div>
      <div className="live-score"><strong>{livePoints}/20</strong><span>points</span></div>
    </div>

    <div className="checklist">{questions.map((q,i)=><label className={`check ${answers[i]?'checked':''}`} key={q}>
      <input type="checkbox" checked={answers[i]} onChange={()=>setAnswers(a=>a.map((v,j)=>j===i?!v:v))}/><span>{q}</span>
    </label>)}</div>

    <div className="photo-box">
      <div className="photo-title">📸 Plastic Photo <span>+5 points</span></div>
      <input type="file" accept="image/*" onChange={e=>handlePhoto(e.target.files?.[0])}/>
      {photo&&<div className="preview"><img src={preview} alt="Selected plastic item"/><div><b>{photo.name}</b><p className={aiStatus.startsWith('ℹ️')?'negative':'positive'}>{aiStatus}</p></div></div>}
      {detected&&<div className="ai-detected"><b>🔎 Detected:</b> {detected.item}{detected.confidence!=null&&` · ${detected.confidence}%`}</div>}
    </div>

    <button className="primary" disabled={loading||(!photo&&completed===0)} onClick={submit}>{loading?'Saving...':'Save & Get Reuse Idea'}</button>

    {result?.error&&<div className="result warning-result">⚠️ {result.error}</div>}
    {result&&!result.error&&<div className="result">
      <b>🌱 Score: {result.points}/20</b>
      {photo&&<>
        <p>🔎 <b>Detected item:</b> {result.detectedItem}</p>
        {result.confidence!=null&&<p>📊 <b>Confidence:</b> {result.confidence}%</p>}
        <h4>🎨 Reuse / Craft Idea</h4>
        <div className="craft-idea">
          <strong>{result.craftIdea?.title||result.craftIdea||'Reuse idea'}</strong>
          {result.craftIdea?.description&&<p>{result.craftIdea.description}</p>}
        </div>
        {result.craftIdea?.materials?.length>0&&<>
          <h4>🧰 Materials Required</h4>
          <ul className="craft-list">{result.craftIdea.materials.map((m,i)=><li key={i}>{m}</li>)}</ul>
        </>}
        {result.craftIdea?.procedure?.length>0&&<>
          <h4>📝 Procedure</h4>
          <ol className="craft-list">{result.craftIdea.procedure.map((step,i)=><li key={i}>{step}</li>)}</ol>
        </>}
        <small>{result.aiUsed?'🤗 Image analysis was used to identify the item.':'ℹ️ Local item mapping was used.'}</small>
      </>}
    </div>}
  </section>;
}
function Alerts({alerts}){return <section className="panel"><div className="panel-title"><span className="big-icon">🔔</span><div><p className="eyebrow dark">HISTORY</p><h2>Alert History</h2></div></div>{alerts.length===0?<div className="empty">🎉 No alerts today.</div>:alerts.map(a=><div className="alert" key={a.id}><div><b>{a.type}</b><p>{a.message}</p></div><span>{a.time}</span></div>)}</section>}
function History({history=[]}){return <section className="panel"><div className="panel-title"><span className="big-icon">📊</span><div><p className="eyebrow dark">PROGRESS</p><h2>Daily Score History</h2></div></div>{history.length===0?<div className="empty">Your completed days will appear here.</div>:<div className="history-list">{history.map((h,i)=><div className="history-row" key={`${h.date}-${i}`}><div><b>{h.date}</b><span>{h.status}</span></div><strong>{h.total}/100</strong><div className="history-bar"><span style={{width:`${h.total}%`}}/></div></div>)}</div>}</section>}

function AdminDashboard({data,refresh,logout}){return <div className="app"><header className="topbar"><button className="brand">🌍 <span>SocialCare Admin</span></button><div className="tagline">Student Performance Overview</div><button className="back-top" onClick={logout}>Logout</button></header><main className="container"><section className="hero admin-hero"><div className="hero-content"><div><p className="eyebrow">ADMIN DASHBOARD</p><h1>{data?.count||0}<span> students</span></h1><p className="hero-note">View each student’s current score and every module score.</p></div><button className="primary admin-refresh" onClick={refresh}>↻ Refresh</button></div></section><section className="panel admin-panel"><div className="panel-title"><span className="big-icon">👨‍💼</span><div><h2>Student Information</h2><p className="muted">Only the admin account can access this page.</p></div></div>{!data?.students?.length?<div className="empty">No students have registered yet.</div>:<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student</th><th>Email</th><th>Total</th><th>📱 Mobile</th><th>🛡️ Cyber</th><th>❤️ Health</th><th>🍱 Food</th><th>🌱 Environment</th><th>Status</th></tr></thead><tbody>{data.students.map(s=><tr key={s.id}><td><b>{s.name}</b></td><td>{s.email}</td><td><strong>{s.total}/100</strong></td><td>{s.score.mobile}/20<br/><small>{formatMinutes(s.mobileMinutes)}</small></td><td>{s.score.cyber}/20</td><td>{s.score.health}/20</td><td>{s.score.food}/20</td><td>{s.score.environment}/20</td><td><span className={`status-chip ${s.status==='GOOD'?'good':s.status==='AVERAGE'?'average':'bad'}`}>{s.status}</span></td></tr>)}</tbody></table></div>}</section></main></div>}

createRoot(document.getElementById('root')).render(<App/>);
