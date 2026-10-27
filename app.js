/* دفتر ديون محمود ناجي */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, onSnapshot, query, where, orderBy, limit, getDoc, getDocs, getDocsFromServer, setDoc, updateDoc, writeBatch, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC0uCwr95QSdzf1Un1LnOq6qzpoB5WUdWY',
  authDomain: 'mahmoud-naji-ledger.firebaseapp.com',
  projectId: 'mahmoud-naji-ledger',
  storageBucket: 'mahmoud-naji-ledger.firebasestorage.app',
  messagingSenderId: '545846244655',
  appId: '1:545846244655:web:0501664aced621ff741dda'
};
// SHA-256 of the owner's login email. The email itself lives only in the Firestore rules.
const OWNER_HASH = 'bb7ca11e85c74b7b28be539272ee4a271fcb08d0a77ef9aa0dd29995c58ace88';

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
auth.languageCode = 'ar';
const fs = initializeFirestore(fbApp, {localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})});

/* ---------- constants ---------- */
const ROLES = {owner: 'المدير', supervisor: 'مشرف', staff: 'موظف'};
const PERMS = [
  {k: 'balances', l: 'يشوف كل الأرصدة والمجاميع', s: 'بدونها يشوف رصيد الزبون اللي يفتحه بس.'},
  {k: 'reports', l: 'التقارير وتنزيل الإكسل', s: 'جرد اليوم وتقرير الشهر.'},
  {k: 'edit', l: 'يعدّل الحركات قبل موافقتك', s: 'المبلغ والمادة والتاريخ، وكل تعديل ينكتب بالسجل.'},
  {k: 'customers', l: 'يعدّل بيانات الزبائن', s: 'الاسم والرقم والمنطقة.'},
  {k: 'messages', l: 'يرسل رسائل واتساب للزبائن', s: 'التذكير وكشف الحساب ووصل الدين والتسديد. الرسالة تطلع من واتساب موبايله.'}
];
const PERM_SHORT = {balances: 'الأرصدة', reports: 'التقارير', edit: 'تعديل الحركات', customers: 'بيانات الزبائن', messages: 'رسائل الواتساب'};
const PRESETS = {
  supervisor: {balances: true, reports: true, edit: true, customers: true, messages: false},
  staff: {balances: false, reports: false, edit: false, customers: false, messages: false}
};
const OWNER_ONLY = ['الموافقة والرفض', 'حذف الحركات', 'سقف الدين للزبائن', 'تفعيل الموظفين وصلاحياتهم وشيل حساباتهم'];
const CUR = {IQD: 'د.ع', USD: '$'};
const CUR_WORD = {IQD: 'دينار', USD: 'دولار'};
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const MONTHS_SHORT = ['ك2', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'ت1', 'ت2', 'ك1'];
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const STATUS = {approved: 'مقبولة', pending: 'بانتظار الموافقة', rejected: 'مرفوضة', deleted: 'محذوفة'};
const SHOP_DEFAULT = {name: 'محمود ناجي', phone: '', nextCode: 2};

/* ---------- icons ---------- */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="m9 18 6-6-6-6"/>',
  users: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M21 20v-1.5a4 4 0 0 0-3-3.9M15.5 4.1a3.5 3.5 0 0 1 0 6.8"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5.5 5h13L21 13v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5Z"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-6M3 20h18"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4l2-2Z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  doc: '<path d="M7 3h7l5 5v13H7Z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  wa: '<path d="M4 20l1.3-3.8a8.2 8.2 0 1 1 3 2.9Z"/><path d="M9.3 8.6c.1 3 3 6 6.1 6.1l1.2-1.3-2-1.2-.9.8a5 5 0 0 1-2.6-2.6l.8-.9-1.2-2Z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
  alert: '<path d="M12 9v4M12 16.5h.01"/><path d="M10.3 4 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  shield: '<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  store: '<path d="M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M10 20v-5h4v5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5a8 8 0 0 1 16 0"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4.3 4.3 0 0 1-.5 8.5Z"/><path d="m4 4 16 16"/>',
  phoneapp: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>'
};
const ic = (n, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

/* ---------- utils ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = iso => { const p = String(iso).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const todayISO = () => isoOf(new Date());
const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const toLatin = s => String(s == null ? '' : s).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6F0));
const norm = s => toLatin(s).toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
// st.customers, and so every list of them, is kept in Arabic alphabetical order (ا ب ت ث …);
// أ/إ/آ count as ا, the same as the search, and the area decides between two customers with one name
const AR_ORDER = new Intl.Collator('ar', {numeric: true});
const nameOrder = (a, b) => AR_ORDER.compare(norm(a.name), norm(b.name)) || AR_ORDER.compare(norm(a.note), norm(b.note));
const initial = name => (String(name || '').trim().charAt(0) || '؟');
const noTag = no => `#${no || ''}`;
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
async function sha256(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function fmtNum(n, cur){
  const v = Math.abs(Number(n) || 0);
  if (cur === 'USD') return v.toLocaleString('en-US', {maximumFractionDigits: 2});
  return Math.round(v).toLocaleString('en-US');
}
const amt = (n, cur, cls) => `<span class="amt${cls ? ' ' + cls : ''}">${fmtNum(n, cur)}<span class="cur">${CUR[cur]}</span></span>`;
const amtText = (n, cur) => `${fmtNum(n, cur)} ${CUR[cur]}`;
const amtMsg = (n, cur) => `${fmtNum(n, cur)} ${CUR_WORD[cur]}`;
function parseAmount(s){
  s = toLatin(s).replace(/[,،٬\s]/g, '').replace(/٫/g, '.');
  if (!s) return NaN;
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}
function fmtDate(iso, withYear){
  if (!iso) return '';
  const d = parseISO(iso), y = d.getFullYear();
  const showY = withYear === undefined ? y !== new Date().getFullYear() : withYear;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${showY ? ' ' + y : ''}`;
}
function fmtTime(ts){ const d = new Date(ts); let h = d.getHours(); const ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12; return `${h}:${pad(d.getMinutes())} ${ap}`; }
function daysAr(n){ n = Math.abs(n); if (n === 1) return 'يوم'; if (n === 2) return 'يومين'; if (n <= 10) return `${n} أيام`; return `${n} يوم`; }
function relDay(iso){ const diff = daysBetween(iso, todayISO()); if (diff === 0) return 'اليوم'; if (diff === 1) return 'أمس'; if (diff > 1 && diff < 30) return `قبل ${daysAr(diff)}`; return fmtDate(iso); }
const fmtStamp = ts => { const iso = isoOf(new Date(ts)); const diff = daysBetween(iso, todayISO()); const day = diff === 0 ? 'اليوم' : diff === 1 ? 'أمس' : fmtDate(iso); return `${day}، ${fmtTime(ts)}`; };
const stampISO = ts => { if (!ts) return ''; const d = new Date(ts); return `${isoOf(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function countAr(n, one, two, few, many){ if (n === 1) return one; if (n === 2) return two; if (n >= 3 && n <= 10) return `${n} ${few}`; return `${n} ${many}`; }
function amountWords(n, cur){
  if (!(n > 0)) return '';
  if (cur === 'USD') return `${fmtNum(n, 'USD')} دولار`;
  n = Math.round(n);
  const m = Math.floor(n / 1e6), k = Math.floor((n % 1e6) / 1000), r = n % 1000, parts = [];
  if (m) parts.push(m === 1 ? 'مليون' : m === 2 ? 'مليونين' : `${m.toLocaleString('en-US')} مليون`);
  if (k) parts.push(k === 1 ? 'ألف' : k === 2 ? 'ألفين' : `${k} ألف`);
  if (r) parts.push(String(r));
  return parts.join(' و ') + ' دينار';
}
function dueText(d){ if (d.late) return `متأخر ${daysAr(-d.days)}`; if (d.days === 0) return 'يستحق اليوم'; return `يستحق بعد ${daysAr(d.days)}`; }
const appLink = () => location.origin + location.pathname.replace(/index\.html$/, '');
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

/* ---------- state ---------- */
const st = {
  phase: 'boot', me: null, creating: false, signupName: '', fatal: '',
  users: [], usersById: {}, shop: Object.assign({}, SHOP_DEFAULT),
  customers: [], custById: {}, custReady: false,
  pending: [], cache: new Map(),
  custEntries: null, myPending: [], myRejected: [], today: null, month: null, monthKey: '', logList: null,
  online: navigator.onLine, inflight: 0
};
const ui = {tab: 'customers', view: null, q: '', filter: 'all', reportTab: 'today', monthOffset: 0, scroll: {}, authMode: 'login'};
let sheetState = null;

const me = () => st.me;
const userById = id => st.usersById[id];
const uname = id => (st.usersById[id] || {}).name || 'مستخدم';
const ownerUser = () => st.users.find(u => u.role === 'owner');
const ownerName = () => (ownerUser() || {}).name || 'المدير';
const cust = id => st.custById[id];
const ent = id => st.cache.get(id);
const has = (u, k) => !!u && (u.role === 'owner' || !!(u.perms && u.perms[k]));
const can = {
  seeBalances: u => has(u, 'balances'),
  reports: u => has(u, 'reports'),
  approve: u => !!u && u.role === 'owner',
  editEntry: (u, e) => e.status !== 'deleted' && e.status !== 'rejected' && (u.role === 'owner' || (has(u, 'edit') && e.status === 'pending')),
  deleteEntry: (u, e) => u.role === 'owner' && e.status !== 'deleted',
  editCustomer: u => has(u, 'customers'),
  setLimit: u => !!u && u.role === 'owner',
  message: u => has(u, 'messages')
};

/* ---------- ledger maths ---------- */
const sortChrono = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at || 0) - (b.at || 0);
const effect = e => e.type === 'debt' ? e.amount : -e.amount;
// Payments settle the oldest debts first; the earliest due date among debts still open is the customer's due date.
function summarize(list){
  const approved = list.filter(e => e.status === 'approved').sort(sortChrono);
  const b = {IQD: 0, USD: 0};
  for (const e of approved) b[e.cur] = r2(b[e.cur] + effect(e));
  let due = null;
  for (const cur of ['IQD', 'USD']) {
    const L = approved.filter(e => e.cur === cur);
    let paid = L.filter(e => e.type === 'pay').reduce((s, e) => s + e.amount, 0);
    for (const e of L) {
      if (e.type !== 'debt') continue;
      if (paid >= e.amount) { paid -= e.amount; continue; }
      paid = 0;
      if (e.due && (!due || e.due < due)) due = e.due;
    }
  }
  return {bal: b, due};
}
const custList = cid => st.custEntries && st.custEntries.cid === cid && st.custEntries.loaded ? st.custEntries.list : null;
function bal(cid){
  const L = custList(cid); if (L) return summarize(L).bal;
  const c = cust(cid) || {}; const b = c.bal || {};
  return {IQD: r2(b.IQD || 0), USD: r2(b.USD || 0)};
}
function pend(cid, list){
  const p = {debt: {IQD: 0, USD: 0}, pay: {IQD: 0, USD: 0}, n: 0};
  for (const e of (list || st.pending)) if (e.cid === cid && e.status === 'pending') { p[e.type][e.cur] += e.amount; p.n++; }
  return p;
}
function dueFrom(due, b){ if (!due || !(b.IQD > 0 || b.USD > 0)) return null; const days = daysBetween(todayISO(), due); return {due, days, late: days < 0}; }
function dueInfo(cid){ const L = custList(cid); if (L) { const s = summarize(L); return dueFrom(s.due, s.bal); } return dueFrom((cust(cid) || {}).due, bal(cid)); }
function lastAt(cid){ const c = cust(cid) || {}; let t = c.lastAt || c.createdAt || 0; for (const e of st.pending) if (e.cid === cid && e.at > t) t = e.at; return t; }
function lastCur(cid){
  const L = custList(cid);
  if (L && L.length) return L.slice().sort((a, b) => (b.at || 0) - (a.at || 0))[0].cur;
  const b = bal(cid); return b.USD > 0 && b.IQD <= 0 ? 'USD' : 'IQD';
}
function totals(){
  const t = {IQD: 0, USD: 0, owed: 0, late: 0};
  for (const c of st.customers) {
    const b = bal(c.id);
    if (b.IQD > 0) t.IQD += b.IQD;
    if (b.USD > 0) t.USD += b.USD;
    if (b.IQD > 0 || b.USD > 0) t.owed++;
    const d = dueInfo(c.id); if (d && d.late) t.late++;
  }
  t.USD = r2(t.USD);
  return t;
}
function limitCheck(cid, cur, add, excludeId){
  const c = cust(cid); if (!c) return null;
  const lim = cur === 'IQD' ? c.limitIQD : c.limitUSD;
  if (!lim) return null;
  let pendingDebt = 0;
  const src = custList(cid) || st.pending;
  for (const e of src) if (e.cid === cid && e.status === 'pending' && e.type === 'debt' && e.cur === cur && e.id !== excludeId) pendingDebt += e.amount;
  const projected = r2(bal(cid)[cur] + pendingDebt + add);
  return projected > lim ? {lim, projected, over: r2(projected - lim), cur} : null;
}

/* ---------- writes ---------- */
const col = name => collection(fs, name);
const ref = (name, id) => doc(fs, name, id);
function commit(batch, after){
  st.inflight++;
  batch.commit().then(() => { st.inflight--; if (after) after(); }, err => { st.inflight--; toastErr(err); });
}
function logOf(type, e, extra){
  return Object.assign({at: Date.now(), by: me().id, type,
    eid: e ? e.id || null : null, cid: e ? e.cid : null, cname: e ? ((cust(e.cid) || {}).name || '') : '',
    etype: e ? e.type : null, amount: e ? e.amount : null, cur: e ? e.cur : null, no: e ? e.no || null : null}, extra || {});
}
function nextReceipt(){ const m = me(); const seq = (m.seq || 0) + 1; return {seq, no: `${m.code || 0}-${String(seq).padStart(4, '0')}`}; }
function addEntry(o){
  const m = me(), now = Date.now(), isOwner = m.role === 'owner';
  const r = doc(col('entries')), {seq, no} = nextReceipt();
  const e = {cid: o.cid, no, type: o.type, amount: o.amount, cur: o.cur, note: o.note || '', date: o.date,
    due: o.type === 'debt' ? (o.due || null) : null, by: m.id, at: now, serverAt: serverTimestamp(),
    status: isOwner ? 'approved' : 'pending', edits: []};
  if (o.opening) e.opening = true;
  if (isOwner) { e.approvedBy = m.id; e.approvedAt = now; }
  const full = Object.assign({id: r.id}, e);
  const b = writeBatch(fs);
  b.set(r, e);
  b.update(ref('users', m.id), {seq});
  if (isOwner) b.update(ref('customers', o.cid), {[`bal.${o.cur}`]: increment(effect(e)), lastAt: now});
  b.set(doc(col('log')), logOf('create', full, o.cname ? {cname: o.cname} : null));
  st.me = Object.assign({}, m, {seq});
  commit(b, isOwner ? () => recompute(o.cid) : null);
  return full;
}
function approveEntry(e){
  const m = me(), now = Date.now(), b = writeBatch(fs);
  b.update(ref('entries', e.id), {status: 'approved', approvedBy: m.id, approvedAt: now});
  b.update(ref('customers', e.cid), {[`bal.${e.cur}`]: increment(effect(e)), lastAt: now});
  b.set(doc(col('log')), logOf('approve', e));
  commit(b, () => recompute(e.cid));
  return Object.assign({}, e, {status: 'approved', approvedBy: m.id, approvedAt: now});
}
function rejectEntry(e, reason){
  const m = me(), now = Date.now(), b = writeBatch(fs);
  b.update(ref('entries', e.id), {status: 'rejected', rejectedBy: m.id, rejectedAt: now, reason: reason || ''});
  b.set(doc(col('log')), logOf('reject', e, {reason: reason || ''}));
  commit(b);
}
function editEntry(e, patch){
  const changes = {};
  for (const k of ['amount', 'cur', 'note', 'date', 'due']) if (k in patch && patch[k] !== e[k]) changes[k] = [e[k] === undefined ? null : e[k], patch[k]];
  if (!Object.keys(changes).length) return false;
  const m = me(), now = Date.now();
  const data = {edits: (e.edits || []).concat([{by: m.id, at: now, changes}])};
  for (const k of Object.keys(changes)) data[k] = patch[k];
  const b = writeBatch(fs);
  b.update(ref('entries', e.id), data);
  const ne = Object.assign({}, e, patch);
  if (e.status === 'approved') {
    const inc = {};
    inc[e.cur] = (inc[e.cur] || 0) - effect(e);
    inc[ne.cur] = (inc[ne.cur] || 0) + effect(ne);
    const cu = {};
    for (const c of Object.keys(inc)) if (r2(inc[c])) cu[`bal.${c}`] = increment(r2(inc[c]));
    if (Object.keys(cu).length) b.update(ref('customers', e.cid), cu);
  }
  b.set(doc(col('log')), logOf('edit', ne, {changes}));
  commit(b, e.status === 'approved' ? () => recompute(e.cid) : null);
  return true;
}
function deleteEntry(e){
  const m = me(), now = Date.now(), b = writeBatch(fs);
  b.update(ref('entries', e.id), {status: 'deleted', prevStatus: e.status, deletedBy: m.id, deletedAt: now});
  if (e.status === 'approved') b.update(ref('customers', e.cid), {[`bal.${e.cur}`]: increment(-effect(e))});
  b.set(doc(col('log')), logOf('delete', e));
  commit(b, e.status === 'approved' ? () => recompute(e.cid) : null);
  return Object.assign({}, e, {status: 'deleted', prevStatus: e.status});
}
function restoreEntry(e){
  if (!e || e.status !== 'deleted') return;
  const m = me(), now = Date.now(), prev = e.prevStatus || 'approved', b = writeBatch(fs);
  b.update(ref('entries', e.id), {status: prev, restoredBy: m.id, restoredAt: now});
  if (prev === 'approved') b.update(ref('customers', e.cid), {[`bal.${e.cur}`]: increment(effect(e))});
  b.set(doc(col('log')), logOf('restore', e));
  commit(b, prev === 'approved' ? () => recompute(e.cid) : null);
}
function addCustomer(o, open){
  const m = me(), now = Date.now(), isOwner = m.role === 'owner';
  const r = doc(col('customers'));
  const c = {name: o.name, phone: o.phone || '', note: o.note || '', limitIQD: isOwner ? (o.limitIQD || 0) : 0, limitUSD: isOwner ? (o.limitUSD || 0) : 0,
    createdAt: now, createdBy: m.id, bal: {IQD: 0, USD: 0}, due: null, lastAt: now};
  if (open && isOwner) c.bal[open.cur] = open.amount;
  const b = writeBatch(fs);
  b.set(r, c);
  b.set(doc(col('log')), Object.assign(logOf('customer_add', null), {cid: r.id, cname: c.name}));
  if (open) {
    const er = doc(col('entries')), {seq, no} = nextReceipt();
    const e = {cid: r.id, no, type: 'debt', amount: open.amount, cur: open.cur, note: 'رصيد سابق من الدفتر', date: todayISO(), due: null,
      by: m.id, at: now, serverAt: serverTimestamp(), status: isOwner ? 'approved' : 'pending', edits: [], opening: true};
    if (isOwner) { e.approvedBy = m.id; e.approvedAt = now; }
    b.set(er, e);
    b.update(ref('users', m.id), {seq});
    st.me = Object.assign({}, m, {seq});
    b.set(doc(col('log')), Object.assign(logOf('create', Object.assign({id: er.id}, e)), {cname: c.name}));
  }
  commit(b);
  // show the new customer right away; the live snapshot replaces this copy
  const local = Object.assign({id: r.id}, c);
  if (!st.custById[r.id]) { st.custById[r.id] = local; st.customers = st.customers.concat([local]).sort(nameOrder); }
  return local;
}
function editCustomer(cid, patch){
  const c = cust(cid), data = {};
  for (const k of Object.keys(patch)) if (patch[k] !== c[k]) data[k] = patch[k];
  if (!Object.keys(data).length) return false;
  const b = writeBatch(fs);
  b.update(ref('customers', cid), data);
  b.set(doc(col('log')), Object.assign(logOf('customer_edit', null), {cid, cname: patch.name || c.name}));
  commit(b);
  return true;
}
async function recompute(cid){
  if (!me() || me().role !== 'owner') return;
  try {
    const snap = await getDocsFromServer(query(col('entries'), where('cid', '==', cid)));
    const list = []; snap.forEach(d => list.push(Object.assign({id: d.id}, d.data())));
    healWith(cid, list);
  } catch (err) { /* offline: the customer page corrects it next time it opens online */ }
}
function healWith(cid, list){
  const c = cust(cid); if (!c) return;
  const s = summarize(list), patch = {};
  const cb = c.bal || {};
  if (r2(cb.IQD || 0) !== s.bal.IQD || r2(cb.USD || 0) !== s.bal.USD) patch.bal = s.bal;
  if ((c.due || null) !== s.due) patch.due = s.due;
  if (Object.keys(patch).length) updateDoc(ref('customers', cid), patch).catch(() => {});
}
function userWrite(u, data, logExtra){
  const b = writeBatch(fs);
  b.update(ref('users', u.id), data);
  b.set(doc(col('log')), Object.assign(logOf(logExtra.type, null), logExtra, {name: u.name}));
  commit(b);
}

/* ---------- WhatsApp messages ---------- */
function balMsg(b){ const parts = []; for (const cur of ['IQD', 'USD']) if (b[cur] > 0) parts.push(amtMsg(b[cur], cur)); return parts.join(' و '); }
// an opening balance carries the book page and the owner's own notes (e.g. «لازم تدقيق»): those stay inside the app
const custNote = e => e.opening ? 'رصيد سابق' : e.note;
const shopTail = () => st.shop.phone ? `\nللاستفسار: ${st.shop.phone}` : '';
function msgDebt(e, b){
  const c = cust(e.cid) || {name: ''};
  const L = [`مرحباً ${c.name}`, `تم تسجيل دين جديد على حسابك لدى ${st.shop.name}:`];
  if (custNote(e)) L.push(`المادة: ${custNote(e)}`);
  L.push(`المبلغ: ${amtMsg(e.amount, e.cur)}`, `التاريخ: ${fmtDate(e.date, true)}`);
  if (e.due) L.push(`موعد التسديد: ${fmtDate(e.due, true)}`);
  L.push(`رصيدك الكلي: ${balMsg(b) || 'لا يوجد'}`, 'شكراً لتعاملكم معنا');
  return L.join('\n') + shopTail();
}
function msgPay(e, b){
  const c = cust(e.cid) || {name: ''};
  const L = [`مرحباً ${c.name}`, 'وصلنا تسديدك، شكراً لك.', `رقم الوصل: ${e.no}`, `المبلغ: ${amtMsg(e.amount, e.cur)}`, `التاريخ: ${fmtDate(e.date, true)}`];
  const bt = balMsg(b);
  L.push(bt ? `الباقي بذمتك: ${bt}` : 'حسابك مسدد بالكامل.', st.shop.name);
  return L.join('\n') + shopTail();
}
function msgRemind(cid){
  const c = cust(cid), d = dueInfo(cid);
  const L = [`مرحباً ${c.name}`, `نذكرك بالمبلغ المطلوب بذمتك لدى ${st.shop.name}:`, balMsg(bal(cid))];
  if (d) L.push(d.late ? `كان موعد التسديد ${fmtDate(d.due, true)}.` : `موعد التسديد ${fmtDate(d.due, true)}.`);
  L.push('نرجو التسديد بأقرب وقت، وشكراً لك.');
  return L.join('\n') + shopTail();
}
// entries: the customer's entries when they are not the open customer's (the «send to all» list fetches them all at once)
function msgStatement(cid, entries){
  const c = cust(cid), all = entries || custList(cid) || [], list = all.filter(e => e.status === 'approved').sort(sortChrono).slice(-10);
  const L = [`كشف حساب ${c.name} لدى ${st.shop.name}`, ''];
  for (const e of list) { const d = parseISO(e.date), n = custNote(e); L.push(`${d.getDate()}/${d.getMonth() + 1}  ${e.type === 'debt' ? 'دين' : 'تسديد'} ${amtMsg(e.amount, e.cur)}${n ? ' (' + n + ')' : ''}`); }
  const bt = balMsg(entries ? summarize(entries).bal : bal(cid));
  L.push('', bt ? `الرصيد المطلوب: ${bt}` : 'الحساب مسدد بالكامل.');
  return L.join('\n') + shopTail();
}
function waPhone(phone){
  let p = toLatin(phone).replace(/\D/g, '');
  if (!p) return '';
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('0')) p = '964' + p.slice(1);
  else if (p.length === 10 && p.startsWith('7')) p = '964' + p;
  return p;
}
const waHref = (c, text) => { const p = waPhone(c.phone); return `https://wa.me/${p}?text=${encodeURIComponent(text)}`; };

/* ---------- auth & status screens ---------- */
const iconImg = () => '<img class="app-icon" src="icons/icon-256.png" alt="أيقونة دفتر الديون">';
function bootView(){ return `<div class="boot">${iconImg()}<div class="spin" role="status" aria-label="جاري التحميل"></div></div>`; }
// The sign-in itself is kept on the phone by Firebase (local persistence): after the first time the app opens
// straight in. The email is also remembered for the login form, and the fields are marked so the phone's
// password manager offers to save and fill them.
const EMAIL_KEY = 'daftar-email';
const savedEmail = () => { try { return localStorage.getItem(EMAIL_KEY) || ''; } catch (err) { return ''; } };
const rememberEmail = email => { try { localStorage.setItem(EMAIL_KEY, email); } catch (err) {} };
function authView(){
  const su = ui.authMode === 'signup';
  return `<section class="login">${iconImg()}
    <div class="brandname"><h1>دفتر الديون</h1><span>محمود ناجي</span></div>
    <form class="card" id="auth-form" novalidate>
      <div class="seg" role="group" aria-label="نوع الدخول"><button type="button" data-act="auth-mode" data-v="login" aria-pressed="${!su}">دخول</button><button type="button" data-act="auth-mode" data-v="signup" aria-pressed="${su}">حساب جديد</button></div>
      ${su ? '<div class="field"><label for="a-name">اسمك</label><input class="input" id="a-name" name="name" autocomplete="name"></div>' : ''}
      <div class="field"><label for="a-email">الإيميل</label><input class="input" id="a-email" name="username" type="email" dir="ltr" autocomplete="username" inputmode="email" value="${su ? '' : esc(savedEmail())}"></div>
      <div class="field"><label for="a-pass">الباسورد</label><input class="input" id="a-pass" name="password" type="password" dir="ltr" autocomplete="${su ? 'new-password' : 'current-password'}"></div>
      <div id="a-warn"></div>
      <button class="btn btn-primary block" id="a-submit" type="submit">${su ? 'سوّي حساب' : 'دخول'}</button>
      ${su ? '' : '<button type="button" class="linkbtn" data-act="forgot">نسيت الباسورد؟</button>'}
    </form>
    <p class="fineprint">${su ? 'بعد ما تسوي حسابك، المدير يفعّله ويختار صلاحياتك.' : 'تدخل مرة وحدة بس. بعدها التطبيق يفتح وحده على هذا الموبايل.'}</p>
    ${isStandalone() ? '' : '<button type="button" class="linkbtn" data-act="install">ثبّت التطبيق على الشاشة حتى يبقى الدخول محفوظ</button>'}
  </section>`;
}
function verifyView(){
  const email = (auth.currentUser || {}).email || '';
  return `<section class="login">${iconImg()}
    <div class="brandname"><h1>أكّد إيميلك</h1><span dir="ltr">${esc(email)}</span></div>
    <div class="card"><p>دزينا رابط تأكيد على إيميلك. افتح الإيميل واضغط الرابط، وبعدها ارجع هنا واضغط «أكدت». إذا ما لكيته، شوف مجلد Spam.</p>
      <div id="v-warn"></div>
      <button class="btn btn-primary block" data-act="verify-done">${ic('check')}أكدت</button>
      <button class="btn btn-ghost block" data-act="verify-resend">دز الرابط مرة ثانية</button>
      <button class="linkbtn" data-act="logout">خروج</button></div>
  </section>`;
}
function waitingView(){
  const m = st.me || {}, stopped = (m.code || 0) > 0;
  const title = m.removed ? 'هذا الحساب انشال' : stopped ? 'حسابك موقوف' : 'حسابك ينتظر التفعيل';
  const text = m.removed ? 'صاحب الدفتر شال هذا الحساب، فما يكدر يدخل للتطبيق.' : stopped ? 'المدير وقف حسابك. راجعه حتى يرجّعه.' : 'المدير لازم يفعّل حسابك من صفحة الموظفين. أول ما يفعّله، يفتح التطبيق هنا وحده.';
  return `<section class="login">${iconImg()}
    <div class="brandname"><h1>${title}</h1><span>${esc(m.name || '')}</span></div>
    <div class="card"><p>${text}</p>
      <button class="btn btn-ghost block" data-act="logout">${ic('logout')}خروج</button></div>
  </section>`;
}
function rulesView(){
  return `<section class="login">${iconImg()}
    <div class="brandname"><h1>التطبيق بعده ما تجهّز</h1></div>
    <div class="card"><p>قواعد الحماية بعدها ما انضافت بـ Firebase. أول ما تنضاف، اضغط «حاول مرة ثانية».</p>
      <button class="btn btn-primary block" data-act="reload">حاول مرة ثانية</button>
      <button class="linkbtn" data-act="logout">خروج</button></div>
  </section>`;
}
function errorView(){
  return `<section class="login">${iconImg()}
    <div class="brandname"><h1>صار خطأ</h1></div>
    <div class="card"><p>تأكد من النت واضغط «حاول مرة ثانية».</p>${st.fatal ? `<p class="fineprint" dir="ltr">${esc(st.fatal)}</p>` : ''}
      <button class="btn btn-primary block" data-act="reload">حاول مرة ثانية</button>
      <button class="linkbtn" data-act="logout">خروج</button></div>
  </section>`;
}
function authMsg(err){
  const c = (err && err.code) || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-login')) return 'الإيميل أو الباسورد غلط.';
  if (c.includes('email-already-in-use')) return 'هذا الإيميل عنده حساب. اضغط «دخول».';
  if (c.includes('weak-password')) return 'الباسورد لازم يكون 6 حروف أو أكثر.';
  if (c.includes('invalid-email')) return 'الإيميل مكتوب غلط.';
  if (c.includes('network-request-failed')) return 'ماكو نت. تأكد من الاتصال وجرب مرة ثانية.';
  if (c.includes('too-many-requests')) return 'محاولات كثيرة. انتظر شوية وجرب.';
  return 'ما صار. جرب مرة ثانية.';
}

/* ---------- app shell ---------- */
const viewKey = () => ui.view ? `${ui.view.type}:${ui.view.id || ''}` : `tab:${ui.tab}`;
function viewTitle(){
  const v = ui.view;
  if (v.type === 'customer') return (cust(v.id) || {}).name || '';
  return {log: 'سجل الحركات', users: 'الموظفين والصلاحيات', settings: 'إعدادات المحل'}[v.type] || '';
}
function whoChip(u){ return `<button class="who" data-act="account" aria-label="حسابي"><span class="who-av">${esc(initial(u.name))}</span><span class="who-txt"><b>${esc(u.name)}</b><small>${ROLES[u.role]}</small></span></button>`; }
function barView(){
  const u = me();
  if (ui.view) return `<header class="bar"><button class="iconbtn" data-act="back" aria-label="رجوع">${ic('back')}</button><div class="bar-title">${esc(viewTitle())}</div>${whoChip(u)}</header>`;
  return `<header class="bar"><img class="logo" src="icons/wordmark.png" alt="محمود ناجي"><span class="bar-app">دفتر الديون</span><span class="spacer"></span>${whoChip(u)}</header>`;
}
const netHTML = () => st.online ? '' : `<div class="ribbon">${ic('cloud')}<span>بدون نت. اللي تسجله ينحفظ على الموبايل، ويترفع وحده أول ما يرجع النت.</span></div>`;
function renderNet(){ const el = $('#net'); if (el) el.innerHTML = netHTML(); }
function navView(){
  const u = me(), tabs = [['customers', 'الزبائن', 'users']];
  tabs.push(u.role === 'owner' ? ['approvals', 'الموافقات', 'inbox'] : ['requests', 'طلباتي', 'inbox']);
  if (can.reports(u)) tabs.push(['reports', 'التقارير', 'chart']);
  if (u.role === 'owner') tabs.push(['more', 'المزيد', 'more']);
  const pc = st.pending.length;
  return `<nav class="nav" aria-label="الأقسام"><div class="nav-in">${tabs.map(([k, l, i]) =>
    `<button class="tab" data-act="tab" data-tab="${k}" ${ui.tab === k ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span>${k === 'approvals' && pc ? `<span class="badge">${pc}</span>` : ''}</button>`).join('')}</div></nav>`;
}
function screenView(){
  if (ui.view) {
    if (ui.view.type === 'customer') return customerScreen(ui.view.id);
    if (ui.view.type === 'log') return logScreen();
    if (ui.view.type === 'users') return usersScreen();
    if (ui.view.type === 'settings') return settingsScreen();
  }
  if (ui.tab === 'approvals') return approvalsScreen();
  if (ui.tab === 'requests') return requestsScreen();
  if (ui.tab === 'reports') return reportsScreen();
  if (ui.tab === 'more') return moreScreen();
  return customersScreen();
}
const loadingBox = () => `<div class="empty"><div class="spin" role="status" aria-label="جاري التحميل"></div><span>جاري التحميل…</span></div>`;
function appView(){
  const u = me();
  const allowed = {customers: 1, approvals: u.role === 'owner', requests: u.role !== 'owner', reports: can.reports(u), more: u.role === 'owner'};
  if (!allowed[ui.tab]) { ui.tab = 'customers'; ui.view = null; }
  if (ui.view && ui.view.type !== 'customer' && u.role !== 'owner') ui.view = null;
  if (ui.view && ui.view.type === 'customer' && st.custReady && !cust(ui.view.id)) ui.view = null;
  const fab = !ui.view && ui.tab === 'customers' ? `<button class="fab" data-act="add-cust">${ic('plus')}زبون جديد</button>` : '';
  return barView() + `<div id="net">${netHTML()}</div><main class="screen" id="main">${screenView()}</main>` + navView() + fab;
}
function view(){
  switch (st.phase) {
    case 'auth': return authView();
    case 'verify': return verifyView();
    case 'waiting': return waitingView();
    case 'rules': return rulesView();
    case 'error': return errorView();
    case 'app': return appView();
    default: return bootView();
  }
}
function render(){
  const root = $('#app');
  const keep = [];
  root.querySelectorAll('[data-dirty="1"]').forEach(el => { if (el.id) keep.push([el.id, el.value]); });
  const a = document.activeElement;
  const focus = a && root.contains(a) && a.id ? {id: a.id, s: a.selectionStart, e: a.selectionEnd} : null;
  root.className = st.phase === 'app' ? '' : 'is-login';
  root.innerHTML = view();
  for (const [id, v] of keep) { const el = document.getElementById(id); if (el) { el.value = v; el.dataset.dirty = '1'; } }
  if (focus) { const el = document.getElementById(focus.id); if (el) { el.focus({preventScroll: true}); try { if (focus.s != null) el.setSelectionRange(focus.s, focus.e); } catch (err) {} } }
  if (st.phase === 'app') syncView();
}
function go(to){
  ui.scroll[viewKey()] = window.scrollY;
  Object.assign(ui, to);
  render();
  window.scrollTo(0, ui.scroll[viewKey()] || 0);
}

/* ---------- customers ---------- */
const FILTERS = {
  all: {l: 'الكل', test: () => true},
  owed: {l: 'عليهم دين', test: r => r.b.IQD > 0 || r.b.USD > 0},
  late: {l: 'متأخرين', test: r => r.d && r.d.late},
  settled: {l: 'مسددين', test: r => r.b.IQD <= 0 && r.b.USD <= 0}
};
const custRows = () => st.customers.map(c => ({c, b: bal(c.id), d: dueInfo(c.id), p: pend(c.id), last: lastAt(c.id)}));
function chipsHTML(){
  const rows = custRows();
  return Object.keys(FILTERS).map(k => `<button class="chip" data-act="filter" data-f="${k}" aria-pressed="${ui.filter === k}">${FILTERS[k].l}<span class="n">${rows.filter(FILTERS[k].test).length}</span></button>`).join('');
}
function custRow(r, showBal){
  const {c, b, d, p} = r, sub = [], pills = [];
  if (c.note) sub.push(`<span>${esc(c.note)}</span>`);
  sub.push(`<span>آخر حركة ${relDay(isoOf(new Date(r.last || Date.now())))}</span>`);
  if (showBal && d) {
    if (d.late) pills.push(`<span class="pill late">${dueText(d)}</span>`);
    else if (d.days <= 5) pills.push(`<span class="pill soon">${dueText(d)}</span>`);
  }
  if (p.n) pills.push(`<span class="pill wait">${p.n === 1 ? 'حركة معلقة' : countAr(p.n, '', 'حركتين معلقة', 'حركات معلقة', 'حركة معلقة')}</span>`);
  let right = '';
  if (showBal) {
    const lines = [];
    for (const cur of ['IQD', 'USD']) {
      if (b[cur] > 0) lines.push(amt(b[cur], cur, 'owe'));
      else if (b[cur] < 0) lines.push(`<span class="cred-l">إله ${amt(-b[cur], cur, 'cred')}</span>`);
    }
    right = `<span class="bal">${lines.length ? lines.join('') : '<span class="pill ok">مسدد</span>'}</span>`;
  }
  return `<button class="row" data-act="open-cust" data-id="${c.id}"><span class="av">${esc(initial(c.name))}</span>
    <span class="main"><span class="name">${esc(c.name)}</span><span class="sub">${sub.join('<i class="dot"></i>')}</span>${pills.length ? `<span class="pills">${pills.join('')}</span>` : ''}</span>${right}</button>`;
}
function custListHTML(){
  if (!st.custReady) return loadingBox();
  const u = me(), showBal = can.seeBalances(u);
  const q = norm(ui.q), qd = toLatin(ui.q).replace(/\D/g, '');
  let rows = custRows();
  if (q) rows = rows.filter(r => norm(r.c.name).includes(q) || norm(r.c.note).includes(q) || (qd.length >= 3 && toLatin(r.c.phone).replace(/\D/g, '').includes(qd)));
  if (showBal) rows = rows.filter(FILTERS[ui.filter].test);
  if (!rows.length) {
    if (q) return `<div class="empty">${ic('search')}<span>ماكو زبون بهالاسم.</span><button class="linkbtn" data-act="add-cust" data-name="${esc(ui.q.trim())}">أضف «${esc(ui.q.trim())}» كزبون جديد</button></div>`;
    if (!st.customers.length) return `<div class="empty">${ic('users')}<span>بعد ماكو زبائن. اضغط «زبون جديد» وأضف أول زبون، ووياه رصيده السابق من الدفتر.</span>${u.role === 'owner' ? '<button class="linkbtn" data-act="import">أو استورد أرصدة الدفتر من ملف إكسل</button>' : ''}</div>`;
    return `<div class="empty">${ic('users')}<span>ماكو زبائن بهالقائمة.</span></div>`;
  }
  return `<div class="list">${rows.map(r => custRow(r, showBal)).join('')}</div>`;
}
function customersScreen(){
  const u = me(), showBal = can.seeBalances(u), d = new Date();
  let h = `<div class="titlebar"><h1 class="h1">الزبائن</h1><span class="today">${WEEKDAYS[d.getDay()]} ${fmtDate(todayISO())}</span></div>`;
  if (u.role === 'owner' && st.pending.length) {
    const pc = st.pending.length;
    h += `<button class="notice" data-act="tab" data-tab="approvals"><span class="count">${pc}</span><span class="txt"><b>${countAr(pc, 'حركة وحدة', 'حركتين', 'حركات', 'حركة')} بانتظار موافقتك</b><small>سجلها الموظفين، وتنحسب على الزبون بعد ما توافق</small></span>${ic('back', 'flip')}</button>`;
  }
  if (u.role === 'owner' && st.custReady && st.customers.length && Date.now() - (st.shop.lastBackupAt || 0) > 7 * 864e5) {
    h += `<div class="backup">${ic('download')}<span class="txt"><b>${st.shop.lastBackupAt ? `آخر نسخة احتياطية ${relDay(isoOf(new Date(st.shop.lastBackupAt)))}` : 'بعدك ما نزّلت نسخة احتياطية'}</b><small>نزّل نسخة إكسل وخزنها بإيميلك. ياخذ ثواني.</small></span><button class="btn btn-ghost" data-act="export">نزّل هسه</button></div>`;
  }
  if (showBal && st.custReady) {
    const t = totals();
    h += `<section class="totals" aria-label="المطلوب من الزبائن">
      <div class="total"><span class="lbl">المطلوب بالدينار</span><span class="val">${fmtNum(t.IQD, 'IQD')}<small>د.ع</small></span></div>
      <div class="total"><span class="lbl">المطلوب بالدولار</span><span class="val">${fmtNum(t.USD, 'USD')}<small>$</small></span></div></section>
      <div class="meta-line"><span>${t.owed ? countAr(t.owed, 'زبون واحد عليه دين', 'زبونين عليهم دين', 'زبائن عليهم دين', 'زبون عليهم دين') : 'ماكو ديون مفتوحة'}</span>${t.late ? `<span class="late-txt">${countAr(t.late, 'واحد متأخر', 'اثنين متأخرين', 'متأخرين', 'متأخر')}</span>` : ''}</div>`;
  }
  if (showBal && st.custReady && can.message(u) && totals().owed) h += `<button class="btn btn-ghost block" data-act="bulk">${ic('wa')}إرسال الكشف للكل</button>`;
  h += `<label class="search" for="q">${ic('search')}<input id="q" type="search" placeholder="دوّر بالاسم أو المنطقة أو الرقم" value="${esc(ui.q)}" autocomplete="off" enterkeyhint="search"></label>`;
  if (showBal) h += `<div class="chips" id="cust-chips" role="group" aria-label="تصفية">${chipsHTML()}</div>`;
  return h + `<div id="cust-list">${custListHTML()}</div>`;
}

/* ---------- one customer ---------- */
function entRow(e, runAfter, showCust){
  const d = parseISO(e.date);
  const cls = e.status === 'pending' ? ' is-wait' : e.status === 'rejected' ? ' is-rej' : '';
  let stamp = '';
  if (e.status === 'pending') stamp = '<span class="stamp wait">بانتظار الموافقة</span>';
  else if (e.status === 'rejected') stamp = '<span class="stamp rej">مرفوضة</span>';
  else if (e.status === 'approved' && e.by !== e.approvedBy) stamp = `<span class="stamp ok">وافق ${esc(uname(e.approvedBy))}</span>`;
  const meta = [`<span class="no" dir="ltr">${noTag(e.no)}</span>`, `<span>سجلها ${esc(uname(e.by))}</span>`];
  if (e.type === 'debt' && e.due && e.status !== 'rejected') meta.push(`<span>الموعد ${fmtDate(e.due)}</span>`);
  if (e.edits && e.edits.length) meta.push('<span>معدّلة</span>');
  const tl = `<span class="tl ${e.type}">${e.type === 'debt' ? 'دين' : 'تسديد'}</span>`;
  const what = showCust ? `${tl}<span class="cname">${esc((cust(e.cid) || {}).name || '')}</span>` : `${tl}${e.note ? `<span class="note">${esc(e.note)}</span>` : ''}`;
  const run = runAfter && runAfter.has(e.id) ? `<span class="run">${runAfter.get(e.id) < 0 ? `إله ${amtText(-runAfter.get(e.id), e.cur)}` : `الرصيد ${amtText(runAfter.get(e.id), e.cur)}`}</span>` : '';
  return `<button class="ent${cls}" data-act="open-entry" data-id="${e.id}">
    <span class="date"><b>${d.getDate()}</b><small>${MONTHS_SHORT[d.getMonth()]}</small></span>
    <span class="body"><span class="what">${what}</span>${showCust && e.note ? `<span class="meta">${esc(e.note)}</span>` : ''}<span class="meta">${meta.join('<i class="dot"></i>')}</span>${stamp ? `<span class="stamps">${stamp}</span>` : ''}${e.status === 'rejected' && e.reason ? `<span class="reason">${esc(e.reason)}</span>` : ''}</span>
    <span class="fig">${amt(e.amount, e.cur, e.type === 'debt' ? 'owe' : 'cred')}${run}</span></button>`;
}
function ledgerHTML(list, runAfter, showCust){
  let h = '', lastM = '';
  for (const e of list) {
    const d = parseISO(e.date), m = `${d.getFullYear()}-${d.getMonth()}`;
    if (m !== lastM) { h += `<div class="month-h">${MONTHS[d.getMonth()]} ${d.getFullYear()}</div>`; lastM = m; }
    h += entRow(e, runAfter, showCust);
  }
  return `<div class="ledger">${h}</div>`;
}
function customerScreen(cid){
  const c = cust(cid);
  if (!c) return loadingBox();
  const u = me(), list = custList(cid);
  const b = bal(cid), d = dueInfo(cid), p = list ? pend(cid, list) : pend(cid);
  let h = `<section class="cust-head"><span class="av lg">${esc(initial(c.name))}</span><div class="info"><h1 class="h1">${esc(c.name)}</h1>${c.note ? `<span class="sub">${esc(c.note)}</span>` : ''}</div>${can.editCustomer(u) ? `<button class="mini" data-act="edit-cust" data-id="${c.id}">${ic('edit')}تعديل</button>` : ''}</section>`;
  if (c.phone) h += `<div class="phone-row"><span class="phone" dir="ltr">${esc(c.phone)}</span><a class="mini" href="tel:${esc(toLatin(c.phone).replace(/[^\d+]/g, ''))}">${ic('phone')}اتصال</a><button class="mini" data-act="copy" data-text="${esc(c.phone)}">${ic('copy')}نسخ</button></div>`;
  const lines = [];
  for (const cur of ['IQD', 'USD']) {
    if (b[cur] > 0) lines.push(amt(b[cur], cur, 'owe'));
    else if (b[cur] < 0) lines.push(`<span class="cred-l" style="font-size:16px">إله ${amt(-b[cur], cur, 'cred')}</span>`);
  }
  const owes = b.IQD > 0 || b.USD > 0;
  let foot = '';
  if (d) foot += `<div class="pills" style="align-items:center"><span class="pill ${d.late ? 'late' : d.days <= 5 ? 'soon' : 'off'}">${dueText(d)}</span><span>موعد التسديد ${fmtDate(d.due)}</span></div>`;
  if (p.n) {
    const parts = [];
    for (const cur of ['IQD', 'USD']) { if (p.debt[cur]) parts.push(`دين ${amtText(p.debt[cur], cur)}`); if (p.pay[cur]) parts.push(`تسديد ${amtText(p.pay[cur], cur)}`); }
    foot += `<div>${ic('clock')} بانتظار الموافقة: ${parts.join('، ')}</div>`;
  }
  for (const cur of ['IQD', 'USD']) {
    const lim = cur === 'IQD' ? c.limitIQD : c.limitUSD;
    if (!lim) continue;
    const used = Math.max(0, b[cur]), pct = Math.round(used / lim * 100);
    foot += `<div><div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px"><span>سقف الدين ${amtText(lim, cur)}</span><span>مستخدم ${pct}%</span></div><div class="meter${pct > 100 ? ' over' : ''}"><i style="width:${Math.min(100, pct)}%"></i></div></div>`;
  }
  h += `<section class="balance" aria-label="رصيد الزبون"><span class="k">${owes ? 'المطلوب منه' : lines.length ? 'إله رصيد عندكم' : 'الحساب'}</span>
    <div class="bal-lines">${lines.length ? lines.join('') : '<span class="settled">مسدد بالكامل</span>'}</div>${foot ? `<div class="bal-foot">${foot}</div>` : ''}</section>`;
  h += `<div class="actions"><button class="btn btn-debt grow" data-act="new-entry" data-type="debt">${ic('plus')}دين جديد</button><button class="btn btn-pay grow" data-act="new-entry" data-type="pay">${ic('check')}تسديد</button></div>`;
  if (can.message(u)) h += `<div class="actions"><button class="btn btn-ghost grow" data-act="remind" ${owes ? '' : 'disabled'}>${ic('bell')}تذكير</button><button class="btn btn-ghost grow" data-act="send-statement" ${list ? '' : 'disabled'}>${ic('doc')}إرسال الكشف</button></div>`;
  if (!list) return h + `<section class="stack"><div class="sec-h"><h2>كشف الحساب</h2></div>${loadingBox()}</section>`;
  const all = list.filter(e => e.status !== 'deleted');
  const runAfter = new Map(), run = {IQD: 0, USD: 0};
  for (const e of all.filter(x => x.status === 'approved').sort(sortChrono)) { run[e.cur] = r2(run[e.cur] + effect(e)); runAfter.set(e.id, run[e.cur]); }
  const sorted = all.slice().sort((a, b2) => -sortChrono(a, b2));
  h += `<section class="stack"><div class="sec-h"><h2>كشف الحساب</h2><span>${countAr(sorted.length, 'حركة وحدة', 'حركتين', 'حركات', 'حركة')}</span></div>
    ${sorted.length ? ledgerHTML(sorted, runAfter, false) : `<div class="empty">${ic('doc')}<span>ماكو حركات بعد. سجّل أول دين أو تسديد من الأزرار فوق.</span></div>`}</section>`;
  return h;
}

/* ---------- approvals, requests ---------- */
function approvalsScreen(){
  const list = st.pending.slice().sort((a, b) => b.at - a.at);
  let h = `<div class="titlebar"><h1 class="h1">بانتظار موافقتك</h1></div><p class="lead">هاي الحركات سجلها الموظفين. أول ما توافق تنحسب على الزبون، وتطلعلك رسالة الواتساب جاهزة.</p>`;
  if (!list.length) return h + `<div class="empty">${ic('check')}<span>ماكو شي بانتظار موافقتك.</span></div>`;
  return h + '<div class="stack">' + list.map(e => {
    const c = cust(e.cid) || {name: ''}, lc = e.type === 'debt' ? limitCheck(e.cid, e.cur, e.amount, e.id) : null;
    return `<article class="appr"><button class="appr-main" data-act="open-entry" data-id="${e.id}">
        <span class="appr-top"><span class="cname">${esc(c.name)}</span><span class="tl ${e.type}">${e.type === 'debt' ? 'دين جديد' : 'تسديد'}</span></span>
        <span class="appr-amt">${amt(e.amount, e.cur, e.type === 'debt' ? 'owe' : 'cred')}</span>
        ${e.note ? `<span>${esc(e.note)}</span>` : ''}
        <span class="meta"><span>سجلها ${esc(uname(e.by))}</span><i class="dot"></i><span>${fmtStamp(e.at)}</span>${e.due ? `<i class="dot"></i><span>الموعد ${fmtDate(e.due)}</span>` : ''}</span>
        ${lc ? `<span class="warnbox">${ic('alert')}<span>يعدّي سقف الزبون بـ ${amtText(lc.over, lc.cur)}. الرصيد يصير ${amtText(lc.projected, lc.cur)} والسقف ${amtText(lc.lim, lc.cur)}.</span></span>` : ''}
      </button>
      <div class="appr-actions"><button class="btn btn-primary grow" data-act="approve" data-id="${e.id}">${ic('check')}قبول</button><button class="btn btn-ghost danger grow" data-act="reject" data-id="${e.id}">${ic('x')}رفض</button></div></article>`;
  }).join('') + '</div>';
}
function requestsScreen(){
  const list = st.myPending.concat(st.myRejected).sort((a, b) => b.at - a.at);
  let h = `<div class="titlebar"><h1 class="h1">طلباتي</h1></div><p class="lead">كل حركة تسجلها تروح إلى ${esc(ownerName())}. هنا تشوف شنو بعده ينتظر، وشنو رفضه وليش. المقبولة تلكاها بكشف حساب الزبون.</p>`;
  h += `<div class="meta-line" style="margin-top:0"><span>${countAr(st.myPending.length, 'وحدة تنتظر', 'ثنتين تنتظر', 'تنتظر', 'تنتظر')}</span>${st.myRejected.length ? `<span class="late-txt">${countAr(st.myRejected.length, 'وحدة مرفوضة', 'ثنتين مرفوضة', 'مرفوضة', 'مرفوضة')}</span>` : ''}</div>`;
  if (!list.length) return h + `<div class="empty">${ic('inbox')}<span>ماكو شي ينتظر. افتح أي زبون وسجّل دين أو تسديد.</span></div>`;
  return h + ledgerHTML(list.slice().sort((a, b) => -sortChrono(a, b)), null, true);
}

/* ---------- reports ---------- */
function amtsInline(sum){ const parts = []; for (const cur of ['IQD', 'USD']) if (sum[cur]) parts.push(amt(sum[cur], cur)); return parts.length ? parts.join('') : '<span>—</span>'; }
function cashBlock(sum){ const parts = []; for (const cur of ['IQD', 'USD']) if (sum[cur]) parts.push(`<span>${fmtNum(sum[cur], cur)}<span class="cur">${CUR[cur]}</span></span>`); return parts.length ? parts.join('') : '<span>0<span class="cur">د.ع</span></span>'; }
function reportsScreen(){
  let h = `<div class="titlebar"><h1 class="h1">التقارير</h1></div>
    <div class="seg" role="group" aria-label="نوع التقرير"><button data-act="rtab" data-v="today" aria-pressed="${ui.reportTab === 'today'}">جرد اليوم</button><button data-act="rtab" data-v="month" aria-pressed="${ui.reportTab === 'month'}">الشهر</button></div>`;
  h += ui.reportTab === 'today' ? todayReport() : monthReport();
  h += `<section class="stack"><button class="btn btn-ghost block" data-act="export">${ic('download')}تنزيل نسخة إكسل</button><p class="note">${ic('info')}<span>ملف واحد بيه أرصدة كل الزبائن وكل الحركات، تحفظه كنسخة احتياطية أو تنطيه للمحاسب.</span></p></section>`;
  return h;
}
function todayReport(){
  if (!st.today) return loadingBox();
  // opening balances carried over from the paper book are not today's business
  const t = todayISO(), todays = st.today.filter(e => isoOf(new Date(e.at)) === t && (e.status === 'approved' || e.status === 'pending') && !e.opening);
  const cash = {IQD: 0, USD: 0}, cashWait = {IQD: 0, USD: 0};
  for (const e of todays) if (e.type === 'pay') { cash[e.cur] = r2(cash[e.cur] + e.amount); if (e.status === 'pending') cashWait[e.cur] = r2(cashWait[e.cur] + e.amount); }
  const waitTxt = (cashWait.IQD || cashWait.USD) ? `منها تنتظر الموافقة: ${[cashWait.IQD ? amtText(cashWait.IQD, 'IQD') : '', cashWait.USD ? amtText(cashWait.USD, 'USD') : ''].filter(Boolean).join(' و ')}` : 'كلها مقبولة';
  let h = `<section class="cash"><span class="k">الكاش المستلم اليوم</span><div class="v">${cashBlock(cash)}</div><span class="s">${waitTxt}</span></section>`;
  h += `<div class="sec-h"><h2>كل واحد شكد عنده</h2><span>${WEEKDAYS[new Date().getDay()]} ${fmtDate(t)}</span></div><div class="stack">`;
  for (const u of st.users.filter(x => x.active)) {
    const mine = todays.filter(e => e.by === u.id), pay = {IQD: 0, USD: 0}, payWait = {IQD: 0, USD: 0}, debt = {IQD: 0, USD: 0};
    let debtN = 0;
    for (const e of mine) {
      if (e.type === 'pay') { pay[e.cur] = r2(pay[e.cur] + e.amount); if (e.status === 'pending') payWait[e.cur] = r2(payWait[e.cur] + e.amount); }
      else { debt[e.cur] = r2(debt[e.cur] + e.amount); debtN++; }
    }
    h += `<article class="person"><header><span class="av">${esc(initial(u.name))}</span><b>${esc(u.name)}</b><span class="role ${u.role}">${ROLES[u.role]}</span></header>
      <div class="kv"><span>استلم كاش</span><span class="vals">${amtsInline(pay)}</span></div>
      ${(payWait.IQD || payWait.USD) ? `<div class="kv"><span>منها تنتظر الموافقة</span><span class="vals">${amtsInline(payWait)}</span></div>` : ''}
      <div class="kv"><span>سجّل ديون</span><span class="vals">${debtN ? `<span>${countAr(debtN, 'حركة وحدة', 'حركتين', 'حركات', 'حركة')}</span>${amtsInline(debt)}` : '<span>—</span>'}</span></div></article>`;
  }
  return h + '</div>';
}
function monthRange(offset){
  const now = new Date(), ref0 = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return {start: isoOf(ref0), end: isoOf(new Date(ref0.getFullYear(), ref0.getMonth() + 1, 0)), m: ref0.getMonth(), y: ref0.getFullYear()};
}
function monthReport(){
  const m0 = monthRange(0), m1 = monthRange(1), R = monthRange(ui.monthOffset);
  let h = `<div class="chips" role="group" aria-label="الشهر"><button class="chip" data-act="month" data-o="0" aria-pressed="${ui.monthOffset === 0}">${MONTHS[m0.m]}</button><button class="chip" data-act="month" data-o="1" aria-pressed="${ui.monthOffset === 1}">${MONTHS[m1.m]}</button></div>`;
  if (!st.month || st.monthKey !== R.start) return h + loadingBox();
  const debt = {IQD: 0, USD: 0}, pay = {IQD: 0, USD: 0}, moves = st.month.filter(e => !e.opening);
  for (const e of moves) { const s = e.type === 'debt' ? debt : pay; s[e.cur] = r2(s[e.cur] + e.amount); }
  const newCust = st.customers.filter(c => { const d = new Date(c.createdAt || 0); return !c.imported && d.getFullYear() === R.y && d.getMonth() === R.m; }).length;
  h += `<div class="stat-grid">
    <div class="stat"><span class="k">ديون جديدة</span><span class="v owe">${amtsInline(debt)}</span></div>
    <div class="stat"><span class="k">تسديدات</span><span class="v cred">${amtsInline(pay)}</span></div>
    <div class="stat"><span class="k">عدد الحركات</span><span class="v">${moves.length}</span></div>
    <div class="stat"><span class="k">زبائن جدد</span><span class="v">${newCust}</span></div></div>`;
  const top = custRows().filter(r => r.b.IQD > 0 || r.b.USD > 0).sort((a, b) => (b.b.IQD - a.b.IQD) || (b.b.USD - a.b.USD)).slice(0, 5);
  h += `<section class="stack"><div class="sec-h"><h2>أكثر المطلوبين هسه</h2><span>${countAr(top.length, 'زبون واحد', 'زبونين', 'زبائن', 'زبون')}</span></div>`;
  h += top.length ? `<div class="list">${top.map(r => custRow(r, true)).join('')}</div>` : '<div class="empty"><span>ماكو ديون مفتوحة.</span></div>';
  return h + '</section>';
}
async function loadMonth(){
  const R = monthRange(ui.monthOffset);
  st.monthKey = R.start; st.month = null;
  try {
    const snap = await getDocs(query(col('entries'), where('date', '>=', R.start), where('date', '<=', R.end)));
    if (st.monthKey !== R.start) return;
    st.month = ents(snap).filter(e => e.status === 'approved');
  } catch (err) { st.month = []; toastErr(err); }
  if (!ui.view && ui.tab === 'reports') render();
}
function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
async function exportExcel(btn, fileName){
  if (btn) btn.disabled = true;
  toast('جاري تجهيز الملف…');
  let ok = false;
  try {
    if (!window.XLSX) await loadScript(XLSX_URL);
    const X = window.XLSX;
    // entries cleared by «تصفير الدفتر» live in the backup taken before the reset, not in later files
    const all = ents(await getDocs(col('entries'))).filter(e => !e.resetAt);
    const byC = {}; for (const e of all) (byC[e.cid] = byC[e.cid] || []).push(e);
    const r1 = [['الزبون', 'الهاتف', 'المنطقة / ملاحظة', 'الرصيد بالدينار', 'الرصيد بالدولار', 'حركات معلقة', 'موعد التسديد', 'الحالة']];
    for (const c of st.customers) {
      const L = byC[c.id] || [], s = summarize(L), d = dueFrom(s.due, s.bal), pn = L.filter(e => e.status === 'pending').length;
      r1.push([c.name, c.phone || '', c.note || '', s.bal.IQD, s.bal.USD, pn, d ? d.due : '', d ? dueText(d) : (s.bal.IQD > 0 || s.bal.USD > 0 ? 'بدون موعد' : 'مسدد')]);
    }
    const r2rows = [['رقم الوصل', 'التاريخ', 'الزبون', 'النوع', 'المبلغ', 'العملة', 'المادة / ملاحظة', 'موعد التسديد', 'الحالة', 'سجلها', 'وقت التسجيل', 'وافق عليها', 'وقت الموافقة', 'سبب الرفض']];
    for (const e of all.slice().sort(sortChrono)) {
      r2rows.push([e.no || '', e.date, (cust(e.cid) || {}).name || '', e.type === 'debt' ? 'دين' : 'تسديد', e.amount, CUR_WORD[e.cur], e.note || '', e.due || '', STATUS[e.status] || e.status,
        uname(e.by), stampISO(e.at), e.approvedBy ? uname(e.approvedBy) : '', stampISO(e.approvedAt), e.reason || '']);
    }
    const wb = X.utils.book_new();
    wb.Workbook = {Views: [{RTL: true}]};
    const s1 = X.utils.aoa_to_sheet(r1); s1['!cols'] = [24, 16, 18, 16, 16, 12, 14, 16].map(w => ({wch: w}));
    const s2 = X.utils.aoa_to_sheet(r2rows); s2['!cols'] = [10, 12, 22, 8, 14, 8, 26, 13, 16, 10, 18, 10, 18, 28].map(w => ({wch: w}));
    X.utils.book_append_sheet(wb, s1, 'الأرصدة');
    X.utils.book_append_sheet(wb, s2, 'الحركات');
    const out = X.write(wb, {bookType: 'xlsx', type: 'array'});
    const blob = new Blob([out], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = fileName || `دفتر-الديون-${todayISO()}.xlsx`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
    if (me().role === 'owner') {
      const now = Date.now();
      st.shop = Object.assign({}, st.shop, {lastBackupAt: now});
      setDoc(ref('meta', 'shop'), {lastBackupAt: now}, {merge: true}).catch(() => {});
      render();
    }
    toast('نزل ملف الإكسل. خزنه بإيميلك');
    ok = true;
  } catch (err) { toastErr(err); }
  finally { if (btn) btn.disabled = false; }
  return ok;
}

/* ---------- import from Excel (owner): the paper book's balances, or a backup from this app ---------- */
// Columns are found by their header text, so the book file and the app's own backup both work.
const IMPORT_COLS = {
  name: ['الاسم', 'الزبون', 'اسم الزبون'],
  note: ['المنطقة', 'المنطقة / ملاحظة'],
  phone: ['الهاتف', 'رقم الهاتف', 'رقم الواتساب'],
  IQD: ['دينار', 'الرصيد بالدينار'],
  USD: ['دولار', 'الرصيد بالدولار'],
  due: ['موعد التسديد'],
  page: ['الصفحة'],
  memo: ['ملاحظة', 'ملاحظات', 'التفاصيل', 'تفاصيل']
};
const custKey = (name, note) => `${norm(name)}|${norm(note || '')}`;
// a phone cell: text as written, or a number whose leading 0 Excel dropped (7701234567 → 07701234567)
function normPhone(v){
  if (v == null || v === '') return '';
  const s = typeof v === 'number' ? String(Math.round(v)) : toLatin(String(v)).trim().replace(/\s+/g, ' ');
  return /^7\d{9}$/.test(s) ? '0' + s : s;
}
const phoneOk = p => { const w = waPhone(p); return w.length >= 11 && w.length <= 15; };
// need: 'amount' finds a balances table (name + dinar/dollar); 'phone' finds a numbers table (name + phone)
function findImportTable(X, wb, need){
  for (const sn of wb.SheetNames) {
    const ws = wb.Sheets[sn];
    if (!ws['!ref']) continue;
    const rows = X.utils.sheet_to_json(ws, {header: 1, raw: true, defval: '', blankrows: true});
    const top = X.utils.decode_range(ws['!ref']).s.r;
    for (let h = 0; h < Math.min(rows.length, 30); h++) {
      const heads = rows[h].map(v => norm(v));
      const c = {};
      for (const k of Object.keys(IMPORT_COLS)) { const i = IMPORT_COLS[k].map(a => heads.indexOf(norm(a))).find(x => x >= 0); c[k] = i === undefined ? -1 : i; }
      const ok = need === 'phone' ? c.phone >= 0 : (c.IQD >= 0 || c.USD >= 0);
      if (c.name >= 0 && ok) return {c, rows: rows.slice(h + 1), start: top + h + 2, backup: heads.includes(norm('الرصيد بالدينار'))};
    }
  }
  return null;
}
// Every line of the file goes in as written. A second line with the same name and area is the same
// customer: it adds its own opening entry to that customer instead of being dropped.
function parseImport(found){
  const {c, rows, start, backup} = found, out = [], bad = [];
  const have = new Set(st.customers.map(x => custKey(x.name, x.note))), seen = new Set();
  const cell = (row, i) => i >= 0 && row[i] != null ? row[i] : '';
  const text = v => String(v).trim().replace(/\s+/g, ' ');
  // a cell holds a number, or text such as «150 ألف», «1.5 مليون» or «200$»
  const money = v => {
    if (typeof v === 'number') return {n: v, usd: false};
    const s = toLatin(String(v)).trim();
    if (!s) return {n: 0, usd: false};
    const mult = /مليون/.test(s) ? 1e6 : /[أا]لف/.test(s) ? 1e3 : 1;
    const n = parseAmount(s.replace(/\$|دولار|دينار|د\.ع|مليون|[أا]لف/g, ''));
    return {n: isFinite(n) ? n * mult : NaN, usd: /\$|دولار/.test(s)};
  };
  rows.forEach((row, i) => {
    const name = text(cell(row, c.name)), a = money(cell(row, c.IQD)), d = money(cell(row, c.USD));
    if (!name) { if (a.n || d.n) bad.push(`السطر ${start + i} بدون اسم`); return; }
    if (norm(name) === norm('المجموع')) return;
    if (isNaN(a.n) || isNaN(d.n)) { bad.push(name); return; }
    const IQD = Math.round(a.usd ? 0 : a.n), USD = r2(d.n + (a.usd ? a.n : 0));
    const note = text(cell(row, c.note)), due = text(cell(row, c.due)), key = custKey(name, note);
    out.push({name, note, key, phone: normPhone(cell(row, c.phone)), IQD, USD, page: text(cell(row, c.page)), memo: text(cell(row, c.memo)),
      due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null, skip: have.has(key) ? 'app' : '', extra: !have.has(key) && seen.has(key)});
    seen.add(key);
  });
  return {rows: out, bad, backup};
}
function openImport(){
  sheetState = {kind: 'import', file: '', parsed: null, busy: false, err: ''};
  openSheet(`${sheetHead('استيراد من إكسل', 'أرصدة الدفتر الورقي، أو نسخة احتياطية من التطبيق')}<div class="sheet-body" id="imp-body"></div><div class="sheet-foot" id="imp-foot"></div>`, renderImport);
}
function renderImport(){
  const s = sheetState; if (!s || s.kind !== 'import') return;
  const body = $('#imp-body'), foot = $('#imp-foot'); if (!body || !foot) return;
  const warn = s.err ? `<div class="warnbox">${ic('alert')}<span>${s.err}</span></div>` : '';
  const pick = primary => `<label class="btn ${primary ? 'btn-primary' : 'btn-ghost'} grow filepick">${ic('doc')}${s.parsed ? 'ملف ثاني' : 'اختار الملف'}<input type="file" id="imp-file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label>`;
  if (s.reading) { body.innerHTML = `<div class="empty"><div class="spin" role="status" aria-label="جاري القراءة"></div><span>جاري قراءة الملف…</span></div>`; foot.innerHTML = ''; return; }
  if (!s.parsed) {
    body.innerHTML = `<p class="lead">اختار ملف الإكسل من موبايلك. قبل ما ينضاف أي شي تشوف كل الأسماء والمجاميع.</p>
      <p class="note">${ic('info')}<span>كل زبون ينضاف وويا رصيده كحركة وحدة مقبولة. ما تنرسل رسائل واتساب، والزبون الموجود بالتطبيق ما يتكرر.</span></p>${warn}`;
    foot.innerHTML = pick(true);
    return;
  }
  const P = s.parsed, todo = P.rows.filter(r => !r.skip && !r.done), skipped = P.rows.filter(r => r.skip).length;
  const custs = todo.filter(r => !r.extra).length, extras = todo.length - custs;
  const sum = {IQD: 0, USD: 0};
  for (const r of todo) { sum.IQD += r.IQD; sum.USD = r2(sum.USD + r.USD); }
  const line = (k, v) => `<div class="kv"><span>${k}</span><span class="vals">${v}</span></div>`;
  let h = `<div>${line('زبائن ينضافون', `<b>${custs}</b>`)}${extras ? line('أسطر ثانية لنفس الزبون', `<b>${extras}</b>`) : ''}${line('المجموع بالدينار', amt(sum.IQD, 'IQD'))}${line('المجموع بالدولار', amt(sum.USD, 'USD'))}
    ${skipped ? line('موجودين أصلاً، ما ينضافون', `<b>${skipped}</b>`) : ''}</div>`;
  if (P.bad.length) h += `<div class="warnbox soft">${ic('info')}<span>${countAr(P.bad.length, 'سطر واحد', 'سطرين', 'أسطر', 'سطر')} مبلغه مو مفهوم وما ينضاف: ${esc(P.bad.join('، '))}</span></div>`;
  // importing over an existing book adds to it; to make the app match the file, the book is cleared first
  if (st.customers.length && !s.busy) h += `<div class="warnbox soft">${ic('info')}<span>التطبيق بي ${countAr(st.customers.length, 'زبون واحد', 'زبونين', 'زبائن', 'زبون')} هسه، والملف ينضاف عليهم. حتى يصير التطبيق مثل الملف بالضبط، صفّر الدفتر أول.</span></div><button class="btn btn-ghost block" data-act="reset">${ic('trash')}تصفير الدفتر</button>`;
  h += warn;
  h += `<div class="list">${P.rows.map(r => {
    const amts = ['IQD', 'USD'].filter(cur => r[cur]).map(cur => amt(Math.abs(r[cur]), cur, r[cur] > 0 ? 'owe' : 'cred')).join('');
    const sub = [];
    if (r.skip) sub.push('<span class="pill off">موجود</span>');
    else if (r.done) sub.push('<span class="pill ok">انضاف</span>');
    else if (r.extra) sub.push('<span class="pill soon">ينضاف لنفس الزبون</span>');
    if (r.note) sub.push(esc(r.note));
    if (r.phone) sub.push(`<span dir="ltr">${esc(r.phone)}</span>`);
    if (r.memo) sub.push(esc(r.memo));
    return `<div class="imp-row${r.skip || r.done ? ' skip' : ''}"><span class="main"><b>${esc(r.name)}</b>${sub.length ? `<small>${sub.join(' · ')}</small>` : ''}</span><span class="bal">${amts || '<span class="pill ok">مسدد</span>'}</span></div>`;
  }).join('')}</div>`;
  h += `<p class="note">${ic('info')}<span>كل رصيد ينكتب بكشف الزبون باسم «${P.backup ? 'رصيد منقول من نسخة احتياطية' : 'رصيد سابق من الدفتر'}»، وتكدر تعدّله أو تحذفه بعدين.</span></p>`;
  body.innerHTML = h;
  const label = custs ? `استيراد ${countAr(custs, 'زبون واحد', 'زبونين', 'زبائن', 'زبون')}` : todo.length ? `استيراد ${countAr(todo.length, 'سطر واحد', 'سطرين', 'أسطر', 'سطر')}` : 'ماكو زبائن جدد';
  foot.innerHTML = s.busy
    ? `<button class="btn btn-primary grow" id="imp-go" disabled>جاري الاستيراد…</button>`
    : `<button class="btn btn-primary grow" id="imp-go" data-act="imp-go" ${todo.length ? '' : 'disabled'}>${ic('check')}${label}</button>${pick(false)}`;
}
async function readImportFile(file){
  const s = sheetState; if (!s || s.kind !== 'import' || !file || s.busy) return;
  Object.assign(s, {file: file.name, parsed: null, err: '', reading: true}); renderImport();
  try {
    if (!window.XLSX) {
      try { await loadScript(XLSX_URL); } catch (err) { throw new Error('reader'); }
    }
    const X = window.XLSX, found = findImportTable(X, X.read(await file.arrayBuffer(), {type: 'array'}));
    if (found) s.parsed = parseImport(found);
    else s.err = 'ما لكيت بالملف عمود «الاسم» ووياه عمود «دينار» أو «دولار». اختار ملف الأرصدة، أو نسخة احتياطية نزلتها من التطبيق.';
  } catch (err) {
    console.warn(err);
    s.err = err && err.message === 'reader' ? 'ما گدرت أحمّل قارئ الإكسل. تأكد من النت وجرّب مرة ثانية.' : 'ما انفتح الملف. تأكد إنه ملف إكسل (xlsx).';
  }
  s.reading = false;
  if (sheetState === s) renderImport();
}
async function runImport(){
  const s = sheetState; if (!s || s.kind !== 'import' || !s.parsed || s.busy) return;
  const rows = s.parsed.rows, todo = rows.filter(r => !r.skip && !r.done);
  if (!todo.length) { renderImport(); return; }
  if (!navigator.onLine) { s.err = 'لازم يكون اكو نت حتى تستورد.'; renderImport(); return; }
  s.busy = true; s.err = ''; renderImport();
  const m = me(), now = Date.now(), today = todayISO();
  const tally = s.tally || (s.tally = {custs: 0, IQD: 0, USD: 0});
  const base = s.parsed.backup ? 'رصيد منقول من نسخة احتياطية' : 'رصيد سابق من الدفتر';
  const heads = new Map(); for (const r of rows) if (!r.skip && !r.extra) heads.set(r.key, r);
  let seq = m.seq || 0, done = 0;
  const progress = () => { const b = $('#imp-go'); if (b) b.textContent = `جاري الاستيراد… ${done} من ${todo.length}`; };
  progress();
  // One small batch per line (the customer, or another line of the same customer, with its opening entries),
  // so the security rules' per-request document reads stay under Firestore's limit. The SDK sends batches in order.
  const jobs = todo.map((r, i) => {
    const head = heads.get(r.key), t = now - i, b = writeBatch(fs);
    if (!head.cid) head.cid = doc(col('customers')).id;
    if (r === head) {
      b.set(ref('customers', head.cid), {name: r.name, phone: r.phone, note: r.note, limitIQD: 0, limitUSD: 0, createdAt: t, createdBy: m.id,
        bal: {IQD: r.IQD, USD: r.USD}, due: (r.IQD > 0 || r.USD > 0) && r.due ? r.due : null, lastAt: t, imported: true});
    } else {
      const patch = {lastAt: t};
      if (r.IQD) patch['bal.IQD'] = increment(r.IQD);
      if (r.USD) patch['bal.USD'] = increment(r.USD);
      if (r.phone && !head.phone) patch.phone = r.phone;
      b.update(ref('customers', head.cid), patch);
    }
    for (const cur of ['IQD', 'USD']) {
      const v = r[cur]; if (!v) continue;
      seq++;
      b.set(doc(col('entries')), {cid: head.cid, no: `${m.code || 0}-${String(seq).padStart(4, '0')}`, type: v > 0 ? 'debt' : 'pay', amount: Math.abs(v), cur,
        note: base + (r.page ? ` — ص${r.page}` : '') + (r.memo ? ` — ${r.memo}` : ''), date: today, due: v > 0 ? (r.due || null) : null, by: m.id, at: t, serverAt: serverTimestamp(),
        status: 'approved', approvedBy: m.id, approvedAt: t, edits: [], opening: true});
    }
    b.update(ref('users', m.id), {seq});
    return b.commit().then(() => {
      r.done = true; done++; progress();
      if (r === head) tally.custs++;
      tally.IQD += r.IQD; tally.USD = r2(tally.USD + r.USD);
    });
  });
  st.me = Object.assign({}, m, {seq});
  st.inflight++;
  // a line whose batch did not go through is written again on the next press; finished lines are never written twice
  const results = await Promise.allSettled(jobs);
  try {
    const failed = results.find(x => x.status === 'rejected');
    if (failed) throw failed.reason;
    const lb = writeBatch(fs);
    lb.set(doc(col('log')), Object.assign(logOf('import', null), {count: tally.custs, sumIQD: tally.IQD, sumUSD: tally.USD, file: s.file}));
    await lb.commit();
    closeSheet();
    go({tab: 'customers', view: null, q: '', filter: 'all'});
    toast(`انضاف ${countAr(tally.custs, 'زبون واحد', 'زبونين', 'زبائن', 'زبون')} وويا أرصدتهم`);
  } catch (err) {
    console.warn(err);
    s.busy = false;
    s.err = `وكف الاستيراد بعد ${done} من ${todo.length}. اضغط «استيراد» مرة ثانية حتى يكمل الباقي، واللي انضاف ما يتكرر.`;
    if (sheetState === s) renderImport();
    toastErr(err);
  } finally { st.inflight--; }
}

/* ---------- reset (owner): clear every customer and debt before importing a new file ----------
   Nothing is hard-deleted (the rules forbid it): customers are archived with a zero balance and
   entries are marked deleted, after the owner has downloaded a full Excel backup. */
function openReset(){
  sheetState = {kind: 'reset', backed: false, busy: false, err: '', word: '', done: 0, total: 0};
  openSheet(`${sheetHead('تصفير الدفتر', 'يشيل كل الزبائن والديون من التطبيق')}<div class="sheet-body" id="rs-body"></div><div class="sheet-foot" id="rs-foot"></div>`, renderReset);
}
function renderReset(){
  const s = sheetState; if (!s || s.kind !== 'reset') return;
  const body = $('#rs-body'), foot = $('#rs-foot'); if (!body || !foot) return;
  const n = st.customers.length;
  if (!n && !s.busy) {
    body.innerHTML = `<div class="empty">${ic('check')}<span>ماكو زبائن ولا ديون بالتطبيق. تكدر تستورد ملفك مباشرة.</span></div>`;
    foot.innerHTML = `<button class="btn btn-primary grow" data-act="import">${ic('doc')}استيراد من إكسل</button>`;
    return;
  }
  const t = totals(), ready = s.backed && !s.busy;
  body.innerHTML = `<div>
      <div class="kv"><span>الزبائن</span><b>${n}</b></div>
      <div class="kv"><span>المطلوب بالدينار</span>${amt(t.IQD, 'IQD')}</div>
      <div class="kv"><span>المطلوب بالدولار</span>${amt(t.USD, 'USD')}</div></div>
    <p class="note">${ic('info')}<span>كل هذا ينشال. الموظفين والإعدادات وسجل الحركات يبقون، وما تنرسل رسائل للزبائن.</span></p>
    <div class="step${s.backed ? ' done' : ''}"><b>١. نزّل نسخة احتياطية</b><span>ملف إكسل بكل الديون الحالية. إذا احتجتها بعدين، تستوردها من «استيراد من إكسل».</span>
      <button class="btn ${s.backed ? 'btn-ghost' : 'btn-primary'} block" data-act="rs-backup" ${s.busy ? 'disabled' : ''}>${ic(s.backed ? 'check' : 'download')}${s.backed ? 'نزلت النسخة' : 'نزّل النسخة'}</button></div>
    <div class="step${s.backed ? '' : ' off'}"><b>٢. اكتب «امسح» حتى تأكد</b>
      <input class="input" id="rs-word" autocomplete="off" placeholder="امسح" value="${esc(s.word)}" ${ready ? '' : 'disabled'}></div>
    ${s.err ? `<div class="warnbox">${ic('alert')}<span>${s.err}</span></div>` : ''}`;
  foot.innerHTML = `<button class="btn btn-danger grow" id="rs-go" data-act="rs-go" ${ready ? '' : 'disabled'}>${ic('trash')}${s.busy ? `جاري المسح… ${s.done} من ${s.total}` : 'امسح كل الديون'}</button>`;
}
function resetProgress(){ const s = sheetState, b = $('#rs-go'); if (s && b) b.textContent = `جاري المسح… ${s.done} من ${s.total}`; }
async function resetBackup(btn){
  const s = sheetState; if (!s || s.kind !== 'reset' || s.busy) return;
  const ok = await exportExcel(btn, `دفتر-الديون-قبل-التصفير-${todayISO()}.xlsx`);
  if (!ok || sheetState !== s) return;
  s.backed = true; s.err = ''; renderReset();
  const w = $('#rs-word'); if (w) w.focus({preventScroll: true});
}
async function runReset(){
  const s = sheetState; if (!s || s.kind !== 'reset' || s.busy || !s.backed) return;
  if (norm(s.word) !== norm('امسح')) { s.err = 'اكتب كلمة «امسح» بالمربع حتى يمسح.'; renderReset(); return; }
  if (!navigator.onLine) { s.err = 'لازم يكون اكو نت حتى تمسح.'; renderReset(); return; }
  Object.assign(s, {busy: true, err: '', done: 0, total: 0}); renderReset();
  const m = me(), now = Date.now();
  st.inflight++;
  try {
    const [cs, es] = await Promise.all([getDocsFromServer(col('customers')), getDocsFromServer(col('entries'))]);
    const ops = [];
    cs.forEach(d => { if (!d.data().archived) ops.push({k: 'c', id: d.id}); });
    es.forEach(d => { const e = d.data(); if (e.status !== 'deleted') ops.push({k: 'e', id: d.id, status: e.status}); });
    const nC = ops.filter(o => o.k === 'c').length, nE = ops.length - nC;
    s.total = ops.length; resetProgress();
    // five documents per request keeps the security rules' document reads under Firestore's per-request limit
    for (let i = 0; i < ops.length; i += 5) {
      const b = writeBatch(fs);
      for (const o of ops.slice(i, i + 5)) {
        if (o.k === 'c') b.update(ref('customers', o.id), {archived: true, archivedAt: now, archivedBy: m.id, bal: {IQD: 0, USD: 0}, due: null});
        else b.update(ref('entries', o.id), {status: 'deleted', prevStatus: o.status, deletedBy: m.id, deletedAt: now, resetAt: now});
      }
      await b.commit();
      s.done = Math.min(ops.length, i + 5); resetProgress();
    }
    const lb = writeBatch(fs);
    lb.set(doc(col('log')), Object.assign(logOf('reset', null), {customers: nC, entries: nE}));
    await lb.commit();
    closeSheet();
    go({tab: 'customers', view: null, q: '', filter: 'all'});
    toast('انمسحت كل الديون. هسه تكدر تستورد الملف الجديد');
  } catch (err) {
    console.warn(err);
    s.busy = false;
    s.err = `وكف المسح بعد ${s.done} من ${s.total}. اضغط «امسح كل الديون» مرة ثانية حتى يكمل.`;
    if (sheetState === s) renderReset();
    toastErr(err);
  } finally { st.inflight--; }
}

/* ---------- phone numbers from Excel: fills customers' numbers, never touches their debts ----------
   A row finds its customer by name and area, or by name alone when only one customer has it. */
function openPhones(){
  sheetState = {kind: 'phones', file: '', plan: null, busy: false, reading: false, err: ''};
  openSheet(`${sheetHead('أرقام الهواتف من إكسل', 'تنحفظ للزبائن الموجودين، والديون ما تتغير')}<div class="sheet-body" id="ph-body"></div><div class="sheet-foot" id="ph-foot"></div>`, renderPhones);
}
function planPhones(found){
  const {c, rows, start} = found, cell = (row, i) => i >= 0 && row[i] != null ? row[i] : '';
  const text = v => String(v).trim().replace(/\s+/g, ' ');
  const byKey = new Map(), byName = new Map();
  for (const x of st.customers) { byKey.set(custKey(x.name, x.note), x); const n = norm(x.name); byName.set(n, byName.has(n) ? null : x); }
  const plan = {update: new Map(), same: 0, missing: [], bad: [], empty: 0};
  rows.forEach((row, i) => {
    const name = text(cell(row, c.name)); if (!name || norm(name) === norm('المجموع')) return;
    const phone = normPhone(cell(row, c.phone));
    if (!phone) { plan.empty++; return; }
    const cu = byKey.get(custKey(name, text(cell(row, c.note)))) || byName.get(norm(name));
    if (!cu) { plan.missing.push(`${name} (السطر ${start + i})`); return; }
    if (!phoneOk(phone)) { plan.bad.push(`${name}: ${phone}`); return; }
    if (waPhone(cu.phone) === waPhone(phone)) { plan.same++; return; }
    plan.update.set(cu.id, {cu, phone});   // the same customer twice: the later line wins
  });
  return plan;
}
function renderPhones(){
  const s = sheetState; if (!s || s.kind !== 'phones') return;
  const body = $('#ph-body'), foot = $('#ph-foot'); if (!body || !foot) return;
  const warn = s.err ? `<div class="warnbox">${ic('alert')}<span>${s.err}</span></div>` : '';
  const pick = primary => `<label class="btn ${primary ? 'btn-primary' : 'btn-ghost'} grow filepick">${ic('doc')}${s.plan ? 'ملف ثاني' : 'اختار الملف'}<input type="file" id="ph-file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></label>`;
  if (!st.customers.length) {
    body.innerHTML = `<div class="empty">${ic('users')}<span>ماكو زبائن بالتطبيق. استورد الملف من «استيراد من إكسل»، والأرقام اللي بي تدخل وياه.</span></div>`;
    foot.innerHTML = `<button class="btn btn-primary grow" data-act="import">${ic('doc')}استيراد من إكسل</button>`;
    return;
  }
  if (s.reading) { body.innerHTML = `<div class="empty"><div class="spin" role="status" aria-label="جاري القراءة"></div><span>جاري قراءة الملف…</span></div>`; foot.innerHTML = ''; return; }
  if (!s.plan) {
    body.innerHTML = `<p class="lead">اختار ملف الإكسل اللي بي عمود «الاسم» وعمود «الهاتف». كل رقم ينحفظ للزبون اللي بنفس الاسم بالتطبيق.</p>
      <p class="note">${ic('info')}<span>الديون والحركات ما تتغير، وما ينضاف زبون جديد. قبل الحفظ تشوف كل الأرقام.</span></p>${warn}`;
    foot.innerHTML = pick(true);
    return;
  }
  const P = s.plan, ups = [...P.update.values()].filter(u => !u.done);
  const line = (k, v) => `<div class="kv"><span>${k}</span><span class="vals"><b>${v}</b></span></div>`;
  let h = `<div>${line('أرقام تنحفظ', ups.length)}${P.same ? line('نفس الرقم الموجود', P.same) : ''}</div>`;
  if (P.missing.length) h += `<div class="warnbox soft">${ic('info')}<span>${countAr(P.missing.length, 'اسم واحد', 'اسمين', 'أسماء', 'اسم')} ما لكيته بالتطبيق، فرقمه ما ينحفظ: ${esc(P.missing.join('، '))}</span></div>`;
  if (P.bad.length) h += `<div class="warnbox soft">${ic('info')}<span>${countAr(P.bad.length, 'رقم واحد', 'رقمين', 'أرقام', 'رقم')} مو مضبوط وما ينحفظ: ${esc(P.bad.join('، '))}</span></div>`;
  h += warn;
  if (ups.length) h += `<div class="list">${ups.map(u => `<div class="imp-row"><span class="main"><b>${esc(u.cu.name)}</b><small>${[u.cu.note ? esc(u.cu.note) : '', u.cu.phone ? `يتبدل من <span dir="ltr">${esc(u.cu.phone)}</span>` : ''].filter(Boolean).join(' · ')}</small></span><span class="bal" dir="ltr">${esc(u.phone)}</span></div>`).join('')}</div>`;
  body.innerHTML = h;
  foot.innerHTML = s.busy
    ? `<button class="btn btn-primary grow" id="ph-go" disabled>جاري الحفظ…</button>`
    : `<button class="btn btn-primary grow" id="ph-go" data-act="ph-go" ${ups.length ? '' : 'disabled'}>${ic('check')}${ups.length ? `حفظ ${countAr(ups.length, 'رقم واحد', 'رقمين', 'أرقام', 'رقم')}` : 'ماكو أرقام جديدة'}</button>${pick(false)}`;
}
async function readPhonesFile(file){
  const s = sheetState; if (!s || s.kind !== 'phones' || !file || s.busy) return;
  Object.assign(s, {file: file.name, plan: null, err: '', reading: true}); renderPhones();
  try {
    if (!window.XLSX) { try { await loadScript(XLSX_URL); } catch (err) { throw new Error('reader'); } }
    const X = window.XLSX, found = findImportTable(X, X.read(await file.arrayBuffer(), {type: 'array'}), 'phone');
    if (found) s.plan = planPhones(found);
    else s.err = 'ما لكيت بالملف عمود «الاسم» ووياه عمود «الهاتف».';
  } catch (err) {
    console.warn(err);
    s.err = err && err.message === 'reader' ? 'ما گدرت أحمّل قارئ الإكسل. تأكد من النت وجرّب مرة ثانية.' : 'ما انفتح الملف. تأكد إنه ملف إكسل (xlsx).';
  }
  s.reading = false;
  if (sheetState === s) renderPhones();
}
async function runPhones(){
  const s = sheetState; if (!s || s.kind !== 'phones' || !s.plan || s.busy) return;
  const ups = [...s.plan.update.values()].filter(u => !u.done);
  if (!ups.length) return;
  if (!navigator.onLine) { s.err = 'لازم يكون اكو نت حتى تحفظ.'; renderPhones(); return; }
  s.busy = true; s.err = ''; renderPhones();
  st.inflight++;
  try {
    // five customers per request keeps the security rules' document reads under Firestore's limit
    for (let i = 0; i < ups.length; i += 5) {
      const b = writeBatch(fs), part = ups.slice(i, i + 5);
      for (const u of part) b.update(ref('customers', u.cu.id), {phone: u.phone});
      await b.commit();
      part.forEach(u => { u.done = true; });
      const g = $('#ph-go'); if (g) g.textContent = `جاري الحفظ… ${Math.min(ups.length, i + 5)} من ${ups.length}`;
    }
    const total = [...s.plan.update.values()].length;
    const lb = writeBatch(fs);
    lb.set(doc(col('log')), Object.assign(logOf('phones', null), {count: total, file: s.file}));
    await lb.commit();
    closeSheet(); render();
    toast(`انحفظ ${countAr(total, 'رقم واحد', 'رقمين', 'أرقام', 'رقم')} للزبائن`);
  } catch (err) {
    console.warn(err);
    s.busy = false;
    s.err = 'وكف الحفظ بالنص. اضغط «حفظ» مرة ثانية حتى يكمل الباقي.';
    if (sheetState === s) renderPhones();
    toastErr(err);
  } finally { st.inflight--; }
}

/* ---------- more (owner) ---------- */
function moreScreen(){
  const team = st.users.filter(u => u.role !== 'owner' && !u.removed), waiting = team.filter(u => !u.active && !u.code).length;
  return `<div class="titlebar"><h1 class="h1">المزيد</h1></div>
    <section class="about"><img class="app-icon sm" src="icons/icon-192.png" alt=""><div><b>دفتر الديون</b><small>${esc(st.shop.name)}</small></div></section>
    <div class="list">
      <button class="row" data-act="go" data-v="log"><span class="mi">${ic('list')}</span><span class="main"><span class="name">سجل الحركات</span><span class="sub">كل تسجيل وموافقة ورفض وتعديل وحذف، ومنو سواه</span></span>${ic('back', 'flip')}</button>
      <button class="row" data-act="go" data-v="users"><span class="mi">${ic('shield')}</span><span class="main"><span class="name">الموظفين والصلاحيات</span><span class="sub">${waiting ? `<span class="pill wait">${countAr(waiting, 'واحد ينتظر التفعيل', 'اثنين ينتظرون التفعيل', 'ينتظرون التفعيل', 'ينتظرون التفعيل')}</span>` : countAr(team.length + 1, 'مستخدم واحد', 'مستخدمين اثنين', 'مستخدمين', 'مستخدم')}</span></span>${ic('back', 'flip')}</button>
      <button class="row" data-act="go" data-v="settings"><span class="mi">${ic('store')}</span><span class="main"><span class="name">إعدادات المحل</span><span class="sub">الاسم والرقم اللي يطلعون بالرسائل</span></span>${ic('back', 'flip')}</button>
      <button class="row" data-act="import"><span class="mi">${ic('doc')}</span><span class="main"><span class="name">استيراد من إكسل</span><span class="sub">أرصدة الدفتر الورقي، أو نسخة احتياطية</span></span>${ic('back', 'flip')}</button>
      <button class="row" data-act="phones"><span class="mi">${ic('phone')}</span><span class="main"><span class="name">أرقام الهواتف من إكسل</span><span class="sub">تحفظ أرقام الزبائن بدون ما تتغير ديونهم</span></span>${ic('back', 'flip')}</button>
      <button class="row" data-act="reset"><span class="mi danger">${ic('trash')}</span><span class="main"><span class="name">تصفير الدفتر</span><span class="sub">يشيل كل الزبائن والديون قبل ما تستورد ملف جديد</span></span>${ic('back', 'flip')}</button>
      ${isStandalone() ? '' : `<button class="row" data-act="install"><span class="mi">${ic('phoneapp')}</span><span class="main"><span class="name">ثبّت التطبيق على الموبايل</span><span class="sub">حتى تطلع أيقونة محمود ناجي على الشاشة</span></span>${ic('back', 'flip')}</button>`}
    </div>`;
}
const FIELD_AR = {type: 'النوع', amount: 'المبلغ', cur: 'العملة', note: 'الملاحظة', date: 'التاريخ', due: 'موعد التسديد'};
function changesText(ch, cur){
  return Object.keys(ch || {}).map(k => {
    const [a, b] = ch[k];
    const f = v => k === 'amount' ? amtText(v, ch.cur ? ch.cur[1] : cur) : k === 'cur' ? CUR_WORD[v] : (k === 'date' || k === 'due') ? (v ? fmtDate(v) : 'بدون') : (v || 'فارغة');
    return `${FIELD_AR[k]} من ${f(a)} إلى ${f(b)}`;
  }).join('، ');
}
function logText(ev){
  const who = esc(uname(ev.by)), cn = ev.cname ? `<b>${esc(ev.cname)}</b>` : '';
  const what = ev.etype ? `${ev.etype === 'debt' ? 'دين' : 'تسديد'} ${amtText(ev.amount, ev.cur)}` : '';
  switch (ev.type) {
    case 'create': return ev.etype === 'pay' ? `${who} سجّل ${what} من ${cn}` : `${who} سجّل ${what} على ${cn}`;
    case 'approve': return `${who} وافق على ${what} بحساب ${cn}`;
    case 'reject': return `${who} رفض ${what} بحساب ${cn}${ev.reason ? `: ${esc(ev.reason)}` : ''}`;
    case 'edit': return `${who} عدّل الوصل <span dir="ltr">${noTag(ev.no)}</span> بحساب ${cn}: ${esc(changesText(ev.changes, ev.cur))}`;
    case 'delete': return `${who} حذف ${what} من حساب ${cn}`;
    case 'restore': return `${who} رجّع ${what} لحساب ${cn}`;
    case 'customer_add': return `${who} أضاف الزبون ${cn}`;
    case 'customer_edit': return `${who} عدّل بيانات ${cn}`;
    case 'user_role': return `${who} غيّر لقب ${esc(ev.name)} إلى ${ROLES[ev.role] || ''}`;
    case 'user_perm': return `${who} ${ev.on ? 'عطى' : 'شال من'} ${esc(ev.name)} صلاحية ${PERM_SHORT[ev.perm] || ''}`;
    case 'user_active': return `${who} ${ev.active ? 'فعّل' : 'أوقف'} حساب ${esc(ev.name)}`;
    case 'user_removed': return `${who} شال حساب ${esc(ev.name)}`;
    case 'user_restored': return `${who} رجّع حساب ${esc(ev.name)}`;
    case 'settings': return `${who} عدّل إعدادات المحل`;
    case 'import': return `${who} استورد ${countAr(ev.count || 0, 'زبون واحد', 'زبونين', 'زبائن', 'زبون')} وأرصدتهم من ملف إكسل${ev.file ? ` <span dir="auto">(${esc(ev.file)})</span>` : ''}`;
    case 'phones': return `${who} حفظ ${countAr(ev.count || 0, 'رقم واحد', 'رقمين', 'أرقام', 'رقم')} هواتف للزبائن من ملف إكسل${ev.file ? ` <span dir="auto">(${esc(ev.file)})</span>` : ''}`;
    case 'reset': return `${who} صفّر الدفتر وشال ${countAr(ev.customers || 0, 'زبون واحد', 'زبونين', 'زبائن', 'زبون')} و${countAr(ev.entries || 0, 'حركة وحدة', 'حركتين', 'حركات', 'حركة')}`;
  }
  return '';
}
const EV_IC = {create: 'plus', approve: 'check', reject: 'x', edit: 'edit', delete: 'trash', restore: 'undo', customer_add: 'user', customer_edit: 'edit', user_role: 'shield', user_perm: 'shield', user_active: 'shield', settings: 'store', import: 'doc', reset: 'trash', phones: 'phone', user_removed: 'trash', user_restored: 'undo'};
function logScreen(){
  if (!st.logList) return loadingBox();
  let h = '<p class="lead">كل شي ينسوى بالدفتر ينحفظ هنا، ومحد يكدر يمسحه. الحركة المحذوفة تكدر ترجعها.</p>';
  if (!st.logList.length) return h + `<div class="empty">${ic('list')}<span>بعد ماكو حركات.</span></div>`;
  let lastDay = '', open = false;
  for (const ev of st.logList) {
    const day = isoOf(new Date(ev.at));
    if (day !== lastDay) { if (open) h += '</div>'; const rd = relDay(day); h += `<div class="day-h">${rd === 'اليوم' || rd === 'أمس' ? rd + '، ' + fmtDate(day) : fmtDate(day)}</div><div class="list">`; lastDay = day; open = true; }
    const e = ev.eid ? ent(ev.eid) : null;
    const restore = ev.type === 'delete' && ev.eid ? `<button class="mini" data-act="restore" data-id="${ev.eid}">${ic('undo')}رجّعها</button>` : '';
    h += `<div class="ev"><span class="ev-ic ${ev.type}">${ic(EV_IC[ev.type] || 'info')}</span><div class="ev-body"><p>${logText(ev)}</p><small>${fmtTime(ev.at)}</small></div>${restore && (!e || e.status === 'deleted') ? restore : ''}</div>`;
  }
  return h + (open ? '</div>' : '');
}
function usersScreen(){
  const link = appLink();
  let h = `<p class="lead">كل موظف يفتح رابط التطبيق من موبايله ويسوي حساب بإيميله، وبعدها يطلع هنا حتى تفعّله وتختار صلاحياته.</p>
    <div class="linkbox"><span dir="ltr">${esc(link)}</span><button class="mini" data-act="copy" data-text="${esc(link)}">${ic('copy')}نسخ الرابط</button></div>`;
  const waiting = st.users.filter(u => u.role !== 'owner' && !u.removed && !u.active && !u.code);
  if (waiting.length) h += `<section class="stack"><div class="sec-h"><h2>ينتظرون التفعيل</h2><span>${waiting.length}</span></div><div class="list">${waiting.map(u =>
    `<div class="urow"><span class="av">${esc(initial(u.name))}</span><span class="main"><b>${esc(u.name)}</b><small dir="ltr">${esc(u.email || '')}</small></span><button class="iconbtn danger" data-act="rm-user" data-id="${u.id}" aria-label="شيل حساب ${esc(u.name)}">${ic('trash')}</button><button class="btn btn-primary" data-act="activate" data-id="${u.id}">تفعيل</button></div>`).join('')}</div></section>`;
  h += '<div class="list">';
  for (const u of st.users.filter(x => x.role === 'owner' || (!x.removed && (x.active || x.code)))) {
    if (u.role === 'owner') { h += `<div class="row" style="cursor:default"><span class="av">${esc(initial(u.name))}</span><span class="main"><span class="name">${esc(u.name)}</span><span class="sub">صاحب الدفتر، وعنده كل الصلاحيات</span></span><span class="role owner">المدير</span></div>`; continue; }
    const on = PERMS.filter(p => u.perms && u.perms[p.k]);
    const pills = !u.active ? '<span class="pill late">الحساب موقوف</span>' : on.length ? on.map(p => `<span class="pill ${p.k === 'messages' ? 'ok' : 'off'}">${PERM_SHORT[p.k]}</span>`).join('') : '<span class="pill off">يسجل بس</span>';
    h += `<button class="row" data-act="edit-user" data-id="${u.id}"><span class="av">${esc(initial(u.name))}</span><span class="main"><span class="name">${esc(u.name)} <span class="role">${ROLES[u.role]}</span></span><span class="pills">${pills}</span></span>${ic('back', 'flip')}</button>`;
  }
  h += '</div>';
  const removed = st.users.filter(u => u.role !== 'owner' && u.removed);
  if (removed.length) h += `<section class="stack"><div class="sec-h"><h2>حسابات مشالة</h2><span>${removed.length}</span></div><div class="list">${removed.map(u =>
    `<div class="urow"><span class="av">${esc(initial(u.name))}</span><span class="main"><b>${esc(u.name)}</b><small dir="ltr">${esc(u.email || '')}</small></span><button class="mini" data-act="unrm-user" data-id="${u.id}">${ic('undo')}رجّعه</button></div>`).join('')}</div></section>`;
  h += `<section class="stack"><div class="sec-h"><h2>بس إلك</h2></div><div class="list perm" style="padding:0 14px">${OWNER_ONLY.map(x => `<div class="kv"><span>${x}</span>${ic('shield')}</div>`).join('')}</div></section>`;
  return h;
}
// Accounts are never deleted (the rules forbid it, and old receipts keep showing who wrote them):
// a removed account is switched off, leaves every list, and can be brought back.
function openRemoveUser(id){
  const u = userById(id); if (!u || u.role === 'owner') return;
  openSheet(`${sheetHead(`شيل حساب ${esc(u.name)}؟`, u.email ? `<span dir="ltr">${esc(u.email)}</span>` : '')}
    <div class="sheet-body"><p class="lead" style="color:var(--ink)">ما يكدر يدخل للتطبيق بعد، ويختفي من قائمة الموظفين. الحركات اللي سجلها تبقى باسمه بالدفتر وبالسجل.</p>
      <p class="note">${ic('info')}<span>إذا احتجته، ترجّعه من «حسابات مشالة» بأسفل صفحة الموظفين.</span></p></div>
    <div class="sheet-foot"><button class="btn btn-danger grow" data-act="rm-user-go" data-id="${u.id}">${ic('trash')}شيل الحساب</button><button class="btn btn-ghost grow" data-act="close-sheet">إلغاء</button></div>`);
}
function settingsScreen(){
  return `<form class="form" id="settings-form" novalidate>
    <p class="lead">هاي المعلومات تطلع بكل رسالة واتساب توصل للزبون.</p>
    <div class="field"><label for="s-name">اسم المحل</label><input class="input" id="s-name" value="${esc(st.shop.name)}" autocomplete="organization"></div>
    <div class="field"><label for="s-phone">رقم المحل للاستفسار</label><input class="input" id="s-phone" dir="ltr" inputmode="tel" placeholder="07XX XXX XXXX" value="${esc(st.shop.phone)}"></div>
    <button class="btn btn-primary block" type="submit">حفظ</button></form>`;
}

/* ---------- sheets ---------- */
function openSheet(html, onMount){
  $('#sheet-root').innerHTML = `<div class="scrim" data-scrim="1"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  document.documentElement.classList.add('lock');
  if (onMount) onMount();
}
function closeSheet(){ $('#sheet-root').innerHTML = ''; document.documentElement.classList.remove('lock'); sheetState = null; }
const sheetHead = (title, sub) => `<div class="sheet-head"><div class="sheet-tt"><h2 class="sheet-title">${title}</h2>${sub ? `<span class="sheet-sub">${sub}</span>` : ''}</div><button class="iconbtn" data-act="close-sheet" aria-label="إغلاق">${ic('x')}</button></div>`;
function openMessage(title, cid, text){
  const c = cust(cid) || {name: '', phone: ''};
  openSheet(`${sheetHead(esc(title), `إلى ${esc(c.name)}${c.phone ? ` · <span dir="ltr">${esc(c.phone)}</span>` : ''}`)}
    <div class="sheet-body"><div class="bubble" id="msg">${esc(text)}</div>
    ${c.phone ? '' : `<p class="note">${ic('info')}<span>هذا الزبون ما عنده رقم، فالواتساب يخليك تختار المحادثة بنفسك. تكدر تضيف رقمه من «تعديل».</span></p>`}</div>
    <div class="sheet-foot"><a class="btn btn-wa grow" href="${esc(waHref(c, text))}" target="_blank" rel="noopener">${ic('wa')}فتح واتساب</a><button class="btn btn-ghost" data-act="copy-msg">${ic('copy')}نسخ</button></div>`);
}
const messageFor = (e, b) => e.type === 'debt' ? ['رسالة الدين للزبون', msgDebt(e, b)] : ['وصل التسديد للزبون', msgPay(e, b)];
function withEffect(b, e){ const n = {IQD: b.IQD, USD: b.USD}; n[e.cur] = r2(n[e.cur] + effect(e)); return n; }

/* ---------- send the statement to every customer who owes ----------
   WhatsApp lets a page open one chat with a ready message, not send for the user, so this walks the
   list: each tap opens one customer's statement in WhatsApp. Who got it today is remembered on this
   phone; a number typed next to a customer without one is saved to that customer. */
const bulkKey = () => `daftar-bulk-${todayISO()}`;
function bulkLoad(){ try { return new Set(JSON.parse(localStorage.getItem(bulkKey()) || '[]')); } catch (err) { return new Set(); } }
function bulkSave(set){ try { localStorage.setItem(bulkKey(), JSON.stringify([...set])); } catch (err) {} }
async function openBulk(){
  sheetState = {kind: 'bulk', byC: null, sent: bulkLoad(), phones: {}, err: ''};
  const s = sheetState;
  openSheet(`${sheetHead('إرسال الكشف للكل', '<span id="bk-sub"></span>')}<div class="sheet-body" id="bk-body"></div><div class="sheet-foot" id="bk-foot"></div>`, renderBulk);
  try {
    const byC = {};
    for (const e of ents(await getDocs(col('entries')))) if (e.status === 'approved') (byC[e.cid] = byC[e.cid] || []).push(e);
    s.byC = byC;
  } catch (err) { s.err = 'ما گدرت أجيب الحسابات. تأكد من النت وجرّب مرة ثانية.'; toastErr(err); }
  if (sheetState === s) renderBulk();
}
function bulkRows(){
  const s = sheetState, out = [];
  for (const c of st.customers) {
    const L = s.byC[c.id] || [], b = summarize(L).bal;
    if (b.IQD > 0 || b.USD > 0) out.push({c, b, L});
  }
  return out;
}
const bulkPhone = (s, c) => (s.phones[c.id] !== undefined ? s.phones[c.id] : c.phone) || '';
const bulkHref = (s, r) => waHref({phone: bulkPhone(s, r.c)}, msgStatement(r.c.id, r.L));
function renderBulk(){
  const s = sheetState; if (!s || s.kind !== 'bulk') return;
  const body = $('#bk-body'), foot = $('#bk-foot'), sub = $('#bk-sub'); if (!body || !foot) return;
  if (s.err) { body.innerHTML = `<div class="warnbox">${ic('alert')}<span>${s.err}</span></div>`; foot.innerHTML = ''; return; }
  if (!s.byC) { body.innerHTML = loadingBox(); foot.innerHTML = ''; return; }
  const rows = bulkRows(), done = rows.filter(r => s.sent.has(r.c.id)).length, next = rows.find(r => !s.sent.has(r.c.id));
  const canPhone = can.editCustomer(me());
  if (sub) sub.textContent = countAr(rows.length, 'زبون واحد عليه دين', 'زبونين عليهم دين', 'زبائن عليهم دين', 'زبون عليهم دين');
  const pct = rows.length ? Math.round(done / rows.length * 100) : 100;
  let h = `<div class="stack" style="gap:8px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:14px"><b>انرسل ${done} من ${rows.length}</b>${done ? '<button class="linkbtn" data-act="bulk-restart">ابدي من جديد</button>' : ''}</div><div class="meter"><i style="width:${pct}%"></i></div></div>
    <p class="note">${ic('info')}<span>كل ضغطة تفتح الواتساب على كشف زبون جاهز. اضغط إرسال بالواتساب، وارجع للتطبيق للي بعده.${canPhone ? ' اللي ما عنده رقم، اكتب رقمه جنب اسمه وينحفظ وياه.' : ''}</span></p>
    <div class="list">${rows.map(r => {
      const sent = s.sent.has(r.c.id), amts = ['IQD', 'USD'].filter(cur => r.b[cur] > 0).map(cur => amt(r.b[cur], cur, 'owe')).join('');
      const phoneIn = !r.c.phone && canPhone ? `<input class="input bulk-phone" data-cid="${r.c.id}" inputmode="tel" dir="ltr" placeholder="رقم الواتساب" value="${esc(s.phones[r.c.id] || '')}" aria-label="رقم واتساب ${esc(r.c.name)}">` : '';
      const noPhone = !bulkPhone(s, r.c) && !phoneIn ? '<span class="pill off">بدون رقم</span>' : '';
      return `<div class="bulk-row${sent ? ' sent' : ''}"><span class="main"><b>${esc(r.c.name)}</b><small>${r.c.note ? esc(r.c.note) : ''}${noPhone}</small><span class="bal">${amts}</span>${phoneIn}</span>
        <a class="btn ${sent ? 'btn-ghost' : 'btn-wa'} bulk-send" data-bulk="${r.c.id}" href="${esc(bulkHref(s, r))}" target="_blank" rel="noopener">${ic(sent ? 'check' : 'wa')}${sent ? 'انرسل' : 'إرسال'}</a></div>`;
    }).join('')}</div>`;
  body.innerHTML = h;
  foot.innerHTML = next
    ? `<a class="btn btn-wa grow" data-bulk="${next.c.id}" href="${esc(bulkHref(s, next))}" target="_blank" rel="noopener">${ic('wa')}<span class="ell">إرسال لـ${esc(next.c.name)}</span></a>`
    : `<button class="btn btn-ghost grow" data-act="close-sheet">${ic('check')}انرسل الكشف للكل</button>`;
}
function bulkSent(cid){
  const s = sheetState; if (!s || s.kind !== 'bulk' || !s.byC) return;
  const c = cust(cid); if (!c) return;
  const typed = (s.phones[cid] || '').trim();
  if (typed && !c.phone && can.editCustomer(me()) && waPhone(typed)) editCustomer(cid, {phone: typed});
  s.sent.add(cid); bulkSave(s.sent);
  // let the tap open WhatsApp before the list redraws
  setTimeout(() => { if (sheetState === s) renderBulk(); }, 400);
}
function bulkTyped(input){
  const s = sheetState; if (!s || s.kind !== 'bulk' || !s.byC) return;
  const cid = input.dataset.cid; s.phones[cid] = input.value;
  const r = bulkRows().find(x => x.c.id === cid); if (!r) return;
  document.querySelectorAll(`a[data-bulk="${cid}"]`).forEach(a => { a.href = bulkHref(s, r); });
}

function openEntryForm(o){
  const c = cust(o.cid), u = me(), ed = o.edit || null, isStaff = u.role !== 'owner';
  sheetState = {kind: 'entry', cid: o.cid, edit: ed, type: ed ? ed.type : o.type, cur: ed ? ed.cur : lastCur(o.cid), err: ''};
  sheetState.due = ed ? (ed.due || null) : (sheetState.type === 'debt' ? addDays(todayISO(), 30) : null);
  openSheet(`${sheetHead('<span id="f-title"></span>', esc(c.name))}
    <form class="sheet-body" id="entry-form" novalidate>
      ${ed ? '' : '<div class="seg type" role="group" aria-label="نوع الحركة"><button type="button" data-act="f-type" data-v="debt">دين</button><button type="button" data-act="f-type" data-v="pay">تسديد</button></div>'}
      <div class="field"><label for="f-amount">المبلغ</label>
        <div class="amount-row"><input class="input amount" id="f-amount" inputmode="decimal" dir="ltr" autocomplete="off" placeholder="0" value="${ed ? fmtNum(ed.amount, ed.cur) : ''}">
        <div class="seg cur" role="group" aria-label="العملة"><button type="button" data-act="f-cur" data-v="IQD">د.ع</button><button type="button" data-act="f-cur" data-v="USD">$</button></div></div>
        <div class="hint" id="f-hint" aria-live="polite"></div></div>
      <div class="field"><label for="f-note" id="f-note-l">المادة</label><input class="input" id="f-note" autocomplete="off" value="${esc(ed ? ed.note : '')}"></div>
      <div class="two"><div class="field"><label for="f-date">التاريخ</label><input class="input" id="f-date" type="date" value="${ed ? ed.date : todayISO()}"></div>
        <div class="field" id="f-due-wrap"><label for="f-due">موعد التسديد</label><input class="input" id="f-due" type="date" value="${sheetState.due || ''}"></div></div>
      <div class="chips wrap" id="f-due-chips" role="group" aria-label="مواعيد سريعة"></div>
      <div id="f-warn" class="stack" style="gap:8px"></div>
      ${isStaff && !ed ? `<p class="note">${ic('clock')}<span>تنرسل إلى ${esc(ownerName())} حتى يوافق عليها، وبعدها تنحسب على الزبون.</span></p>` : ''}
    </form>
    <div class="sheet-foot"><button class="btn btn-primary grow" data-act="f-save">${isStaff && !ed ? 'إرسال للموافقة' : 'حفظ'}</button></div>`,
    () => { formSync(); const a = $('#f-amount'); if (a && !ed) a.focus({preventScroll: true}); });
}
function formSync(){
  const st2 = sheetState; if (!st2 || st2.kind !== 'entry') return;
  const t = $('#f-title');
  if (t) t.textContent = st2.edit ? `تعديل الوصل ${noTag(st2.edit.no)}` : (st2.type === 'debt' ? 'دين جديد' : 'تسديد');
  document.querySelectorAll('[data-act="f-type"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st2.type)));
  document.querySelectorAll('[data-act="f-cur"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === st2.cur)));
  const isDebt = st2.type === 'debt';
  $('#f-note-l').textContent = isDebt ? 'المادة' : 'ملاحظة';
  $('#f-note').placeholder = isDebt ? 'مثلاً: 2 كارتون صبغة' : 'مثلاً: نقد، أو حوالة';
  $('#f-due-wrap').hidden = !isDebt;
  const chips = $('#f-due-chips'); chips.hidden = !isDebt;
  if (isDebt) {
    const base = $('#f-date').value || todayISO();
    chips.innerHTML = [[7, 'بعد أسبوع'], [14, 'بعد أسبوعين'], [30, 'بعد شهر'], [0, 'بدون موعد']].map(([n, l]) =>
      `<button type="button" class="chip" data-act="f-due" data-d="${n}" aria-pressed="${n ? st2.due === addDays(base, n) : !st2.due}">${l}</button>`).join('');
  }
  const amount = parseAmount($('#f-amount').value);
  $('#f-hint').textContent = amount > 0 ? amountWords(amount, st2.cur) : '';
  const warns = [];
  if (amount > 0 && isDebt) {
    const add = st2.edit && st2.edit.status === 'approved' && st2.edit.cur === st2.cur ? amount - st2.edit.amount : amount;
    const lc = limitCheck(st2.cid, st2.cur, add, st2.edit ? st2.edit.id : null);
    if (lc) warns.push(`<div class="warnbox">${ic('alert')}<span>هذا الدين يخلي رصيد الزبون ${amtText(lc.projected, lc.cur)}، أكثر من سقفه (${amtText(lc.lim, lc.cur)}) بـ ${amtText(lc.over, lc.cur)}.</span></div>`);
  }
  if (amount > 0 && !isDebt && !st2.edit) {
    const b = bal(st2.cid)[st2.cur];
    if (amount > b) warns.push(`<div class="warnbox soft">${ic('info')}<span>${b > 0 ? `المبلغ أكثر من الرصيد (${amtText(b, st2.cur)}).` : `ماكو رصيد عليه بال${CUR_WORD[st2.cur]}.`} الزبون راح يصير إله رصيد عندكم.</span></div>`);
  }
  if (st2.err) warns.unshift(`<div class="warnbox">${ic('alert')}<span>${st2.err}</span></div>`);
  $('#f-warn').innerHTML = warns.join('');
}
function formatAmountInput(el, cur){
  let raw = toLatin(el.value).replace(/٫/g, '.').replace(/[^\d.]/g, '');
  if (cur === 'IQD') raw = raw.replace(/\./g, '');
  else { const i = raw.indexOf('.'); if (i >= 0) raw = raw.slice(0, i + 1) + raw.slice(i + 1).replace(/\./g, '').slice(0, 2); }
  const parts = raw.split('.'), ip = parts[0].replace(/^0+(?=\d)/, '');
  const intFmt = ip ? Number(ip).toLocaleString('en-US') : (parts.length > 1 ? '0' : '');
  el.value = parts.length > 1 ? `${intFmt}.${parts[1]}` : intFmt;
}
function saveEntryForm(){
  const s = sheetState; if (!s || s.kind !== 'entry') return;
  s.err = '';
  let amount = parseAmount($('#f-amount').value);
  const date = $('#f-date').value || todayISO();
  const due = s.type === 'debt' ? ($('#f-due').value || null) : null;
  if (!(amount > 0)) { s.err = 'اكتب المبلغ.'; formSync(); $('#f-amount').focus(); return; }
  if (s.cur === 'IQD') amount = Math.round(amount); else amount = r2(amount);
  if (due && due < date) { s.err = 'موعد التسديد لازم يكون بعد تاريخ الدين.'; formSync(); return; }
  const note = $('#f-note').value.trim();
  if (s.edit) {
    const fresh = ent(s.edit.id) || s.edit;
    const changed = editEntry(fresh, {amount, cur: s.cur, note, date, due});
    closeSheet(); render();
    toast(changed ? 'انحفظ التعديل، وانكتب بالسجل' : 'ماكو تغيير');
    return;
  }
  const before = bal(s.cid);
  const e = addEntry({cid: s.cid, type: s.type, amount, cur: s.cur, note, date, due});
  if (e.status === 'approved') { const [t, m] = messageFor(e, withEffect(before, e)); render(); openMessage(t, e.cid, m); }
  else { closeSheet(); render(); toast(`انرسلت إلى ${ownerName()} حتى يوافق عليها`); }
}
function openEntryDetail(id){
  const e = ent(id); if (!e) return;
  const c = cust(e.cid) || {name: ''}, u = me();
  const rows = [
    ['النوع', `<span class="tl ${e.type}" style="font-size:14px">${e.type === 'debt' ? 'دين' : 'تسديد'}</span>`],
    ['المبلغ', `<span class="vals">${amt(e.amount, e.cur, e.type === 'debt' ? 'owe' : 'cred')}<span class="words">${amountWords(e.amount, e.cur)}</span></span>`, true],
    [e.type === 'debt' ? 'المادة' : 'ملاحظة', e.note ? esc(e.note) : '—'],
    ['التاريخ', fmtDate(e.date, true)]
  ];
  if (e.type === 'debt') rows.push(['موعد التسديد', e.due ? fmtDate(e.due, true) : 'بدون موعد']);
  rows.push(['رقم الوصل', `<span dir="ltr">${noTag(e.no)}</span>`], ['الحالة', `<span class="pill ${e.status === 'approved' ? 'ok' : e.status === 'pending' ? 'wait' : e.status === 'rejected' ? 'late' : 'off'}">${STATUS[e.status] || ''}</span>`]);
  const trail = [{t: e.at, i: 'plus', c: 'create', x: `سجلها ${esc(uname(e.by))}${e.approvedBy && e.approvedBy === e.by ? '، وانحسبت مباشرة' : ''}`}];
  for (const edt of (e.edits || [])) trail.push({t: edt.at, i: 'edit', c: 'edit', x: `عدّلها ${esc(uname(edt.by))}: ${esc(changesText(edt.changes, e.cur))}`});
  if (e.approvedBy && e.approvedBy !== e.by) trail.push({t: e.approvedAt, i: 'check', c: 'approve', x: `وافق عليها ${esc(uname(e.approvedBy))}`});
  if (e.rejectedAt) trail.push({t: e.rejectedAt, i: 'x', c: 'reject', x: `رفضها ${esc(uname(e.rejectedBy))}${e.reason ? `: ${esc(e.reason)}` : ''}`});
  if (e.deletedAt) trail.push({t: e.deletedAt, i: 'trash', c: 'delete', x: `حذفها ${esc(uname(e.deletedBy))}`});
  if (e.restoredAt) trail.push({t: e.restoredAt, i: 'undo', c: 'restore', x: `رجّعها ${esc(uname(e.restoredBy))}`});
  trail.sort((a, b) => a.t - b.t);
  const btns = [];
  if (can.approve(u) && e.status === 'pending') btns.push(`<button class="btn btn-primary grow" data-act="approve" data-id="${e.id}">${ic('check')}قبول</button>`, `<button class="btn btn-ghost danger grow" data-act="reject" data-id="${e.id}">${ic('x')}رفض</button>`);
  if (can.editEntry(u, e)) btns.push(`<button class="btn btn-ghost grow" data-act="edit-entry" data-id="${e.id}">${ic('edit')}تعديل</button>`);
  if (can.message(u) && e.status === 'approved') btns.push(`<button class="btn btn-ghost grow" data-act="resend" data-id="${e.id}">${ic('wa')}رسالة</button>`);
  if (can.deleteEntry(u, e)) btns.push(`<button class="btn btn-ghost danger" data-act="del-entry" data-id="${e.id}" aria-label="حذف">${ic('trash')}</button>`);
  if (e.status === 'deleted' && u.role === 'owner') btns.push(`<button class="btn btn-ghost grow" data-act="restore" data-id="${e.id}">${ic('undo')}رجّعها</button>`);
  openSheet(`${sheetHead(`${e.type === 'debt' ? 'دين' : 'تسديد'} <span dir="ltr">${noTag(e.no)}</span>`, esc(c.name))}
    <div class="sheet-body"><div>${rows.map(([k, v, raw]) => `<div class="kv"><span>${k}</span>${raw ? v : `<span>${v}</span>`}</div>`).join('')}</div>
    <div class="stack" style="gap:6px"><span class="lbl">مراحل الحركة</span><div class="trail">${trail.map(s => `<div class="ev"><span class="ev-ic ${s.c}">${ic(s.i)}</span><div class="ev-body"><p>${s.x}</p><small>${fmtStamp(s.t)}</small></div></div>`).join('')}</div></div></div>
    ${btns.length ? `<div class="sheet-foot">${btns.join('')}</div>` : ''}`);
}
function openReject(id){
  const e = ent(id), c = cust(e.cid) || {name: ''};
  sheetState = {kind: 'reject', id};
  const reasons = ['المبلغ غلط', 'الزبون غلط', 'مكررة', 'ما استلمنا الفلوس'];
  openSheet(`${sheetHead('رفض الحركة', `${esc(c.name)} · ${e.type === 'debt' ? 'دين' : 'تسديد'} ${amtText(e.amount, e.cur)}`)}
    <form class="sheet-body" id="reject-form" novalidate>
      <div class="chips wrap" role="group" aria-label="أسباب جاهزة">${reasons.map(r => `<button type="button" class="chip" data-act="reason" data-v="${esc(r)}">${esc(r)}</button>`).join('')}</div>
      <div class="field"><label for="r-reason">سبب الرفض</label><textarea class="input" id="r-reason" placeholder="اكتب السبب حتى ${esc(uname(e.by))} يعرف شنو يصلح"></textarea></div>
      <p class="note">${ic('info')}<span>الحركة ما تنحسب على الزبون، و${esc(uname(e.by))} يشوف السبب بصفحة طلباته.</span></p>
    </form>
    <div class="sheet-foot"><button class="btn btn-danger grow" data-act="do-reject" data-id="${id}">${ic('x')}رفض</button></div>`);
}
function openDelete(id){
  const e = ent(id), c = cust(e.cid) || {name: ''};
  openSheet(`${sheetHead(`حذف الوصل <span dir="ltr">${noTag(e.no)}</span>؟`, esc(c.name))}
    <div class="sheet-body"><p class="lead" style="color:var(--ink)">${e.type === 'debt' ? 'دين' : 'تسديد'} ${amtText(e.amount, e.cur)}${e.note ? ` (${esc(e.note)})` : ''} ينشال من حساب ${esc(c.name)} وما ينحسب. يبقى بسجل الحركات وتكدر ترجعه.</p></div>
    <div class="sheet-foot"><button class="btn btn-danger grow" data-act="confirm-del" data-id="${id}">${ic('trash')}حذف</button><button class="btn btn-ghost grow" data-act="close-sheet">إلغاء</button></div>`);
}
function openCustomerForm(cid, presetName){
  const c = cid ? cust(cid) : null, u = me();
  sheetState = {kind: 'cust', cid: cid || null, openCur: 'IQD', dupOk: false};
  const limitF = can.setLimit(u) ? `<div class="field"><span class="lbl">سقف الدين (اختياري)</span><div class="two">
      <input class="input" id="c-lim-iqd" inputmode="numeric" dir="ltr" placeholder="بالدينار" aria-label="السقف بالدينار" data-money="IQD" value="${c && c.limitIQD ? fmtNum(c.limitIQD, 'IQD') : ''}">
      <input class="input" id="c-lim-usd" inputmode="decimal" dir="ltr" placeholder="بالدولار" aria-label="السقف بالدولار" data-money="USD" value="${c && c.limitUSD ? fmtNum(c.limitUSD, 'USD') : ''}"></div>
      <span class="note">${ic('info')}<span>إذا دين جديد يعدّي السقف، يطلعلك تنبيه قبل ما توافق.</span></span></div>` : '';
  const opening = c ? '' : `<div class="field"><label for="c-open">رصيد سابق من الدفتر الورقي (اختياري)</label>
      <div class="amount-row"><input class="input amount" id="c-open" inputmode="decimal" dir="ltr" autocomplete="off" placeholder="0" style="font-size:22px">
      <div class="seg cur" role="group" aria-label="عملة الرصيد السابق"><button type="button" data-act="c-cur" data-v="IQD" aria-pressed="true">د.ع</button><button type="button" data-act="c-cur" data-v="USD" aria-pressed="false">$</button></div></div>
      <span class="note">${ic('info')}<span>ينسجل كحركة وحدة باسم «رصيد سابق من الدفتر»${u.role === 'owner' ? '' : `، وتنتظر موافقة ${esc(ownerName())}`}.</span></span></div>`;
  openSheet(`${sheetHead(c ? 'تعديل الزبون' : 'زبون جديد', c ? esc(c.name) : '')}
    <form class="sheet-body" id="cust-form" novalidate>
      <div class="field"><label for="c-name">الاسم</label><input class="input" id="c-name" autocomplete="off" placeholder="اسم الزبون أو المحل" value="${esc(c ? c.name : (presetName || ''))}"></div>
      <div class="two"><div class="field"><label for="c-phone">رقم الواتساب</label><input class="input" id="c-phone" dir="ltr" inputmode="tel" placeholder="07XX XXX XXXX" value="${esc(c ? c.phone : '')}"></div>
        <div class="field"><label for="c-note">المنطقة</label><input class="input" id="c-note" autocomplete="off" placeholder="مثلاً: الكرادة" value="${esc(c ? c.note : '')}"></div></div>
      ${limitF}${opening}<div id="c-warn"></div>
    </form>
    <div class="sheet-foot"><button class="btn btn-primary grow" data-act="c-save">${c ? 'حفظ' : 'إضافة'}</button></div>`,
    () => { if (!c) $('#c-name').focus({preventScroll: true}); });
}
function saveCustomerForm(){
  const s = sheetState, u = me();
  const name = $('#c-name').value.trim().replace(/\s+/g, ' ');
  const warn = msg => { $('#c-warn').innerHTML = `<div class="warnbox">${ic('alert')}<span>${msg}</span></div>`; };
  if (!name) { warn('اكتب اسم الزبون.'); $('#c-name').focus(); return; }
  const patch = {name, phone: $('#c-phone').value.trim(), note: $('#c-note').value.trim()};
  if (can.setLimit(u)) {
    const li = parseAmount($('#c-lim-iqd').value), lu = parseAmount($('#c-lim-usd').value);
    patch.limitIQD = li > 0 ? Math.round(li) : 0; patch.limitUSD = lu > 0 ? r2(lu) : 0;
  }
  if (s.cid) { const ch = editCustomer(s.cid, patch); closeSheet(); render(); toast(ch ? 'انحفظت بيانات الزبون' : 'ماكو تغيير'); return; }
  const dup = st.customers.find(x => norm(x.name) === norm(name));
  if (dup && !s.dupOk) { s.dupOk = true; warn(`اكو زبون بنفس الاسم (${esc(dup.name)}). إذا هذا زبون ثاني، اضغط «إضافة» مرة ثانية.`); return; }
  let open = parseAmount($('#c-open').value);
  open = open > 0 ? (s.openCur === 'IQD' ? Math.round(open) : r2(open)) : 0;
  const c = addCustomer(patch, open ? {amount: open, cur: s.openCur} : null);
  closeSheet(); ui.q = '';
  go({view: {type: 'customer', id: c.id}});
  toast(open && u.role !== 'owner' ? `انضاف الزبون، والرصيد السابق ينتظر موافقة ${ownerName()}` : 'انضاف الزبون');
}
function permRows(u){
  return PERMS.map(p => `<div class="urow"><span class="main"><b>${p.l}</b><small>${p.s}</small></span><button class="switch" role="switch" aria-checked="${!!(u.perms && u.perms[p.k])}" aria-label="${p.l}" data-act="u-perm" data-id="${u.id}" data-k="${p.k}"></button></div>`).join('');
}
function openUserSheet(id){
  const u = userById(id); if (!u || u.role === 'owner') return;
  openSheet(`${sheetHead(esc(u.name), u.email ? `<span dir="ltr">${esc(u.email)}</span>` : 'شنو يكدر يسوي')}
    <div class="sheet-body">
      <div class="field"><span class="lbl">اللقب</span>
        <div class="seg" role="group" aria-label="اللقب"><button type="button" data-act="u-preset" data-id="${u.id}" data-v="supervisor" aria-pressed="${u.role === 'supervisor'}">مشرف</button><button type="button" data-act="u-preset" data-id="${u.id}" data-v="staff" aria-pressed="${u.role === 'staff'}">موظف</button></div>
        <span class="note">${ic('info')}<span>اللقب يرجّع الصلاحيات الأساسية، وبعدها تغيّر كل وحدة بروحها.</span></span></div>
      <div class="field"><span class="lbl">الصلاحيات</span><div class="list" id="u-perms">${permRows(u)}</div></div>
      <div class="list"><div class="urow"><span class="main"><b>الحساب شغال</b><small>إذا وقفته ما يكدر يدخل، وحركاته تبقى باسمه بالسجل.</small></span><button class="switch" role="switch" aria-checked="${!!u.active}" aria-label="الحساب شغال" data-act="toggle-active" data-id="${u.id}"></button></div></div>
      <p class="note">${ic('shield')}<span>الموافقة والرفض والحذف تبقى إلك بس.</span></p>
      <button class="btn btn-ghost danger block" data-act="rm-user" data-id="${u.id}">${ic('trash')}شيل الحساب</button>
    </div>`);
}
function openAccount(){
  const m = me();
  openSheet(`${sheetHead(esc(m.name), `<span dir="ltr">${esc(m.email || '')}</span>`)}
    <div class="sheet-body"><div class="kv"><span>الصلاحية</span><span class="role ${m.role}">${ROLES[m.role]}</span></div>
      ${isStandalone() ? '' : `<button class="btn btn-ghost block" data-act="install">${ic('phoneapp')}ثبّت التطبيق على الموبايل</button>`}
      <button class="btn btn-ghost danger block" data-act="logout">${ic('logout')}تسجيل خروج</button></div>`);
}
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
function openInstall(){
  if (deferredPrompt) { const p = deferredPrompt; deferredPrompt = null; closeSheet(); p.prompt(); return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const steps = ios
    ? '<li>افتح رابط التطبيق من Safari.</li><li>اضغط زر المشاركة (المربع اللي بيه سهم لفوق).</li><li>اختار «إضافة إلى الشاشة الرئيسية»، وبعدها «إضافة».</li>'
    : '<li>افتح رابط التطبيق من Chrome.</li><li>اضغط النقاط الثلاث فوق.</li><li>اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</li>';
  openSheet(`${sheetHead('ثبّت التطبيق', 'حتى تطلع أيقونة محمود ناجي على شاشة الموبايل')}<div class="sheet-body"><ol class="steps">${steps}</ol></div>`);
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(text, action){
  clearTimeout(toastTimer);
  $('#toast-root').innerHTML = `<div class="toast" role="status"><span>${esc(text)}</span>${action ? `<button data-act="${action.act}" data-id="${esc(action.id || '')}">${esc(action.label)}</button>` : ''}</div>`;
  toastTimer = setTimeout(() => { $('#toast-root').innerHTML = ''; }, action ? 6500 : 3200);
}
function toastErr(err){
  const c = (err && err.code) || '';
  if (c.includes('permission-denied')) toast('ما انحفظت: ما عندك صلاحية لهالشي');
  else if (c.includes('unavailable') || c.includes('offline') || c.includes('network')) toast('ماكو نت هسه. جرّب لما يرجع النت');
  else toast('صار خطأ، جرّب مرة ثانية');
  console.warn(err);
}
function copyText(text, ok, el){
  const fallback = () => {
    if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); toast('ظللت النص، انسخه من قائمة الموبايل'); }
    else toast('ما انتسخ. ظلل النص وانسخه');
  };
  try { const p = navigator.clipboard && navigator.clipboard.writeText(text); if (p && p.then) p.then(() => toast(ok), fallback); else fallback(); }
  catch (err) { fallback(); }
}

/* ---------- subscriptions ---------- */
let ownSub = null, dataSubs = [], viewSubs = [], viewKeyActive = '';
function ents(snap){ const out = []; snap.forEach(d => { const e = Object.assign({id: d.id}, d.data()); st.cache.set(e.id, e); out.push(e); }); return out; }
function onSubErr(err){ console.warn(err); if (err && err.code === 'permission-denied') toast('ما عندك صلاحية تشوف هالبيانات'); }
function stopView(){ viewSubs.splice(0).forEach(f => { try { f(); } catch (err) {} }); viewKeyActive = ''; }
function stopData(){ dataSubs.splice(0).forEach(f => { try { f(); } catch (err) {} }); stopView(); st.custReady = false; }
function startData(){
  stopData();
  dataSubs.push(onSnapshot(col('users'), snap => {
    const L = []; snap.forEach(d => L.push(Object.assign({id: d.id}, d.data())));
    st.users = L; st.usersById = Object.fromEntries(L.map(u => [u.id, u])); render();
  }, onSubErr));
  dataSubs.push(onSnapshot(ref('meta', 'shop'), snap => { if (snap.exists()) st.shop = Object.assign({}, SHOP_DEFAULT, snap.data()); render(); }, onSubErr));
  dataSubs.push(onSnapshot(col('customers'), snap => {
    const L = []; snap.forEach(d => L.push(Object.assign({id: d.id}, d.data())));
    // archived customers (cleared by «تصفير الدفتر») stay in custById for names in the log, and leave every list
    st.custById = Object.fromEntries(L.map(c => [c.id, c])); st.customers = L.filter(c => !c.archived).sort(nameOrder); st.custReady = true; render();
  }, onSubErr));
  dataSubs.push(onSnapshot(query(col('entries'), where('status', '==', 'pending')), snap => { st.pending = ents(snap); render(); }, onSubErr));
}
function subKey(){
  if (ui.view) return `${ui.view.type}:${ui.view.id || ''}`;
  if (ui.tab === 'reports') return `reports:${ui.reportTab}:${ui.monthOffset}`;
  return `tab:${ui.tab}`;
}
function syncView(){
  const key = subKey();
  if (key === viewKeyActive) return;
  stopView(); viewKeyActive = key;
  const m = me(); if (!m) return;
  if (ui.view && ui.view.type === 'customer') {
    const cid = ui.view.id;
    st.custEntries = {cid, list: [], loaded: false};
    viewSubs.push(onSnapshot(query(col('entries'), where('cid', '==', cid)), snap => {
      st.custEntries = {cid, list: ents(snap), loaded: true};
      if (m.role === 'owner' && !snap.metadata.fromCache && !snap.metadata.hasPendingWrites) healWith(cid, st.custEntries.list);
      render();
    }, onSubErr));
  } else if (ui.view && ui.view.type === 'log') {
    st.logList = null;
    viewSubs.push(onSnapshot(query(col('log'), orderBy('at', 'desc'), limit(150)), snap => {
      const L = []; snap.forEach(d => L.push(Object.assign({id: d.id}, d.data()))); st.logList = L; render();
    }, onSubErr));
  } else if (!ui.view && ui.tab === 'requests') {
    viewSubs.push(onSnapshot(query(col('entries'), where('by', '==', m.id), where('status', '==', 'pending')), snap => { st.myPending = ents(snap); render(); }, onSubErr));
    viewSubs.push(onSnapshot(query(col('entries'), where('by', '==', m.id), where('status', '==', 'rejected')), snap => { st.myRejected = ents(snap).sort((a, b) => b.at - a.at).slice(0, 40); render(); }, onSubErr));
  } else if (!ui.view && ui.tab === 'reports') {
    if (ui.reportTab === 'today') {
      st.today = null;
      viewSubs.push(onSnapshot(query(col('entries'), where('at', '>=', parseISO(todayISO()).getTime())), snap => { st.today = ents(snap); render(); }, onSubErr));
    } else loadMonth();
  }
}
async function ensureUserDoc(u){
  if (st.creating) return;
  st.creating = true;
  try {
    const email = (u.email || '').trim().toLowerCase();
    const isOwner = (await sha256(email)) === OWNER_HASH;
    const name = (u.displayName || st.signupName || email.split('@')[0]).trim();
    if (isOwner) {
      if (!u.emailVerified) { st.phase = 'verify'; render(); return; }
      await setDoc(ref('users', u.uid), {name, email: u.email, role: 'owner', active: true, perms: {}, code: 1, seq: 0, createdAt: Date.now()});
      const shop = await getDoc(ref('meta', 'shop')).catch(() => null);
      if (shop && !shop.exists()) await setDoc(ref('meta', 'shop'), Object.assign({}, SHOP_DEFAULT));
    } else {
      await setDoc(ref('users', u.uid), {name, email: u.email, role: 'staff', active: false, perms: Object.assign({}, PRESETS.staff), code: 0, seq: 0, createdAt: Date.now()});
    }
  } catch (err) {
    st.phase = err && err.code === 'permission-denied' ? 'rules' : 'error';
    st.fatal = (err && (err.code || err.message)) || '';
    render();
  } finally { st.creating = false; }
}
onAuthStateChanged(auth, u => {
  if (ownSub) { ownSub(); ownSub = null; }
  stopData(); st.me = null; closeSheet();
  if (!u) { st.phase = 'auth'; render(); return; }
  st.phase = 'boot'; render();
  ownSub = onSnapshot(ref('users', u.uid), snap => {
    if (!snap.exists()) { if (!snap.metadata.fromCache) ensureUserDoc(u); return; }
    st.me = Object.assign({id: u.uid}, snap.data());
    if (!st.me.active) { stopData(); st.phase = 'waiting'; render(); return; }
    if (st.phase !== 'app') {
      st.phase = 'app'; startData();
      // ask the browser not to clear this app's saved data (the sign-in and the offline copy) when space runs low
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (err) {}
    }
    render();
  }, err => {
    st.phase = err && err.code === 'permission-denied' ? 'rules' : 'error';
    st.fatal = (err && (err.code || err.message)) || '';
    render();
  });
});

/* ---------- actions ---------- */
function authWarn(msg, good){ const w = $('#a-warn'); if (w) w.innerHTML = `<div class="warnbox${good ? ' good' : ''}">${ic(good ? 'check' : 'alert')}<span>${msg}</span></div>`; }
async function doAuth(){
  const su = ui.authMode === 'signup';
  const email = $('#a-email').value.trim(), pass = $('#a-pass').value, name = su ? $('#a-name').value.trim() : '';
  if (su && !name) return authWarn('اكتب اسمك.');
  if (!email) return authWarn('اكتب الإيميل.');
  if (pass.length < 6) return authWarn('الباسورد لازم يكون 6 حروف أو أكثر.');
  const btn = $('#a-submit'); if (btn) btn.disabled = true;
  try {
    if (su) {
      st.signupName = name;
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, {displayName: name}).catch(() => {});
      if ((await sha256(email.toLowerCase())) === OWNER_HASH) await sendEmailVerification(cred.user).catch(() => {});
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
    rememberEmail(email);
  } catch (err) { authWarn(authMsg(err)); if ($('#a-submit')) $('#a-submit').disabled = false; }
}
const A = {
  'auth-mode'(d){ ui.authMode = d.v; render(); },
  async 'forgot'(){
    const email = $('#a-email').value.trim();
    if (!email) return authWarn('اكتب إيميلك فوق، وبعدها اضغط «نسيت الباسورد».');
    try { await sendPasswordResetEmail(auth, email); authWarn('دزينا رابط على إيميلك تغيّر بيه الباسورد.', true); } catch (err) { authWarn(authMsg(err)); }
  },
  async 'verify-done'(){
    const u = auth.currentUser; if (!u) return;
    try {
      await u.reload();
      if (!auth.currentUser.emailVerified) { const w = $('#v-warn'); if (w) w.innerHTML = `<div class="warnbox">${ic('alert')}<span>بعده الإيميل ما متأكد. افتح الرابط اللي بالإيميل أول.</span></div>`; return; }
      await auth.currentUser.getIdToken(true);
      st.phase = 'boot'; render();
      ensureUserDoc(auth.currentUser);
    } catch (err) { toastErr(err); }
  },
  'verify-resend'(){ const u = auth.currentUser; if (u) sendEmailVerification(u).then(() => toast('دزينا الرابط مرة ثانية'), err => toast(authMsg(err))); },
  'logout'(){ closeSheet(); ui.authMode = 'login'; ui.tab = 'customers'; ui.view = null; ui.q = ''; ui.filter = 'all'; signOut(auth); },
  'reload'(){ location.reload(); },
  'account'(){ openAccount(); },
  'install'(){ openInstall(); },
  'tab'(d){ if (ui.tab === d.tab && !ui.view) { window.scrollTo(0, 0); return; } go({tab: d.tab, view: null}); },
  'back'(){ go({view: null}); },
  'go'(d){ go({view: {type: d.v}}); },
  'filter'(d){ ui.filter = d.f; const c = $('#cust-chips'); if (c) c.innerHTML = chipsHTML(); $('#cust-list').innerHTML = custListHTML(); },
  'open-cust'(d){ go({view: {type: 'customer', id: d.id}}); },
  'add-cust'(d){ openCustomerForm(null, d.name); },
  'edit-cust'(d){ openCustomerForm(d.id); },
  'new-entry'(d){ openEntryForm({cid: ui.view.id, type: d.type}); },
  'open-entry'(d){ openEntryDetail(d.id); },
  'edit-entry'(d){ const e = ent(d.id); if (e) openEntryForm({cid: e.cid, edit: e}); },
  'resend'(d){ const e = ent(d.id); if (!e) return; const [t, m] = messageFor(e, bal(e.cid)); openMessage(t, e.cid, m); },
  'del-entry'(d){ openDelete(d.id); },
  'confirm-del'(d){ const e = ent(d.id); if (!e) return; const del = deleteEntry(e); closeSheet(); render(); toast('انحذفت، وبقت بالسجل', {act: 'undo', id: e.id, label: 'تراجع'}); st.lastDeleted = del; },
  'undo'(){ if (st.lastDeleted) { restoreEntry(st.lastDeleted); st.lastDeleted = null; } $('#toast-root').innerHTML = ''; },
  async 'restore'(d){
    let e = ent(d.id);
    if (!e) { try { const s = await getDoc(ref('entries', d.id)); if (s.exists()) { e = Object.assign({id: s.id}, s.data()); st.cache.set(e.id, e); } } catch (err) { toastErr(err); return; } }
    if (e && e.status === 'deleted') { restoreEntry(e); closeSheet(); toast('رجعت الحركة للحساب'); }
    else toast('هاي الحركة راجعة بالحساب أصلاً');
  },
  'approve'(d){
    const e = ent(d.id); if (!e || e.status !== 'pending') return;
    const before = bal(e.cid);
    const ne = approveEntry(e);
    render();
    const [t, m] = messageFor(ne, withEffect(before, ne)); openMessage(t, ne.cid, m);
  },
  'reject'(d){ openReject(d.id); },
  'reason'(d){ const t = $('#r-reason'); t.value = d.v; t.focus(); },
  'do-reject'(d){ const e = ent(d.id); if (!e) return; rejectEntry(e, $('#r-reason').value.trim()); closeSheet(); render(); toast('انرفضت، وما انحسبت على الزبون'); },
  'remind'(){ openMessage('تذكير بالدين', ui.view.id, msgRemind(ui.view.id)); },
  'send-statement'(){ openMessage('كشف الحساب', ui.view.id, msgStatement(ui.view.id)); },
  'copy'(d){ copyText(d.text, 'انتسخ'); },
  'copy-msg'(){ const el = $('#msg'); copyText(el.textContent, 'انتسخت الرسالة', el); },
  'close-sheet'(){ closeSheet(); },
  'rtab'(d){ ui.reportTab = d.v; render(); },
  'month'(d){ ui.monthOffset = Number(d.o); render(); },
  'export'(d, el){ exportExcel(el); },
  'import'(){ if (me().role === 'owner') openImport(); },
  'imp-go'(){ runImport(); },
  'reset'(){ if (me().role === 'owner') openReset(); },
  'rs-backup'(d, el){ resetBackup(el); },
  'phones'(){ if (me().role === 'owner') openPhones(); },
  'ph-go'(){ runPhones(); },
  'rs-go'(){ runReset(); },
  'f-type'(d){ const s = sheetState; s.type = d.v; if (d.v === 'pay') s.due = null; else if (!s.due) s.due = addDays($('#f-date').value || todayISO(), 30); $('#f-due').value = s.due || ''; s.err = ''; formSync(); },
  'f-cur'(d){ sheetState.cur = d.v; formatAmountInput($('#f-amount'), d.v); formSync(); },
  'f-due'(d){ const n = Number(d.d); sheetState.due = n ? addDays($('#f-date').value || todayISO(), n) : null; $('#f-due').value = sheetState.due || ''; formSync(); },
  'f-save'(){ saveEntryForm(); },
  'c-cur'(d){ sheetState.openCur = d.v; document.querySelectorAll('[data-act="c-cur"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === d.v))); formatAmountInput($('#c-open'), d.v); },
  'c-save'(){ saveCustomerForm(); },
  'activate'(d){
    const u = userById(d.id); if (!u) return;
    const code = st.shop.nextCode || 2, b = writeBatch(fs);
    b.update(ref('users', u.id), {active: true, role: 'staff', perms: Object.assign({}, PRESETS.staff), code});
    b.set(ref('meta', 'shop'), {nextCode: code + 1}, {merge: true});
    b.set(doc(col('log')), Object.assign(logOf('user_active', null), {name: u.name, active: true}));
    commit(b);
    st.usersById[u.id] = Object.assign({}, u, {active: true, role: 'staff', perms: Object.assign({}, PRESETS.staff), code});
    openUserSheet(u.id);
    toast(`انفعّل حساب ${u.name}. اختار صلاحياته`);
  },
  'edit-user'(d){ openUserSheet(d.id); },
  'u-perm'(d, el){
    const u = userById(d.id); if (!u || u.role === 'owner') return;
    const on = !(u.perms && u.perms[d.k]);
    el.setAttribute('aria-checked', String(on));
    userWrite(u, {[`perms.${d.k}`]: on}, {type: 'user_perm', perm: d.k, on});
    toast(on ? `صار ${u.name} عنده ${PERM_SHORT[d.k]}` : `انشالت ${PERM_SHORT[d.k]} من ${u.name}`);
  },
  'u-preset'(d){
    const u = userById(d.id); if (!u || u.role === 'owner') return;
    const perms = Object.assign({}, PRESETS[d.v]);
    document.querySelectorAll('[data-act="u-preset"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === d.v)));
    $('#u-perms').innerHTML = permRows(Object.assign({}, u, {perms}));
    userWrite(u, {role: d.v, perms}, {type: 'user_role', role: d.v});
    toast(`صار ${u.name} ${ROLES[d.v]} بصلاحياته الأساسية`);
  },
  'toggle-active'(d, el){
    const u = userById(d.id); if (!u || u.role === 'owner') return;
    const active = !u.active;
    el.setAttribute('aria-checked', String(active));
    userWrite(u, {active}, {type: 'user_active', active});
    toast(active ? `رجع حساب ${u.name} يشتغل` : `انوقف حساب ${u.name}`);
  },
  'rm-user'(d){ if (me().role === 'owner') openRemoveUser(d.id); },
  'bulk'(){ if (can.message(me()) && can.seeBalances(me())) openBulk(); },
  'bulk-restart'(){ const s = sheetState; if (!s || s.kind !== 'bulk') return; s.sent = new Set(); bulkSave(s.sent); renderBulk(); },
  'rm-user-go'(d){
    const u = userById(d.id); if (!u || u.role === 'owner' || me().role !== 'owner') return;
    userWrite(u, {removed: true, active: false, removedAt: Date.now(), removedBy: me().id}, {type: 'user_removed'});
    st.usersById[u.id] = Object.assign({}, u, {removed: true, active: false});
    st.users = st.users.map(x => x.id === u.id ? st.usersById[u.id] : x);
    closeSheet(); render();
    toast(`انشال حساب ${u.name}`);
  },
  'unrm-user'(d){
    const u = userById(d.id); if (!u || u.role === 'owner' || me().role !== 'owner') return;
    userWrite(u, {removed: false}, {type: 'user_restored'});
    toast(u.code ? `رجع حساب ${u.name}. شغّله من صفحته حتى يكدر يدخل` : `رجع حساب ${u.name} لقائمة اللي ينتظرون التفعيل`);
  }
};

document.addEventListener('click', ev => {
  const scrim = ev.target.closest('[data-scrim]');
  if (scrim && ev.target === scrim) { closeSheet(); return; }
  const bulk = ev.target.closest('a[data-bulk]');
  if (bulk) { bulkSent(bulk.dataset.bulk); return; }
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'A') return;
  const fn = A[el.dataset.act]; if (!fn) return;
  ev.preventDefault();
  fn(el.dataset, el);
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.id === 'q') { ui.q = t.value; $('#cust-list').innerHTML = custListHTML(); return; }
  if (t.id === 'f-amount') { formatAmountInput(t, sheetState.cur); sheetState.err = ''; formSync(); return; }
  if (t.dataset && t.dataset.money) { formatAmountInput(t, t.dataset.money); return; }
  if (t.id === 'c-open') { formatAmountInput(t, sheetState.openCur); return; }
  if (t.id === 'rs-word') { if (sheetState) { sheetState.word = t.value; sheetState.err = ''; } return; }
  if (t.classList && t.classList.contains('bulk-phone')) { bulkTyped(t); return; }
  if (t.id && t.closest('#app')) t.dataset.dirty = '1';
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'imp-file') { const f = t.files && t.files[0]; t.value = ''; readImportFile(f); return; }
  if (t.id === 'ph-file') { const f = t.files && t.files[0]; t.value = ''; readPhonesFile(f); return; }
  if (t.id === 'f-due') { sheetState.due = t.value || null; formSync(); return; }
  if (t.id === 'f-date') formSync();
});
document.addEventListener('submit', ev => {
  ev.preventDefault();
  const id = ev.target.id;
  if (id === 'auth-form') doAuth();
  else if (id === 'entry-form') saveEntryForm();
  else if (id === 'cust-form') saveCustomerForm();
  else if (id === 'reject-form') A['do-reject']({id: sheetState.id});
  else if (id === 'settings-form') {
    const name = $('#s-name').value.trim() || SHOP_DEFAULT.name, phone = $('#s-phone').value.trim();
    const b = writeBatch(fs);
    b.set(ref('meta', 'shop'), {name, phone}, {merge: true});
    b.set(doc(col('log')), logOf('settings', null));
    commit(b);
    document.querySelectorAll('#app [data-dirty]').forEach(el => { delete el.dataset.dirty; });
    toast('انحفظت الإعدادات');
  }
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('#sheet-root').innerHTML) closeSheet(); });
window.addEventListener('online', () => { st.online = true; renderNet(); });
window.addEventListener('offline', () => { st.online = false; renderNet(); });

/* ---------- offline shell ---------- */
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && st.phase === 'app') toast('نزل تحديث جديد للتطبيق', {act: 'reload', label: 'حدّث'}); });
}
