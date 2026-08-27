const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data.json');
const MOBILE_TARGET = 60;

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'admin@socialcare.local').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'admin123');

const QUESTION_BANKS = {
  health: [
    'Did you wake up at a healthy time today?', 'Did you brush your teeth twice today?', 'Did you take a bath today?',
    'Did you drink enough water today?', 'Did you eat a balanced breakfast?', 'Did you include a protein-rich food today?',
    'Did you eat at least one fruit today?', 'Did you eat vegetables today?', 'Did you get 5–10 minutes of sunlight?',
    'Did you do at least 15 minutes of physical activity?', 'Did you wash your hands before eating?', 'Did you keep your nails and hands clean?',
    'Did you avoid too many sugary drinks today?', 'Did you avoid excessive junk food today?', 'Did you take a short break after long screen use?',
    'Did you get enough sleep last night?', 'Did you keep your study area clean?', 'Did you include a calcium-rich food such as milk or curd?',
    'Did you spend some time reading or studying today?', 'Did you maintain good posture while studying?', 'Did you wash your face after outdoor activities?',
    'Did you keep your personal items clean?', 'Did you spend some time away from screens today?', 'Did you choose a healthy snack today?',
    'Did you avoid skipping a main meal?', 'Did you practice good cough and sneeze hygiene?', 'Did you keep your room reasonably clean today?',
    'Did you do a relaxing activity before bedtime?', 'Did you refill your water bottle today?'
  ],
  food: [
    'Did you avoid wasting food today?', 'Did you take only the amount of food you needed?', 'Did you finish the food on your plate?',
    'Did you store edible leftovers safely?', 'Did you share extra food with someone who needed it?', 'Did you avoid throwing away edible food?',
    'Did you include a protein source in a meal?', 'Did you include a fiber-rich food today?', 'Did you eat a fruit or vegetable with a meal?',
    'Did you check the quantity before serving yourself?', 'Did you check the expiry date when needed?', 'Did you avoid unnecessary food purchases?',
    'Did you use leftovers creatively instead of discarding them?', 'Did you keep food covered and protected from contamination?',
    'Did you choose seasonal or locally available food when practical?', 'Did you avoid wasting water while washing food?',
    'Did you plan your meal before taking food?', 'Did you separate edible leftovers from unavoidable waste?',
    'Did you avoid taking more food just because it was available?', 'Did you keep the dining area clean after eating?',
    'Did you encourage someone else not to waste food?', 'Did you eat slowly enough to notice when you were full?',
    'Did you avoid wasting packaged snacks?', 'Did you use a reusable lunch box today?'
  ],
  environment: [
    'Did you avoid single-use plastic today?', 'Did you carry a reusable water bottle?', 'Did you use a reusable shopping bag?',
    'Did you put plastic waste in the correct bin?', 'Did you reuse an item instead of throwing it away?', 'Did you avoid unnecessary plastic packaging?',
    'Did you switch off lights or fans when they were not needed?', 'Did you save water today?', 'Did you care for a plant or tree?',
    'Did you keep your surroundings clean?', 'Did you avoid buying a plastic item you did not need?', 'Did you reuse a container for storage?',
    'Did you choose a reusable pen, cup or lunch box?', 'Did you pick up a small amount of litter safely?', 'Did you separate recyclable waste?',
    'Did you repair or reuse something instead of replacing it?', 'Did you use both sides of paper where appropriate?', 'Did you avoid littering outdoors?',
    'Did you encourage a friend or family member to reduce plastic?', 'Did you take part in a small eco-friendly activity?'
  ]
};

function today() { return new Date().toISOString().slice(0, 10); }
function daySeed(date) { return [...date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); }
function pickQuestions(type, date) {
  const bank = QUESTION_BANKS[type];
  const seed = daySeed(`${date}-${type}`);
  const arr = bank.map((q, i) => ({ q, n: (seed * (i + 11) + i * i * 17) % 100000 })).sort((a, b) => a.n - b.n);
  const count = type === 'health' ? 15 : type === 'food' ? 12 : 10;
  return arr.slice(0, count).map(x => x.q);
}
function blankScore() { return { mobile: 0, cyber: 0, health: 0, food: 0, environment: 0 }; }
function newUser({ name, email, passwordHash }) {
  return {
    id: crypto.randomUUID(), name, email, passwordHash,
    currentDate: today(), score: blankScore(), mobileMinutes: 0, mobileConnected: false,
    alerts: [], history: [], streak: 0, cyberHistory: [], dailyQuestions: {}
  };
}
function load() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { users: [] };
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (Array.isArray(raw.users)) return raw;
    return { users: [] }; // old single-user data is intentionally not shared between students
  } catch { return { users: [] }; }
}
let db = load();
function save() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
function findUserByEmail(email) { return db.users.find(u => u.email === String(email).trim().toLowerCase()); }
function safeUser(u) { return { id: u.id, name: u.name, email: u.email }; }
function ensureToday(user) {
  const d = today();
  if (user.currentDate !== d) {
    const total = Object.values(user.score).reduce((a, b) => a + b, 0);
    const status = total >= 80 ? 'GOOD' : total >= 50 ? 'AVERAGE' : 'NEEDS IMPROVEMENT';
    if (user.currentDate) user.history.unshift({ date: user.currentDate, total, status, score: { ...user.score } });
    user.history = user.history.slice(0, 30);
    user.streak = total >= 80 ? user.streak + 1 : 0;
    user.currentDate = d;
    user.score = blankScore(); user.mobileMinutes = 0; user.mobileConnected = false;
    user.alerts = []; user.dailyQuestions = {}; user.cyberHistory = [];
    save();
  }
}
function getDailyQuestions(user) {
  ensureToday(user);
  if (!user.dailyQuestions.health) user.dailyQuestions.health = pickQuestions('health', user.currentDate);
  if (!user.dailyQuestions.food) user.dailyQuestions.food = pickQuestions('food', user.currentDate);
  if (!user.dailyQuestions.environment) user.dailyQuestions.environment = pickQuestions('environment', user.currentDate);
  save(); return user.dailyQuestions;
}
function dashboard(user) {
  ensureToday(user);
  const total = Object.values(user.score).reduce((a, b) => a + b, 0);
  return {
    user: safeUser(user), date: user.currentDate, score: user.score, mobileMinutes: user.mobileMinutes || 0,
    mobileTarget: MOBILE_TARGET, mobileConnected: Boolean(user.mobileConnected), total,
    status: total >= 80 ? 'GOOD' : total >= 50 ? 'AVERAGE' : 'NEEDS IMPROVEMENT',
    alerts: user.alerts, history: user.history, streak: user.streak, dailyQuestions: getDailyQuestions(user)
  };
}

const sessions = new Map();
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(String(password), salt, 64, (err, derived) => err ? reject(err) : resolve(`${salt}:${derived.toString('hex')}`)));
}
function verifyPassword(password, stored) {
  return new Promise(resolve => {
    const [salt, hex] = String(stored || '').split(':');
    if (!salt || !hex) return resolve(false);
    crypto.scrypt(String(password), salt, 64, (err, derived) => {
      if (err) return resolve(false);
      const a = Buffer.from(hex, 'hex'), b = Buffer.from(derived.toString('hex'), 'hex');
      resolve(a.length === b.length && crypto.timingSafeEqual(a, b));
    });
  });
}
async function requireAuth(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = sessions.get(token);
  if (!session) return res.status(401).json({ message: 'Please log in again.' });
  req.auth = session;
  if (session.role === 'student') {
    req.user = db.users.find(u => u.id === session.userId);
    if (!req.user) return res.status(401).json({ message: 'Student account not found.' });
    ensureToday(req.user);
  }
  next();
}
function requireAdmin(req, res, next) { if (req.auth?.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' }); next(); }

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !email || password.length < 6) return res.status(400).json({ message: 'Name, email and a password of at least 6 characters are required.' });
  if (findUserByEmail(email)) return res.status(409).json({ message: 'An account with this email already exists.' });
  const passwordHash = await hashPassword(password);
  const user = newUser({ name, email, passwordHash });
  db.users.push(user); save();
  const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { role: 'student', userId: user.id });
  res.json({ token, role: 'student', user: safeUser(user) });
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = findUserByEmail(email);
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { role: 'admin' });
    return res.json({ token, role: 'admin', user: { name: 'Administrator', email: ADMIN_EMAIL } });
  }
  if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password.' });
  ensureToday(user);
  const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { role: 'student', userId: user.id });
  res.json({ token, role: 'student', user: safeUser(user) });
});

// Explicit admin-only login endpoint. Admin credentials are never shown in the frontend.
app.post('/api/auth/admin-login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Invalid admin email or password.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { role: 'admin' });
  res.json({ token, role: 'admin', user: { name: 'Administrator', email: ADMIN_EMAIL } });
});
app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''); sessions.delete(token); res.json({ ok: true });
});
app.get('/api/auth/me', requireAuth, (req, res) => {
  if (req.auth.role === 'admin') return res.json({ role: 'admin', user: { name: 'Administrator', email: ADMIN_EMAIL } });
  res.json({ role: 'student', user: safeUser(req.user) });
});

app.get('/api/dashboard', requireAuth, (req, res) => {
  if (req.auth.role !== 'student') return res.status(403).json({ message: 'Student dashboard only.' });
  res.json(dashboard(req.user));
});
app.get('/api/admin/students', requireAuth, requireAdmin, (req, res) => {
  const students = db.users.map(u => {
    ensureToday(u);
    const total = Object.values(u.score).reduce((a, b) => a + b, 0);
    return { id: u.id, name: u.name, email: u.email, total, score: u.score, mobileMinutes: u.mobileMinutes || 0, mobileTarget: MOBILE_TARGET,
      status: total >= 80 ? 'GOOD' : total >= 50 ? 'AVERAGE' : 'NEEDS IMPROVEMENT', date: u.currentDate };
  });
  res.json({ students, count: students.length, mobileTarget: MOBILE_TARGET });
});

function checklist(user, res, key, type, answers) {
  ensureToday(user); const questions = getDailyQuestions(user)[type];
  const completed = Array.isArray(answers) ? answers.slice(0, questions.length).filter(Boolean).length : 0;
  const points = Math.round(completed / questions.length * 20);
  user.score[key] = Math.max(0, Math.min(20, points)); save();
  res.json({ points: user.score[key], completed, total: questions.length, date: user.currentDate });
}
app.post('/api/health', requireAuth, (req, res) => { if (req.auth.role !== 'student') return res.sendStatus(403); checklist(req.user, res, 'health', 'health', req.body.answers); });
app.post('/api/food', requireAuth, (req, res) => { if (req.auth.role !== 'student') return res.sendStatus(403); checklist(req.user, res, 'food', 'food', req.body.answers); });

function craftIdea(item) {
  const s = String(item || '').toLowerCase();
  if (s.includes('bottle')) return {
    title: 'Bottle Planter',
    description: 'Reuse a clean plastic bottle as a small planter for a plant or herb.',
    materials: ['Clean plastic bottle', 'Soil', 'Small plant or seeds', 'Decorative paper or stickers'],
    procedure: ['Clean and dry the bottle.', 'With adult help if cutting is needed, prepare the bottle as a planter.', 'Add soil and place the small plant or seeds inside.', 'Decorate the outside with paper or stickers.', 'Place the planter in a suitable spot and care for the plant.']
  };
  if (s.includes('cup')) return {
    title: 'Cup Organizer',
    description: 'Turn a clean plastic cup into a simple desk organizer for pens and small stationery.',
    materials: ['Clean plastic cup', 'Decorative paper or stickers', 'Glue', 'Pens or stationery'],
    procedure: ['Wash and dry the cup.', 'Cover or decorate the outside with paper or stickers.', 'Secure the decoration with glue if needed.', 'Let it dry completely.', 'Use the cup to organize pens and small stationery.']
  };
  if (s.includes('container') || s.includes('box')) return {
    title: 'Storage Organizer',
    description: 'Reuse a clean plastic container as an organizer for stationery, cables, seeds or craft supplies.',
    materials: ['Clean plastic container or box', 'Labels or stickers', 'Decorative paper', 'Glue'],
    procedure: ['Clean and dry the container.', 'Remove or cover old labels if needed.', 'Add a simple label for the items you want to store.', 'Decorate the outside if desired.', 'Use it to keep small items organized.']
  };
  if (s.includes('bag')) return {
    title: 'Reuse Pouch',
    description: 'Clean and reuse a suitable plastic bag as a lightweight pouch or organizer.',
    materials: ['Clean plastic bag', 'Decorative paper or stickers', 'Glue or tape', 'Label'],
    procedure: ['Clean the bag and let it dry.', 'Choose what small, lightweight items it will hold.', 'Fold the bag neatly to form a simple pouch shape.', 'Secure or decorate it with suitable paper, tape or stickers.', 'Label it and use it for lightweight storage.']
  };
  if (s.includes('spoon')) return {
    title: 'Garden Marker',
    description: 'Reuse a clean plastic spoon as a simple plant label.',
    materials: ['Clean plastic spoon', 'Marker pen', 'Small piece of paper or label'],
    procedure: ['Clean and dry the spoon.', 'Write the plant name on a small label or directly where appropriate.', 'Attach the label securely.', 'Place the marker near the matching plant.']
  };
  if (s.includes('plate') || s.includes('bowl')) return {
    title: 'Seed Tray / Decor',
    description: 'Reuse a clean plastic plate or bowl as a seed tray or decorative craft base.',
    materials: ['Clean plastic plate or bowl', 'Soil and seeds, or craft decorations', 'Labels or stickers'],
    procedure: ['Clean and dry the plate or bowl.', 'For a seed tray, add a small amount of soil and seeds.', 'For decoration, arrange safe craft materials on the surface.', 'Label the tray if needed.', 'Keep the finished item in a suitable place.']
  };
  if (s.includes('bucket')) return {
    title: 'Planter Bucket',
    description: 'Reuse a clean plastic bucket as a planter or storage container.',
    materials: ['Clean plastic bucket', 'Soil and a plant, or storage items', 'Labels or decorations'],
    procedure: ['Clean and dry the bucket.', 'Choose whether it will be used for a plant or storage.', 'For a planter, add suitable soil and a small plant.', 'Decorate or label the bucket if desired.', 'Place it in a safe and suitable location.']
  };
  if (s.includes('jar')) return {
    title: 'Desk Organizer',
    description: 'Reuse a clean plastic jar or container for stationery and craft supplies.',
    materials: ['Clean plastic jar/container', 'Labels or stickers', 'Decorative paper', 'Glue'],
    procedure: ['Clean and dry the jar.', 'Choose the small items it will organize.', 'Decorate it with paper or stickers if desired.', 'Add a label.', 'Use it to store stationery or craft supplies.']
  };
  return {
    title: 'Plastic Reuse Organizer',
    description: 'Reuse the clean plastic item as a simple organizer instead of throwing it away.',
    materials: ['Clean plastic item', 'Labels or stickers', 'Decorative paper', 'Glue if needed'],
    procedure: ['Clean and dry the item.', 'Decide what small, lightweight items it can safely hold.', 'Decorate or label it if desired.', 'Let any glue dry completely.', 'Reuse it as an organizer.']
  };
}
function normalizeHFLabel(label) { return String(label || '').toLowerCase().replace(/[_-]/g, ' '); }
function mapPlasticItem(labels) {
  const text = labels.map(x => normalizeHFLabel(x.label)).join(' ');
  const rules = [
    [['water bottle','bottle'], 'Plastic water bottle'], [['cup','coffee cup','drinking cup','mug'], 'Plastic cup'],
    [['bucket','pail'], 'Plastic bucket'], [['bag','plastic bag','shopping bag'], 'Plastic bag'],
    [['spoon','ladle'], 'Plastic spoon'], [['plate','dish'], 'Plastic plate'], [['bowl'], 'Plastic bowl'],
    [['jar','canister'], 'Plastic jar/container'], [['box','carton','container'], 'Plastic container/box']
  ];
  for (const [needles, name] of rules) if (needles.some(n => text.includes(n))) return name;
  return labels[0]?.label ? `Possible item: ${labels[0].label}` : 'Plastic item';
}
async function hfImageSuggestion(imageData, mimeType) {
  const token = process.env.HF_TOKEN; const model = process.env.HF_IMAGE_MODEL || 'google/vit-base-patch16-224';
  if (!token || !imageData) return null;
  try {
    const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, { method:'POST', headers:{Authorization:`Bearer ${token}`,'Content-Type':mimeType||'image/jpeg'}, body:Buffer.from(imageData,'base64') });
    if (!response.ok) return null; const output = await response.json();
    if (!Array.isArray(output)) return null; const labels = output.map(x=>({label:x.label,score:x.score}));
    const detectedItem = mapPlasticItem(labels); return { detectedItem, confidence: labels[0]?.score ? Math.round(labels[0].score*100) : null, labels: labels.slice(0,5), craftIdea: craftIdea(detectedItem) };
  } catch { return null; }
}
app.post('/api/environment', requireAuth, async (req, res) => {
  if (req.auth.role !== 'student') return res.sendStatus(403);
  const user=req.user; ensureToday(user); const questions=getDailyQuestions(user).environment;
  const answers=Array.isArray(req.body.answers)?req.body.answers:[]; const completed=answers.slice(0,questions.length).filter(Boolean).length;
  const hasPhoto=Boolean(req.body.imageData); const bonus=hasPhoto?5:0; const points=Math.min(20,Math.round(completed/questions.length*15)+bonus);
  const rawImage=String(req.body.imageData||'').replace(/^data:[^;]+;base64,/,''); const mimeType=String(req.body.mimeType||'image/jpeg');
  const ai=await hfImageSuggestion(rawImage,mimeType); const clientDetected=String(req.body.detectedItem||'').trim();
  const item=clientDetected&&clientDetected!=='Plastic item'?clientDetected:(ai?.detectedItem||'Plastic item');
  user.score.environment=points; save();
  res.json({points,completed,total:questions.length,photoBonus:bonus,detectedItem:item,confidence:ai?.confidence||null,labels:ai?.labels||[],craftIdea:ai?.craftIdea||craftIdea(item),aiUsed:Boolean(ai||clientDetected),aiProvider:ai?'Hugging Face Inference API':'Browser model / local mapping'});
});

function addMobileAlert(user, minutes) {
  const date=today();
  if (user.alerts.some(a=>a.type==='📱 Mobile Usage' && a.date===date)) return;
  user.alerts.unshift({id:Date.now(),date,type:'📱 Mobile Usage',message:`Your mobile usage crossed the ${MOBILE_TARGET}-minute daily target (${minutes} minutes). Today's mobile points are lost.`,time:new Date().toLocaleString()});
}
function updateMobile(user, minutes) {
  ensureToday(user); const m=Math.max(0,Math.floor(Number(minutes)||0)); user.mobileMinutes=m; user.mobileConnected=true;
  const exceeded=m>MOBILE_TARGET; user.score.mobile=m===0?0:(exceeded?0:20); if(exceeded)addMobileAlert(user,m); save();
  return {minutes:m,exceeded,points:user.score.mobile,target:MOBILE_TARGET};
}
app.post('/api/mobile', requireAuth, (req,res)=>{ if(req.auth.role!=='student')return res.sendStatus(403); res.json(updateMobile(req.user,req.body.minutes)); });
app.post('/api/mobile/device', requireAuth, (req,res)=>{ if(req.auth.role!=='student')return res.sendStatus(403); res.json({ok:true,...updateMobile(req.user,req.body.screenOnMinutes)}); });

function analyseMessage(text) {
  const lower=text.toLowerCase(); let risk=0; const reasons=[]; const add=(p,r)=>{risk+=p;reasons.push(r)};
  if(/\b(won|winner|congratulations|selected)\b/.test(lower))add(22,'It makes an unexpected prize, winner or selection claim.');
  if(/\b(prize|reward|cash|₹|rs\.?\s?\d+|\$\d+)\b/.test(lower))add(20,'It mentions money, a reward or a prize.');
  if(/\b(urgent|immediately|today|expire|expires|limited time|act now)\b/.test(lower))add(18,'It creates urgency or a deadline.');
  if(/(https?:\/\/|www\.|bit\.ly|tinyurl|t\.co)/.test(lower))add(20,'It contains a link that should be verified before opening.');
  if(/\b(click|tap|open|visit)\b.{0,35}\b(link|url|here)\b|\b(click here|tap here)\b/.test(lower))add(12,'It asks you to click or open something.');
  if(/\b(otp|one[- ]time password|password|pin|cvv|card number|bank details|verify your account|personal details)\b/.test(lower))add(25,'It asks for sensitive information.');
  if(/\b(account suspended|account blocked|kyc|security alert|verify now)\b/.test(lower))add(20,'It uses account or security pressure.');
  if(/\b(lottery|jackpot|free money|gift card)\b/.test(lower))add(25,'It uses a common giveaway or lottery scam pattern.');
  if(/\b(send money|pay now|transfer|upi|fee)\b/.test(lower))add(22,'It requests payment or money transfer.');
  risk=Math.min(100,risk); const level=risk>=70?'VERY HIGH':risk>=50?'HIGH':risk>=30?'MEDIUM':'LOW';
  const verdict=risk>=30?'⚠️ POSSIBLE SPAM / PHISHING':'✅ NO STRONG SPAM INDICATORS';
  return {risk,level,verdict,reasons:reasons.length?reasons:['No strong spam or phishing indicators were detected.'],meaning:explainMeaning(text,risk),advice:risk>=30?'Do not click unexpected links or share OTPs, passwords, bank details or money. Verify through the organisation’s official app or website.':'The message does not show strong scam indicators, but verify unexpected information independently.'};
}
function explainMeaning(text,risk){const lower=text.toLowerCase();const date=text.match(/\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/);if(/recharge|mobile recharge/.test(lower))return `In simple words: the sender is talking about a mobile recharge or plan${date?` around ${date[0]}`:''}. Confirm it in your operator's official app before paying.`;if(/bill|payment|due/.test(lower))return `In simple words: the message says a bill or payment may be due${date?` around ${date[0]}`:''}. Confirm the amount and date using the official service.`;if(/delivery|parcel|order/.test(lower))return 'In simple words: the message appears to be about a delivery or order. Check the official shopping or courier app before acting.';if(risk>=70)return 'In simple words: the sender is strongly trying to make you act, pay or share information. Treat it as a likely scam.';if(risk>=30)return 'In simple words: the message has warning signs. Verify the claim before clicking, paying or sharing information.';return 'In simple words: the message looks mainly informational based on the text provided. Still verify unexpected requests.';}
app.post('/api/cyber/analyse', requireAuth, (req,res)=>{if(req.auth.role!=='student')return res.sendStatus(403);const text=String(req.body.text||'').trim();if(!text)return res.status(400).json({message:'Please enter a message.'});const result=analyseMessage(text);req.user.score.cyber=20;req.user.cyberHistory.unshift({id:Date.now(),date:today(),level:result.level,risk:result.risk,verdict:result.verdict});req.user.cyberHistory=req.user.cyberHistory.slice(0,20);if(result.risk>=30)req.user.alerts.unshift({id:Date.now(),date:today(),type:'🛡️ Cyber Awareness',message:`Possible suspicious message detected: ${result.level} risk (${result.risk}/100).`,time:new Date().toLocaleString()});save();res.json({...result,points:20});});
app.get('/api/healthcheck',(req,res)=>res.json({ok:true,date:today()}));
app.listen(PORT,()=>console.log(`SocialCare API running on http://localhost:${PORT}`));
