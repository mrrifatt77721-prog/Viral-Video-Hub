const express = require('express');
const multer = require('multer');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-password';
const WEBAPP_URL = process.env.WEBAPP_URL || '';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'db.json');
const initial = { videos: [], ad: { enabled: false, title: 'Sponsored', text: 'Your advertisement can appear here.', url: '' }, adViews: 0, videoViews: 0 };
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
function readDB() {
  try { return { ...initial, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
  catch { return { ...initial }; }
}
function writeDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10).replace(/[^.a-zA-Z0-9]/g, '');
    cb(null, Date.now() + '-' + crypto.randomBytes(5).toString('hex') + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

function adminOnly(req, res, next) {
  const sent = (req.headers['x-admin-password'] || '').toString();
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD === 'change-this-password' || sent !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Admin password is incorrect or not configured. Set ADMIN_PASSWORD in your environment.' });
  }
  next();
}
function safeVideo(v) {
  return { id: v.id, title: v.title, description: v.description || '', category: v.category || 'Other',
    url: v.url, type: v.type || 'link', createdAt: v.createdAt, views: v.views || 0 };
}
app.get('/api/config', (_req, res) => {
  const db = readDB();
  res.json({ ad: db.ad.enabled ? db.ad : null });
});
app.get('/api/videos', (_req, res) => {
  const db = readDB();
  res.json(db.videos.slice().sort((a,b) => b.createdAt - a.createdAt).map(safeVideo));
});
app.post('/api/videos/:id/view', (req, res) => {
  const db = readDB();
  const v = db.videos.find(x => x.id === req.params.id);
  if (v) { v.views = (v.views || 0) + 1; db.videoViews++; writeDB(db); }
  res.json({ ok: true });
});
app.post('/api/ads/view', (_req, res) => {
  const db = readDB(); db.adViews++; writeDB(db); res.json({ ok: true });
});
app.get('/api/profile', (req, res) => {
  // Telegram WebApp profile data is displayed client-side. Do not treat client-supplied IDs as verified identity.
  res.json({ note: 'Telegram profile details are supplied by the Mini App client. Add Telegram initData signature validation before using identity for sensitive actions.' });
});

app.get('/api/admin/summary', adminOnly, (_req, res) => {
  const db = readDB();
  res.json({ videoCount: db.videos.length, videoViews: db.videoViews, adViews: db.adViews, ad: db.ad, videos: db.videos.map(safeVideo) });
});
app.post('/api/admin/videos', adminOnly, upload.single('file'), (req, res) => {
  const db = readDB();
  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Video title is required.' });
  let url = (req.body.url || '').trim();
  let type = 'link';
  if (req.file) { url = '/uploads/' + req.file.filename; type = 'upload'; }
  if (!url) return res.status(400).json({ error: 'Paste a video URL or upload a video file.' });
  if (type === 'link' && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'URL must start with http:// or https://.' });
  const item = { id: crypto.randomUUID(), title, description: (req.body.description || '').trim(),
    category: (req.body.category || 'Other').trim(), url, type, createdAt: Date.now(), views: 0 };
  db.videos.push(item); writeDB(db); res.json({ ok: true, video: safeVideo(item) });
});
app.put('/api/admin/videos/:id', adminOnly, (req, res) => {
  const db = readDB(); const v = db.videos.find(x => x.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'Video not found.' });
  for (const k of ['title','description','category']) if (typeof req.body[k] === 'string') v[k] = req.body[k].trim();
  writeDB(db); res.json({ ok: true, video: safeVideo(v) });
});
app.delete('/api/admin/videos/:id', adminOnly, (req, res) => {
  const db = readDB(); const index = db.videos.findIndex(x => x.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Video not found.' });
  const [v] = db.videos.splice(index, 1);
  if (v.type === 'upload' && v.url.startsWith('/uploads/')) {
    const file = path.join(UPLOAD_DIR, path.basename(v.url));
    try { fs.unlinkSync(file); } catch {}
  }
  writeDB(db); res.json({ ok: true });
});
app.put('/api/admin/ad', adminOnly, (req, res) => {
  const db = readDB();
  const url = (req.body.url || '').trim();
  if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Ad URL must start with http:// or https://.' });
  db.ad = { enabled: !!req.body.enabled, title: (req.body.title || 'Sponsored').trim(),
    text: (req.body.text || '').trim(), url };
  writeDB(db); res.json({ ok: true, ad: db.ad });
});

if (BOT_TOKEN) {
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const opts = WEBAPP_URL
      ? { reply_markup: { inline_keyboard: [[{ text: '▶ Open Video App', web_app: { url: WEBAPP_URL } }]] } }
      : {};
    const text = WEBAPP_URL
      ? 'Welcome! Tap below to open the video mini app.'
      : 'Bot is running, but WEBAPP_URL is not configured yet. Set it to your deployed HTTPS app URL.';
    bot.sendMessage(chatId, text, opts).catch(console.error);
  });
  bot.on('polling_error', e => console.error('Telegram polling error:', e.message));
} else {
  console.log('BOT_TOKEN not set: web app works, but Telegram bot polling is disabled.');
}

app.listen(PORT, () => console.log(`Mini App server listening on port ${PORT}`));