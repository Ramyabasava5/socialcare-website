import React, { useEffect, useMemo, useState } from 'react';
import { pipeline } from '@huggingface/transformers';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API = '/api';
const modules = [
  ['mobile', '📱', 'Mobile Control', 'Device-wide screen-on tracking with a 30-minute daily target'],
  ['cyber', '🛡️', 'Cyber Awareness', 'Check a message and understand what it really means'],
  ['health', '❤️', 'Health & Hygiene', 'A fresh set of healthy habits every day'],
  ['food', '🍱', 'Food Management', 'New food-responsibility questions every day'],
  ['environment', '🌱', 'Environment', 'Daily eco actions plus AI reuse ideas for plastic photos']
];

function useBrowserUsageTracker(onSync) {
  const [tracker, setTracker] = useState(() => ({ active: true, minutes: 0, started: false, exceeded: false }));
  const notifiedRef = React.useRef(false);

  useEffect(() => {
    const KEY = 'socialcare_browser_tracker_v1';
    const todayLocal = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const freshState = () => ({ date: todayLocal(), accumulatedMs: 0, lastStart: Date.now(), active: true, started: true });
    let state;
    try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { state = null; }
    if (!state || state.date !== todayLocal()) state = freshState();
    else {
      // A page refresh should continue the saved total, but never count the time
      // while the browser page was closed.
      state.lastStart = Date.now();
      state.active = true;
      state.started = true;
    }
    localStorage.setItem(KEY, JSON.stringify(state));

    let timer = null;
    let lastSync = 0;
    const currentMs = () => state.accumulatedMs + (state.active ? Math.max(0, Date.now() - state.lastStart) : 0);
    const updateUI = () => {
      const ms = currentMs();
      const minutes = Math.floor(ms / 60000);
      setTracker({ active: state.active, minutes, started: state.started, exceeded: minutes > 30 });
      if (minutes > 30 && !notifiedRef.current) {
        notifiedRef.current = true;
        if ('Notification' in window) {
          if (Notification.permission === 'granted') new Notification('SocialCare – Mobile Alert', {body:`Your SocialCare usage crossed 30 minutes (${minutes} minutes). Today's 20 mobile points are lost.`});
          else if (Notification.permission === 'default') Notification.requestPermission().catch(()=>{});
        }
      }
    };
    const sync = async (force=false) => {
      const ms = currentMs();
      const minutes = Math.floor(ms / 60000);
      if (!force && Date.now() - lastSync < 4000) return;
      lastSync = Date.now();
      localStorage.setItem(KEY, JSON.stringify({ ...state, accumulatedMs: ms, lastStart: state.active ? Date.now() : 0 }));
      try {
        const r = await fetch(`${API}/mobile`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ minutes, source:'browser-session' })
        });
        if (r.ok) { const d = await r.json(); setTracker({active:state.active, minutes, started:true, exceeded:Boolean(d.exceeded)}); onSync?.(); }
      } catch {}
    };
    const tick = () => {
      if (state.date !== todayLocal()) { state = freshState(); localStorage.setItem(KEY, JSON.stringify(state)); notifiedRef.current = false; }
      updateUI(); sync(false);
    };
    timer = setInterval(tick, 1000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (state.active) {
          state.accumulatedMs = currentMs();
          state.active = false;
          state.lastStart = 0;
          localStorage.setItem(KEY, JSON.stringify(state));
          sync(true);
        }
      } else {
        if (state.date !== todayLocal()) state = freshState();
        state.lastStart = Date.now();
        state.active = true;
        state.started = true;
        localStorage.setItem(KEY, JSON.stringify(state));
        updateUI();
        sync(true);
      }
    };
    const onPageHide = () => {
      state.accumulatedMs = currentMs();
      state.active = false;
      state.lastStart = 0;
      localStorage.setItem(KEY, JSON.stringify(state));
      // sendBeacon is more reliable while the page is being closed.
      try {
        const minutes = Math.floor(state.accumulatedMs / 60000);
        navigator.sendBeacon(`${API}/mobile`, new Blob([JSON.stringify({minutes, source:'browser-session'})], {type:'application/json'}));
      } catch {}
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    updateUI();
    sync(true);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [onSync]);

  return tracker;
}

function App() {
  const [page, setPage] = useState(window.history.state?.page || 'home');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch(`${API}/dashboard`);
      if (!r.ok) throw new Error();
      setDashboard(await r.json()); setError('');
    } catch { setError('Backend is not running. Start Terminal 1 with: npm run server'); }
    finally { setLoading(false); }
  }, []);
  const browserTracker = useBrowserUsageTracker(refresh);
  useEffect(() => {
    if (!window.history.state) window.history.replaceState({ page: 'home' }, '', '#home');
    refresh();
    const onPop = () => setPage(window.history.state?.page || 'home');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = next => {
    if (next === page) return;
    window.history.pushState({ page: next }, '', `#${next}`);
    setPage(next); window.scrollTo(0, 0); refresh();
  };
  const goBack = () => { if (page !== 'home') window.history.back(); };
  if (loading && !dashboard) return <div className="loading-screen"><div className="loader">🌍</div><h2>Loading SocialCare...</h2></div>;
  return <div className="app">
    <div className="floating f1"/><div className="floating f2"/><div className="floating f3"/>
    <header className="topbar">
      <button className="brand" onClick={() => navigate('home')}>🌍 <span>SocialCare</span></button>
      <div className="tagline">Small Actions <b>→</b> Big Change</div>
      {page !== 'home' && <button className="back-top" onClick={goBack}>← Back</button>}
    </header>
    {error && <div className="server-warning">⚠️ {error}</div>}
    <main className="container">
      {page !== 'home' && <button className="back-button" onClick={goBack}>← Back to Dashboard</button>}
      {dashboard && page === 'home' && <Home dashboard={dashboard} nav={navigate}/>} 
      {dashboard && page === 'mobile' && <Mobile dashboard={dashboard} tracker={browserTracker} onDone={refresh}/>} 
      {dashboard && page === 'cyber' && <Cyber onDone={refresh}/>} 
      {dashboard && page === 'health' && <Checklist title="❤️ Health & Hygiene" subtitle="Today's questions change automatically so your routine stays interesting." questions={dashboard.dailyQuestions.health} endpoint="health" onDone={refresh}/>} 
      {dashboard && page === 'food' && <Checklist title="🍱 Food Waste Management" subtitle="A fresh set of food-responsibility questions is generated every day." questions={dashboard.dailyQuestions.food} endpoint="food" onDone={refresh}/>} 
      {dashboard && page === 'environment' && <Environment questions={dashboard.dailyQuestions.environment} onDone={refresh}/>} 
      {dashboard && page === 'alerts' && <Alerts alerts={dashboard.alerts}/>} 
      {dashboard && page === 'history' && <History history={dashboard.history}/>} 
    </main>
  </div>;
}

function Home({dashboard, nav}) {
  const statusClass = dashboard.status === 'GOOD' ? 'good' : dashboard.status === 'AVERAGE' ? 'average' : 'bad';
  return <>
    <section className="hero">
      <div className="hero-orb orb1"/><div className="hero-orb orb2"/>
      <div className="hero-content">
        <div><p className="eyebrow">TODAY'S RESPONSIBILITY SCORE</p><h1>{dashboard.total}<span>/100</span></h1><div className={`status ${statusClass}`}>● {dashboard.status}</div><p className="hero-note">Every new day starts at <b>0/100</b>. Your score grows only when you complete a real responsibility.</p></div>
        <div className="score-ring" style={{'--progress': `${dashboard.total*3.6}deg`}}><div><strong>{dashboard.total}%</strong><span>today</span></div></div>
        <div className="streak-card"><div className="streak-icon">🔥</div><div><strong>{dashboard.streak} Day Streak</strong><small>Complete your daily missions and build a responsible habit.</small></div></div>
      </div>
    </section>
    <div className="section-heading"><div><p className="eyebrow dark">YOUR FIVE MISSIONS</p><h2>Choose a mission & make an impact</h2></div><button className="outline-button" onClick={()=>nav('history')}>📊 History</button></div>
    <div className="score-grid">{modules.map(([id,icon,title,desc])=><button className={`module module-${id}`} key={id} onClick={()=>nav(id)}><div className="module-icon">{icon}</div><div className="module-copy"><b>{title}</b><p>{desc}</p></div><div className="module-score"><strong>{dashboard.score[id] || 0}</strong><span>/20</span></div><div className="mini-progress"><span style={{width:`${(dashboard.score[id]||0)*5}%`}}/></div></button>)}</div>
    <div className="bottom-actions"><button className="alert-button" onClick={()=>nav('alerts')}>🔔 Alert History <span>{dashboard.alerts.length}</span></button><div className="impact-card"><span>🌍</span><div><b>Today's Impact</b><p>{dashboard.total === 0 ? 'Start your first mission. Every point is earned by action.' : dashboard.total >= 80 ? 'Excellent! You are making a positive difference.' : 'Keep going — every completed action matters.'}</p></div></div></div>
  </>;
}

function Mobile({dashboard, tracker}) {
  const minutes = Math.max(tracker?.minutes ?? dashboard.mobileMinutes ?? 0, 0);
  const exceeded = minutes > 30;
  const started = Boolean(tracker?.started);
  const active = Boolean(tracker?.active);
  const percent = Math.min(100, Math.round(minutes / 30 * 100));
  return <section className="panel mission-mobile">
    <div className="panel-title">
      <span className="big-icon">📱</span>
      <div><p className="eyebrow dark">MISSION 01</p><h2>Mobile Usage Control</h2><p className="muted">Automatic tracking starts when SocialCare opens. Moving between SocialCare pages does not stop the tracker.</p></div>
      <div className="live-score"><strong>{minutes > 0 ? (exceeded ? 0 : 20) : 0}/20</strong><span>mission points</span></div>
    </div>
    <div className="usage-card">
      <div className="tracking-pill">{active ? '🟢 Tracking active' : '⏸️ Tracking paused'}</div>
      <div className="usage-number">{minutes}<small> min</small></div>
      <div className="target-text">Today's SocialCare active-session time · Target: <b>30 minutes</b></div>
      <div className="bar"><span style={{width:`${percent}%`}}/></div>
      <p className={exceeded?'negative':'positive'}>{exceeded?"🔴 30-minute target exceeded — today\'s mobile points are lost.":"🟢 No alert yet — stay within the 30-minute target."}</p>
    </div>
    <div className="device-status-card">
      <div className="tracking-pill">{started ? '⚡ Automatic mode ON' : 'Starting tracker...'}</div>
      <h3>{started ? 'No manual minutes required' : 'Starting automatic tracking'}</h3>
      <p>Keep SocialCare available while you use the student dashboard. Home → Health → Food → Cyber → Environment all belong to the same daily session, so changing pages does not reset the timer.</p>
      <div className="tracking-explain">
        <b>How the browser version works</b>
        <p>It uses the browser's page-visibility state and localStorage. When the SocialCare tab is visible, time is counted. If the tab is hidden, the timer pauses and resumes when you return. The total is saved so a refresh does not reset today's progress.</p>
      </div>
    </div>
    <div className="browser-note"><b>Important:</b> A normal website cannot read the total screen-on time of other phone apps. So this browser version tracks <b>SocialCare active usage</b>, not YouTube/Instagram/WhatsApp or the entire phone. Full device-wide tracking would require Android system access.</div>
  </section>;
}

function Cyber({onDone}){
  const [text,setText]=useState(''); const[result,setResult]=useState(null); const[loading,setLoading]=useState(false);
  const analyse=async()=>{if(!text.trim())return;setLoading(true);try{const r=await fetch(`${API}/cyber/analyse`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});const d=await r.json();setResult(d);onDone();}finally{setLoading(false)}};
  return <section className="panel"><div className="panel-title"><span className="big-icon">🛡️</span><div><p className="eyebrow dark">MISSION 02</p><h2>Cyber Crime Awareness</h2><p className="muted">Paste any message. We check its risk, explain its meaning in simple words, and tell you what to do.</p></div><div className="live-score"><strong>{result?20:0}/20</strong><span>mission points</span></div></div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Paste the message here..."/><button className="primary" disabled={!text.trim()||loading} onClick={analyse}>{loading?'🔎 Analysing...':'🔍 Analyse Message'}</button>{result&&<div className="result cyber-result"><h3>{result.verdict}</h3><div className={`risk-badge risk-${result.level.toLowerCase().replace(' ','-')}`}>Risk Score: {result.risk}/100 · {result.level}</div><h4>💡 What does this message mean?</h4><p>{result.meaning}</p><h4>🔎 Why did the system flag it?</h4><ul>{result.reasons.map((x,i)=><li key={i}>{x}</li>)}</ul><h4>🛡️ What should you do?</h4><p>{result.advice}</p><b>Cyber mission completed: 20/20</b></div>}</section>;
}

function Checklist({title,subtitle,questions,endpoint,onDone}){
  const[answers,setAnswers]=useState(Array(questions.length).fill(false));const[result,setResult]=useState(null);const completed=answers.filter(Boolean).length;const livePoints=Math.round(completed/questions.length*20);const toggle=i=>setAnswers(a=>a.map((v,j)=>j===i?!v:v));
  const submit=async()=>{const r=await fetch(`${API}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers})});const d=await r.json();setResult(d);onDone()};
  return <section className="panel"><div className="panel-title"><span className="big-icon">{title.slice(0,2)}</span><div><p className="eyebrow dark">DAILY MISSION</p><h2>{title.slice(2)}</h2><p className="muted">{subtitle}</p><span className="date-chip">✨ Fresh questions for today</span></div><div className="live-score"><strong>{livePoints}/20</strong><span>{completed}/{questions.length} done</span></div></div><div className="checklist">{questions.map((q,i)=><label className={`check ${answers[i]?'checked':''}`} key={q}><input type="checkbox" checked={answers[i]} onChange={()=>toggle(i)}/><span>{q}</span></label>)}</div><button className="primary" onClick={submit}>Save Today's Checklist</button>{result&&<div className="result">✅ {result.completed}/{result.total} completed → <b>{result.points}/20 points</b></div>}</section>;
}

function Environment({questions,onDone}){
  const[answers,setAnswers]=useState(Array(questions.length).fill(false));
  const[photo,setPhoto]=useState(null);
  const[preview,setPreview]=useState('');
  const[result,setResult]=useState(null);
  const[loading,setLoading]=useState(false);
  const[aiStatus,setAiStatus]=useState('');
  const[detected,setDetected]=useState(null);
  const completed=answers.filter(Boolean).length;
  const livePoints=Math.min(20,Math.round(completed/questions.length*15)+(photo?5:0));

  const CANDIDATES=[
    'a plastic water bottle','a plastic cup','a plastic shopping bag','a plastic container or box',
    'a plastic bucket','a plastic spoon','a plastic plate','a plastic bowl','a plastic jar','another plastic item'
  ];
  const ITEM_NAMES={
    'a plastic water bottle':'Plastic water bottle','a plastic cup':'Plastic cup','a plastic shopping bag':'Plastic bag',
    'a plastic container or box':'Plastic container','a plastic bucket':'Plastic bucket','a plastic spoon':'Plastic spoon',
    'a plastic plate':'Plastic plate','a plastic bowl':'Plastic bowl','a plastic jar':'Plastic jar','another plastic item':'Plastic item'
  };

  const analyzePhoto=async(file)=>{
    setAiStatus('🤖 Loading Hugging Face image model...');
    try{
      const classifier=await pipeline('zero-shot-image-classification','Xenova/clip-vit-base-patch32');
      setAiStatus('🔎 AI is identifying the plastic item...');
      const output=await classifier(URL.createObjectURL(file), CANDIDATES);
      const best=output?.[0];
      const item=ITEM_NAMES[best?.label] || 'Plastic item';
      const confidence=best?.score!=null?Math.round(best.score*100):null;
      setDetected({item,confidence,label:best?.label});
      setAiStatus(`✅ AI detected: ${item}`);
      return {item,confidence};
    }catch(e){
      console.error(e);
      // Helpful local fallback when the Hugging Face model cannot download.
      // It does not pretend to be AI; it only uses the filename + image shape.
      const objectUrl=URL.createObjectURL(file);
      const fallback=await new Promise(resolve=>{
        const img=new Image();
        img.onload=()=>{
          const ratio=img.height/Math.max(1,img.width);
          const name=(file.name||'').toLowerCase();
          if(/bottle|water/.test(name) || (name.includes('plastic') && ratio>1.25)) resolve('Plastic water bottle');
          else if(/cup|mug/.test(name)) resolve('Plastic cup');
          else if(/bag|cover/.test(name)) resolve('Plastic bag');
          else if(/box|container/.test(name)) resolve('Plastic container');
          else resolve('Plastic item');
          URL.revokeObjectURL(objectUrl);
        };
        img.onerror=()=>{URL.revokeObjectURL(objectUrl);resolve('Plastic item')};
        img.src=objectUrl;
      });
      setDetected({item:fallback,confidence:null});
      setAiStatus(`ℹ️ Hugging Face model unavailable; smart local fallback detected: ${fallback}`);
      return {item:fallback,confidence:null};
    }
  };

  const handlePhoto=async(file)=>{
    if(!file){setPhoto(null);setPreview('');setResult(null);setDetected(null);setAiStatus('');return;}
    setPhoto(file); setResult(null); setDetected(null);
    const url=URL.createObjectURL(file); setPreview(url);
    await analyzePhoto(file);
  };

  const submit=async()=>{
    setLoading(true);
    try{
      let analysis=detected;
      let imageData=''; let mimeType='image/jpeg';
      if(photo){
        mimeType=photo.type||'image/jpeg';
        imageData=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(photo)});
        if(!analysis) analysis = await analyzePhoto(photo);
      }
      const detectedItem=analysis?.item || 'Plastic item';
      const r=await fetch(`${API}/environment`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({answers,imageData,mimeType,detectedItem})
      });
      const d=await r.json();
      if(!r.ok) throw new Error(d.message||'Could not save the mission');
      setResult(d); onDone();
    }catch(e){ setResult({error:e.message||'Could not analyze the photo.'}); }
    finally{setLoading(false)}
  };

  return <section className="panel">
    <div className="panel-title">
      <span className="big-icon">🌱</span>
      <div><p className="eyebrow dark">MISSION 05</p><h2>Plastic Reduction & Environment</h2><p className="muted">Complete today's eco actions and upload a plastic photo. A Hugging Face image model identifies the item and gives a matching craft/reuse idea.</p></div>
      <div className="live-score"><strong>{livePoints}/20</strong><span>live score</span></div>
    </div>
    <div className="checklist">{questions.map((q,i)=><label className={`check ${answers[i]?'checked':''}`} key={q}><input type="checkbox" checked={answers[i]} onChange={()=>setAnswers(a=>a.map((v,j)=>j===i?!v:v))}/><span>{q}</span></label>)}</div>
    <div className="photo-box">
      <div className="photo-title">📸 AI Plastic Reuse Challenge <span>+5 points</span></div>
      <p>Upload a clear photo. <b>No item-name typing is required.</b> The Hugging Face model analyzes the image directly in the browser.</p>
      <input type="file" accept="image/*" onChange={e=>handlePhoto(e.target.files?.[0]||null)}/>
      {photo&&<div className="preview"><img src={preview} alt="Selected plastic item"/><div><b>{photo.name}</b><p className="positive">📷 Photo selected</p><small>{aiStatus||'Preparing AI analysis...'}</small></div></div>}
      {detected&&<div className="ai-detected"><b>🔎 AI detected:</b> {detected.item}{detected.confidence!=null&&<span> · {detected.confidence}% confidence</span>}</div>}
    </div>
    <button className="primary" disabled={loading||(!photo&&completed===0)} onClick={submit}>{loading?'🤖 Saving mission...':'✨ Save & Get Craft Idea'}</button>
    {result?.error&&<div className="result warning-result">⚠️ {result.error}</div>}
    {result&&!result.error&&<div className="result"><div>🌱 Score saved: <b>{result.points}/20</b></div>{photo&&<><p>🔎 <b>AI detected:</b> {result.detectedItem}</p>{result.confidence!=null&&<p>📊 <b>Confidence:</b> {result.confidence}%</p>}<h4>🎨 Craft / Reuse Ideas for This Item</h4><p className="craft-ideas">{result.craftIdea}</p><small>{result.aiUsed?'🤗 Hugging Face image model was used in the browser.':'ℹ️ Local craft mapping was used.'}</small></>}</div>}
  </section>;
}
function Alerts({alerts}){return <section className="panel"><div className="panel-title"><span className="big-icon">🔔</span><div><p className="eyebrow dark">HISTORY</p><h2>Alert History</h2><p className="muted">Mobile and cyber alerts are stored here.</p></div></div>{alerts.length===0?<div className="empty">🎉 No alerts today. Keep it up!</div>:alerts.map(a=><div className="alert" key={a.id}><div><b>{a.type}</b><p>{a.message}</p></div><span>{a.time}</span></div>)}</section>}
function History({history=[]}){return <section className="panel"><div className="panel-title"><span className="big-icon">📊</span><div><p className="eyebrow dark">PROGRESS</p><h2>Daily Score History</h2><p className="muted">Every new day starts from 0/100.</p></div></div>{history.length===0?<div className="empty">Your completed days will appear here.</div>:<div className="history-list">{history.map((h,i)=><div className="history-row" key={`${h.date}-${i}`}><div><b>{h.date}</b><span>{h.status}</span></div><strong>{h.total}/100</strong><div className="history-bar"><span style={{width:`${h.total}%`}}/></div></div>)}</div>}</section>}
createRoot(document.getElementById('root')).render(<App/>);
