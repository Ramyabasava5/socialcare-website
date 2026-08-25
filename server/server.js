const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data.json');

const QUESTION_BANKS = {
  health: [
    'Did you wake up at a healthy time today?', 'Did you brush your teeth twice today?', 'Did you take a bath today?',
    'Did you drink enough water today?', 'Did you eat a balanced breakfast?', 'Did you include a protein-rich food today?',
    'Did you eat at least one fruit today?', 'Did you eat vegetables today?', 'Did you get 5–10 minutes of sunlight?',
    'Did you do at least 15 minutes of physical activity?', 'Did you wash your hands before eating?', 'Did you keep your nails and hands clean?',
    'Did you avoid too many sugary drinks today?', 'Did you avoid excessive junk food today?', 'Did you take a short break after long screen use?',
    'Did you get enough sleep last night?', 'Did you keep your study area clean?', 'Did you drink water instead of skipping hydration?',
    'Did you include a calcium-rich food such as milk or curd?', 'Did you spend some time reading or studying today?',
    'Did you maintain good posture while studying?', 'Did you wash your face after outdoor activities?', 'Did you keep your personal items clean?',
    'Did you spend some time away from screens today?', 'Did you choose a healthy snack today?', 'Did you avoid skipping a main meal?',
    'Did you practice good cough and sneeze hygiene?', 'Did you keep your room reasonably clean today?', 'Did you do a relaxing activity before bedtime?',
    'Did you remember to refill your water bottle today?'
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

function fresh() {
  return {
    currentDate: today(),
    score: { mobile: 0, cyber: 0, health: 0, food: 0, environment: 0 },
    mobileMinutes: 0, mobileConnected: false,
    alerts: [], history: [], streak: 0, cyberHistory: [], dailyQuestions: {}
  };
}
function load() { try { return fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : fresh(); } catch { return fresh(); } }
let data = load();
function save() { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function today() { return new Date().toISOString().slice(0, 10); }
function daySeed(date) { return [...date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7); }
function pickQuestions(type, date) {
  const bank = QUESTION_BANKS[type];
  const seed = daySeed(`${date}-${type}`);
  const arr = bank.map((q, i) => ({ q, n: (seed * (i + 11) + i * i * 17) % 100000 })).sort((a, b) => a.n - b.n);
  const count = type === 'health' ? 15 : type === 'food' ? 12 : 10;
  return arr.slice(0, count).map(x => x.q);
}
function ensureToday() {
  const d = today();
  if (data.currentDate !== d) {
    const total = Object.values(data.score).reduce((a, b) => a + b, 0);
    const status = total >= 80 ? 'GOOD' : total >= 50 ? 'AVERAGE' : 'NEEDS IMPROVEMENT';
    data.history.unshift({ date: data.currentDate, total, status });
    data.history = data.history.slice(0, 30);
    data.streak = total >= 80 ? data.streak + 1 : 0;
    data.currentDate = d;
    data.score = { mobile: 0, cyber: 0, health: 0, food: 0, environment: 0 };
    data.mobileMinutes = 0; data.mobileConnected = false;
    data.alerts = [];
    data.dailyQuestions = {};
    save();
  }
}
function getDailyQuestions() {
  ensureToday();
  if (!data.dailyQuestions.health) data.dailyQuestions.health = pickQuestions('health', data.currentDate);
  if (!data.dailyQuestions.food) data.dailyQuestions.food = pickQuestions('food', data.currentDate);
  if (!data.dailyQuestions.environment) data.dailyQuestions.environment = pickQuestions('environment', data.currentDate);
  save();
  return data.dailyQuestions;
}
function dashboard() {
  ensureToday();
  const total = Object.values(data.score).reduce((a, b) => a + b, 0);
  return { date: data.currentDate, score: data.score, mobileMinutes: data.mobileMinutes || 0, mobileConnected: Boolean(data.mobileConnected), total, status: total >= 80 ? 'GOOD' : total >= 50 ? 'AVERAGE' : 'NEEDS IMPROVEMENT', alerts: data.alerts, history: data.history, streak: data.streak, dailyQuestions: getDailyQuestions() };
}

app.get('/api/dashboard', (req, res) => res.json(dashboard()));
app.get('/api/questions', (req, res) => res.json({ date: today(), questions: getDailyQuestions() }));

function checklist(req, res, key, type) {
  ensureToday();
  const questions = getDailyQuestions()[type];
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const completed = answers.slice(0, questions.length).filter(Boolean).length;
  const points = Math.round(completed / questions.length * 20);
  data.score[key] = Math.max(0, Math.min(20, points));
  save();
  res.json({ points: data.score[key], completed, total: questions.length, date: data.currentDate });
}
app.post('/api/health', (req, res) => checklist(req, res, 'health', 'health'));
app.post('/api/food', (req, res) => checklist(req, res, 'food', 'food'));

function craftIdea(item) {
  const s = String(item || '').toLowerCase();
  if (s.includes('water bottle') || s.includes('bottle')) return '🎨 Bottle Planter: Clean the bottle and reuse it as a small planter. Other suitable ideas: bird feeder, pencil holder, self-watering planter, or drip-irrigation bottle.';
  if (s.includes('cup')) return '🎨 Cup Organizer: Clean the cup and turn it into a pencil/pen holder. Other ideas: mini planter, seed starter, hanging decoration, or desk organizer.';
  if (s.includes('container') || s.includes('box')) return '🎨 Storage Organizer: Reuse the container as a stationery, cable, seed, or craft-supply organizer. It can also become a small plant pot.';
  if (s.includes('bag')) return '🎨 Reuse Pouch: Clean and reuse the bag as a lightweight storage/organizer pouch. Avoid burning or unsafe cutting.';
  if (s.includes('spoon')) return '🎨 Garden Marker: Clean the spoon and turn it into a plant label or simple garden marker. It can also be part of a decorative craft.';
  if (s.includes('plate') || s.includes('bowl')) return '🎨 Wall Decor / Seed Tray: Clean the item and reuse it as a decorative craft base, seed tray, paint palette, or small organizer.';
  if (s.includes('bucket')) return '🎨 Planter Bucket: Clean the bucket and reuse it as a planter or storage container. Any drilling or cutting should be done by an adult.';
  if (s.includes('jar')) return '🎨 Desk Organizer: Reuse the jar for stationery or craft supplies. It can also become a mini planter.';
  return '🎨 Reuse idea: The image could not be identified confidently. Try a clear photo showing the complete plastic item. The app will give a specific idea when the item is recognized.';
}

function normalizeHFLabel(label) {
  return String(label || '').toLowerCase().replace(/[_-]/g, ' ');
}

function mapPlasticItem(labels) {
  const text = labels.map(x => normalizeHFLabel(x.label)).join(' ');
  const rules = [
    [['water bottle', 'water bottle', 'bottle'], 'Plastic water bottle'],
    [['cup', 'coffee cup', 'drinking cup', 'mug'], 'Plastic cup'],
    [['bucket', 'pail'], 'Plastic bucket'],
    [['bag', 'plastic bag', 'shopping bag', 'purse'], 'Plastic bag/container'],
    [['spoon', 'ladle'], 'Plastic spoon'],
    [['plate', 'dish'], 'Plastic plate'],
    [['bowl'], 'Plastic bowl'],
    [['jar', 'canister'], 'Plastic jar/container'],
    [['box', 'carton', 'container'], 'Plastic container/box']
  ];
  for (const [needles, name] of rules) if (needles.some(n => text.includes(n))) return name;
  return labels[0]?.label ? `Possible item: ${labels[0].label}` : 'Plastic item';
}

async function hfImageSuggestion(imageData, mimeType) {
  const token = process.env.HF_TOKEN;
  if (!token || !imageData) return null;
  const model = process.env.HF_IMAGE_MODEL || 'google/vit-base-patch16-224';
  const url = `https://router.huggingface.co/hf-inference/models/${model}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: imageData, parameters: { top_k: 8 } })
    });
    if (!r.ok) return null;
    const output = await r.json();
    if (!Array.isArray(output)) return null;
    const labels = output.map(x => ({ label: x.label, score: x.score }));
    const detectedItem = mapPlasticItem(labels);
    return {
      detectedItem,
      confidence: labels[0]?.score ? Math.round(labels[0].score * 100) : null,
      labels: labels.slice(0, 5),
      craftIdea: craftIdea(detectedItem)
    };
  } catch { return null; }
}

app.post('/api/environment', async (req, res) => {
  ensureToday();
  const questions = getDailyQuestions().environment;
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const completed = answers.slice(0, questions.length).filter(Boolean).length;
  const hasPhoto = Boolean(req.body.imageData);
  const bonus = hasPhoto ? 5 : 0;
  const points = Math.min(20, Math.round(completed / questions.length * 15) + bonus);

  const rawImage = String(req.body.imageData || '').replace(/^data:[^;]+;base64,/, '');
  const mimeType = String(req.body.mimeType || 'image/jpeg');
  let ai = await hfImageSuggestion(rawImage, mimeType);
  const clientDetected = String(req.body.detectedItem || '').trim();
  let item = clientDetected && clientDetected !== 'Plastic item' ? clientDetected : (ai?.detectedItem || clientDetected || 'Plastic item');
  let suggestion = craftIdea(item);
  if (ai?.craftIdea && !clientDetected) suggestion = ai.craftIdea;

  data.score.environment = points;
  save();
  res.json({
    points, completed, total: questions.length, photoBonus: bonus,
    detectedItem: item,
    confidence: ai?.confidence || null,
    labels: ai?.labels || [],
    craftIdea: suggestion,
    aiUsed: Boolean(clientDetected && clientDetected !== 'Plastic item') || Boolean(ai),
    aiProvider: clientDetected && clientDetected !== 'Plastic item' ? 'Hugging Face Transformers.js (browser)' : (ai ? 'Hugging Face Inference API' : 'Local fallback')
  });
});

function addMobileAlert(minutes) {
  const alert = { id: Date.now(), type: '📱 Mobile Usage', message: `Your screen-on usage crossed the 30-minute daily target (${minutes} minutes).`, time: new Date().toLocaleString() };
  if (!data.alerts.some(a => a.type === alert.type && a.message.includes('crossed') && a.time?.slice(0, 10) === alert.time.slice(0, 10))) data.alerts.unshift(alert);
}
app.post('/api/mobile', (req, res) => {
  ensureToday();
  const minutes = Math.max(0, Number(req.body.minutes || 0));
  data.mobileMinutes = minutes; data.mobileConnected = true;
  const exceeded = minutes > 30;
  // Keep the daily score at 0 until the tracker records some actual usage.
  data.score.mobile = minutes === 0 ? 0 : (exceeded ? 0 : 20);
  if (exceeded) addMobileAlert(minutes);
  save();
  res.json({ minutes, exceeded, points: data.score.mobile, alert: exceeded });
});
// Android companion can call this endpoint continuously. It is independent of the web dashboard page.
app.post('/api/mobile/device', (req, res) => {
  ensureToday();
  const minutes = Math.max(0, Number(req.body.screenOnMinutes || 0));
  data.mobileMinutes = minutes; data.mobileConnected = true;
  const exceeded = minutes > 30;
  // Keep the daily score at 0 until the tracker records some actual usage.
  data.score.mobile = minutes === 0 ? 0 : (exceeded ? 0 : 20);
  if (exceeded) addMobileAlert(minutes);
  save();
  res.json({ ok: true, screenOnMinutes: minutes, exceeded, points: data.score.mobile });
});

function analyseMessage(text) {
  const lower = text.toLowerCase();
  let risk = 0; const reasons = [];
  const add = (points, reason) => { risk += points; reasons.push(reason); };
  if (/\b(won|winner|congratulations|selected)\b/.test(lower)) add(22, 'It makes an unexpected prize, winner or selection claim.');
  if (/\b(prize|reward|cash|₹|rs\.?\s?\d+|\$\d+)\b/.test(lower)) add(20, 'It mentions money, a reward or a prize.');
  if (/\b(urgent|immediately|today|expire|expires|limited time|act now)\b/.test(lower)) add(18, 'It creates urgency or a deadline to make you act quickly.');
  if (/(https?:\/\/|www\.|bit\.ly|tinyurl|t\.co)/.test(lower)) add(20, 'It contains a link that should be verified before opening.');
  if (/\b(click|tap|open|visit)\b.{0,35}\b(link|url|here)\b|\b(click here|tap here)\b/.test(lower)) add(12, 'It asks you to click or open something.');
  if (/\b(otp|one[- ]time password|password|pin|cvv|card number|bank details|verify your account|personal details)\b/.test(lower)) add(25, 'It asks for sensitive account, banking or personal information.');
  if (/\b(account suspended|account blocked|kyc|security alert|verify now)\b/.test(lower)) add(20, 'It uses account or security pressure to make the recipient act.');
  if (/\b(lottery|jackpot|free money|gift card)\b/.test(lower)) add(25, 'It uses a common giveaway or lottery scam pattern.');
  if (/\b(send money|pay now|transfer|upi|fee)\b/.test(lower)) add(22, 'It requests payment or money transfer.');
  if (/(^|\s)(dear customer|dear user)(\s|,)/.test(lower)) add(5, 'It uses a generic greeting instead of identifying the recipient clearly.');
  risk = Math.min(100, risk);
  const level = risk >= 70 ? 'VERY HIGH' : risk >= 50 ? 'HIGH' : risk >= 30 ? 'MEDIUM' : 'LOW';
  const verdict = risk >= 30 ? '⚠️ POSSIBLE SPAM / PHISHING' : '✅ NO STRONG SPAM INDICATORS';
  return { risk, level, verdict, reasons: reasons.length ? reasons : ['No strong spam or phishing indicators were detected.'], meaning: explainMeaning(text, risk), advice: risk >= 30 ? 'Do not click unexpected links or share OTPs, passwords, bank details or money. Verify the message through the official app, website or phone number of the organisation.' : 'The message does not show strong scam indicators, but verify unexpected information independently before taking action.' };
}
function explainMeaning(text, risk) {
  const lower = text.toLowerCase();
  const date = text.match(/\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/);
  if (/recharge|recharge your phone|mobile recharge/.test(lower)) {
    return `In simple words: this message is telling you that your mobile recharge or plan needs attention${date ? ` around ${date[0]}` : ''}. Check your mobile operator's official app or website to confirm the date and recharge only if it is actually due.`;
  }
  if (/bill|payment|due/.test(lower)) return `In simple words: the sender is saying that a bill or payment may be due${date ? ` around ${date[0]}` : ''}. Confirm the amount and due date using the organisation's official app or website instead of trusting a link in the message.`;
  if (/delivery|parcel|order/.test(lower)) return `In simple words: the message appears to be about a delivery or order${date ? ` connected with ${date[0]}` : ''}. Check the order directly in the official shopping or courier app before taking action.`;
  if (/appointment|schedule|meeting/.test(lower)) return `In simple words: the message is giving or changing an appointment or schedule. Check the original organisation or calendar to confirm the time and date.`;
  if (/school|college|class|exam|assignment/.test(lower)) return `In simple words: the message appears to give a school or study-related instruction. Confirm it through your official school/college channel if the message is unexpected.`;
  if (risk >= 70) return 'In simple words: the sender is trying to make you act quickly, click something, pay money, or share information. That combination is strongly associated with scams or phishing.';
  if (risk >= 30) return 'In simple words: the message contains some warning signs. It may be asking for attention, a click, money, or information, so verify the claim before doing anything.';
  return 'In simple words: the message looks mainly informational based on the text provided. Still, verify unexpected requests using an official source.';
}
app.post('/api/cyber/analyse', (req, res) => {
  ensureToday();
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ message: 'Please enter a message.' });
  const result = analyseMessage(text);
  // Cyber activity earns 20 only after an analysis is actually completed.
  data.score.cyber = 20;
  data.cyberHistory.unshift({ id: Date.now(), date: today(), level: result.level, risk: result.risk, verdict: result.verdict });
  data.cyberHistory = data.cyberHistory.slice(0, 20);
  if (result.risk >= 30) data.alerts.unshift({ id: Date.now(), type: '🛡️ Cyber Awareness', message: `Possible suspicious message detected: ${result.level} risk (${result.risk}/100).`, time: new Date().toLocaleString() });
  save();
  res.json({ ...result, points: 20 });
});

app.get('/api/healthcheck', (req, res) => res.json({ ok: true, date: today() }));
app.listen(PORT, () => console.log(`SocialCare API running on http://localhost:${PORT}`));
