/* ========= CONFIG ========= */
// Rayan's backend. Leave '' to use the built-in simulated server (works on its own).
// Later: const API = 'https://xxxx.ngrok.io';  (backend must accept POST /api/assessments)
const API = '';

/* ========= RUBRIC (hardcoded QP, like the PDF plan) ========= */
const QP = {
  code: 'ELE/Q6001', name: 'Domestic Electrician', level: 4,
  tasks: [
    { id: 'T1', text: 'Mounts single-pole MCB on DIN rail and terminates leads', kw: ['mcb', 'din rail', 'distribution board', 'db box'] },
    { id: 'T2', text: 'Strips and joins wire correctly without damaging strands', kw: ['wire', 'wiring', 'taar', 'cable', 'strip', 'pliers'] },
    { id: 'T3', text: 'Tests circuit with a multimeter before and after work', kw: ['multimeter', 'tester', 'voltage', 'continuity'] },
    { id: 'T4', text: 'Carries out earthing and safety checks', kw: ['earthing', 'earth', 'safety', 'insulation'] },
    { id: 'T5', text: 'Installs or repairs fans, switches and sockets', kw: ['fan', 'ceiling fan', 'switch', 'socket', 'pankha', 'light'] },
  ],
};
const allKw = QP.tasks.flatMap(t => t.kw);

/* ========= LANGUAGE ========= */
const I = {
  en: { nav_worker: 'Worker', nav_assessor: 'Assessor', nav_admin: 'Admin', h1: 'Your skills deserve a certificate', lead: 'Tell us about your work. We match it to a national qualification. An assessor then confirms it.', worker: 'I am a worker', assessor: 'I am an assessor', admin: 'Admin dashboard', declare: 'Describe your daily work and the tools you use', find: 'Find my qualification', speak: 'Speak', save: 'Sign off and save' },
  hi: { nav_worker: 'कामगार', nav_assessor: 'आकलनकर्ता', nav_admin: 'एडमिन', h1: 'आपके हुनर को प्रमाणपत्र मिलना चाहिए', lead: 'अपने काम के बारे में बताइए। हम उसे राष्ट्रीय योग्यता से मिलाएँगे। फिर आकलनकर्ता पुष्टि करेगा।', worker: 'मैं कामगार हूँ', assessor: 'मैं आकलनकर्ता हूँ', admin: 'एडमिन डैशबोर्ड', declare: 'अपना रोज़ का काम और औज़ार बताइए', find: 'मेरी योग्यता खोजें', speak: 'बोलें', save: 'हस्ताक्षर करें और सहेजें' },
  kn: { nav_worker: 'ಕೆಲಸಗಾರ', nav_assessor: 'ಮೌಲ್ಯಮಾಪಕ', nav_admin: 'ಅಡ್ಮಿನ್', h1: 'ನಿಮ್ಮ ಕೌಶಲ್ಯಕ್ಕೆ ಪ್ರಮಾಣಪತ್ರ ಸಿಗಲಿ', lead: 'ನಿಮ್ಮ ಕೆಲಸದ ಬಗ್ಗೆ ಹೇಳಿ. ನಾವು ಅದನ್ನು ರಾಷ್ಟ್ರೀಯ ಅರ್ಹತೆಗೆ ಹೊಂದಿಸುತ್ತೇವೆ. ನಂತರ ಮೌಲ್ಯಮಾಪಕರು ದೃಢಪಡಿಸುತ್ತಾರೆ.', worker: 'ನಾನು ಕೆಲಸಗಾರ', assessor: 'ನಾನು ಮೌಲ್ಯಮಾಪಕ', admin: 'ಅಡ್ಮಿನ್ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', declare: 'ನಿಮ್ಮ ದೈನಂದಿನ ಕೆಲಸ ಮತ್ತು ಸಾಧನಗಳನ್ನು ವಿವರಿಸಿ', find: 'ನನ್ನ ಅರ್ಹತೆ ಹುಡುಕಿ', speak: 'ಮಾತನಾಡಿ', save: 'ಸಹಿ ಮಾಡಿ ಉಳಿಸಿ' },
};
let lang = localStorage.getItem('lang') || 'en';
const t = k => (I[lang] && I[lang][k]) || I.en[k] || k;

/* ========= OFFLINE DATABASE (IndexedDB) ========= */
const DB = new Promise((res, rej) => {
  const r = indexedDB.open('rplDB', 2);
  r.onupgradeneeded = () => { ['assessments', 'server', 'workers', 'sworkers'].forEach(n => { if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: 'id' }); }); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async (store, mode, fn) => {
  const d = await DB;
  return new Promise((res, rej) => {
    const T = d.transaction(store, mode); const q = fn(T.objectStore(store));
    T.oncomplete = () => res(q && q.result); T.onerror = () => rej(T.error);
  });
};
const put = (s, v) => tx(s, 'readwrite', o => o.put(v));
const all = s => tx(s, 'readonly', o => o.getAll());

/* ========= SYNC ========= */
let syncing = false;
async function syncPending() {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  const jobs = [['workers', 'sworkers', '/api/workers'], ['assessments', 'server', '/api/assessments']];
  try {
    for (const [local, remote, path] of jobs) {
      const pending = (await all(local)).filter(r => !r.synced);
      for (const rec of pending) {
        if (API) {
          const res = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) });
          if (!res.ok) throw 0;
        } else {
          await new Promise(r => setTimeout(r, 700)); // simulated network
          if (!navigator.onLine) throw 0;
          await put(remote, { ...rec, synced: true }); // same id = no duplicates
        }
        await put(local, { ...rec, synced: true });
      }
    }
  } catch (e) { /* still offline: retry later */ }
  syncing = false;
  await renderStatus();
  if (location.hash.startsWith('#/admin')) route();
}

/* ========= STATUS BAR ========= */
async function renderStatus() {
  const pend = [...await all('assessments'), ...await all('workers')].filter(r => !r.synced).length;
  const on = navigator.onLine;
  document.getElementById('status').innerHTML =
    `<span class="pill ${on ? 'on' : 'off'}">${on ? '● Online' : '● Offline - working locally'}</span>` +
    (pend ? `<span class="pill pend">Saved Offline: Pending Sync (${pend})</span>` : `<span class="pill done">All data synced</span>`) +
    `<span class="small">AI assists. Final certification is by the human assessor.</span>`;
}
addEventListener('online', () => { toast('Back online - syncing...'); syncPending(); });
addEventListener('offline', () => { toast('You are offline. Data will be saved on this device.'); renderStatus(); });

/* ========= HELPERS ========= */
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(m) { const e = $('#toast'); e.textContent = m; e.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 3200); }
const verdict = p => p >= 75 ? { c: 'ok', t: 'Recommend: Certify (NSQF Level 4)' }
  : p >= 60 ? { c: 'warn', t: 'Conditional Clearance: 1-day refresher module (PMKVY)' }
  : { c: 'bad', t: 'Not yet competent: bridge training advised' };

/* ========= PAGES ========= */
function landing() {
  app.innerHTML = `
    <h1>${t('h1')}</h1><p class="lead">${t('lead')}</p>
    <div class="roles">
      <a class="role" href="#/worker"><div class="ic">🛠️</div><b>${t('worker')}</b><span>Speak or type. No forms.</span></a>
      <a class="role" href="#/assess"><div class="ic">📋</div><b>${t('assessor')}</b><span>5-task rubric. Works offline.</span></a>
      <a class="role" href="#/admin"><div class="ic">📊</div><b>${t('admin')}</b><span>Results, consistency, flags.</span></a>
    </div>
    <div class="notice"><b>Where AI stops:</b> AI suggests a match and a score. Only the human assessor signs off the certificate.</div>`;
}

/* ---- Worker registration + self-declaration (4 steps) ---- */
const STEPS = ['Personal', 'Experience', 'Skills', 'Review'];
const PLAIN = ['🔌 I fix MCB and distribution boards', '🪛 I join and fit wires and cables', '📟 I test circuits with a multimeter', '⚠️ I do earthing and safety checks', '🌀 I fit or repair fans, switches, sockets'];
const TOOLS = ['Multimeter', 'Pliers', 'Screwdriver', 'Tester', 'Wire stripper', 'Drill machine', 'Ladder', 'Insulation tape'];
const blankWF = () => ({ step: 0, done: null, d: { gender: '', exp: '', emp: '', learned: '', tasks: [], tools: [], consent: false } });
let wf = blankWF();

const OPT = (name, arr, val) => `<div class="opts" data-o="${name}">${arr.map(a => `<button type="button" class="chip ${val === a ? 'sel' : ''}" data-v="${a}">${a}</button>`).join('')}</div>`;
const FIELD = (f, label, ph = '', extra = '') => `<label>${label}</label><input type="text" data-f="${f}" value="${esc(wf.d[f] || '')}" placeholder="${ph}" ${extra}>`;

function calcMatch(text, tasksDeclared) {
  const rows = QP.tasks.map((tk, i) => ({ tk, declared: tasksDeclared.includes(i), hits: tk.kw.filter(k => text.includes(k)) }));
  const found = rows.filter(r => r.declared || r.hits.length).length;
  const nHits = rows.reduce((a, r) => a + r.hits.length, 0);
  const conf = found ? Math.min(96, 30 + found * 10 + nHits * 4) : 0;
  return { rows, found, conf };
}
function matchHTML(m) {
  return `<h2>${QP.name} (${QP.code}), NSQF Level ${QP.level}</h2>
    <div class="meter"><i style="width:${m.conf}%"></i></div>
    <p><b>${m.conf}% confidence.</b> ${m.found} of 5 job tasks found in what you declared.</p>
    <h3>Why we matched this</h3>
    ${m.rows.map(r => `<div style="margin:8px 0"><b>${r.declared || r.hits.length ? '✅' : '⬜'} ${esc(r.tk.text)}</b>${r.declared ? ' <span class="small">(you ticked this)</span>' : ''}<br>${r.tk.kw.map(k => `<span class="kw ${r.hits.includes(k) ? 'y' : 'n'}">${k}</span>`).join('')}</div>`).join('')}`;
}

function worker() {
  if (wf.done) return workerDone();
  const d = wf.d, st = wf.step;
  const body = [
    FIELD('name', 'Full name', 'e.g. Ravi Kumar') + FIELD('mobile', 'Mobile number (WhatsApp)', '10 digits', 'inputmode="numeric" maxlength="10"') +
    FIELD('age', 'Age', 'e.g. 32', 'inputmode="numeric" maxlength="2"') + `<label>Gender</label>${OPT('gender', ['Male', 'Female', 'Other'], d.gender)}` +
    FIELD('state', 'State', 'e.g. Karnataka') + FIELD('district', 'District / village', 'e.g. Tumakuru'),

    `<label>Trade</label><input type="text" value="${QP.name} (${QP.code})" disabled>
     <label>Years of experience</label>${OPT('exp', ['Under 1', '1 to 3', '3 to 5', '5 to 10', '10+'], d.exp)}
     <label>How do you work?</label>${OPT('emp', ['Self-employed', 'With a contractor', 'In a company', 'Helper / apprentice'], d.emp)}
     <label>How did you learn this work?</label>${OPT('learned', ['On the job', 'From family', 'Left ITI / course', 'Other'], d.learned)}
     <label>Highest education</label>
     <select data-f="edu" style="width:100%;padding:12px;border:2px solid var(--line);border-radius:10px;font:inherit">
       ${['Not studied', 'Up to class 8', 'Class 10', 'Class 12', 'Diploma / ITI', 'Graduate'].map(o => `<option ${d.edu === o ? 'selected' : ''}>${o}</option>`).join('')}</select>`,

    `<label>Which of these jobs have you done? (tap all that apply)</label>
     <div class="checks">${PLAIN.map((p, i) => `<label class="check"><input type="checkbox" data-task="${i}" ${d.tasks.includes(i) ? 'checked' : ''}> ${p}</label>`).join('')}</div>
     <label>Tools you use</label>
     <div class="opts" data-m="tools">${TOOLS.map(x => `<button type="button" class="chip ${d.tools.includes(x) ? 'sel' : ''}" data-v="${x}">${x}</button>`).join('')}</div>
     <label>${t('declare')}</label>
     <textarea data-f="desc" placeholder="e.g. I have 5 years experience fixing wires and ceiling fans">${esc(d.desc || '')}</textarea>
     <div class="row" style="margin-top:8px"><button type="button" class="btn alt" id="mic">🎤 ${t('speak')}</button><span class="small">Hindi / Kannada: change the language at the top first.</span></div>`,

    `<div class="card" style="margin:0"><b>Check your details</b>
      <p>${esc(d.name || '')}, ${esc(d.age || '')} yrs, ${esc(d.gender || '')}<br>${esc(d.mobile || '')} | ${esc(d.district || '')}, ${esc(d.state || '')}<br>
      ${esc(d.exp || '')} yrs | ${esc(d.emp || '')} | ${esc(d.learned || '')}<br>
      Jobs ticked: ${d.tasks.length}/5 | Tools: ${esc(d.tools.join(', ') || 'none')}</p></div>
     <label class="check"><input type="checkbox" id="consent" ${d.consent ? 'checked' : ''}> I agree that my details and photos can be used for my skill assessment. I understand the assessor makes the final decision.</label>`,
  ][st];

  app.innerHTML = `<h1>Worker registration</h1>
    <div class="steps">${STEPS.map((x, i) => `<span class="${i === st ? 'cur' : i < st ? 'ok' : ''}">${i + 1}. ${x}</span>`).join('')}</div>
    <div class="card">${body}
      <div class="row" style="margin-top:16px">
        ${st ? '<button class="btn alt" id="back">Back</button>' : ''}
        <button class="btn ${st === 3 ? 'go' : ''}" id="next">${st === 3 ? 'Submit and find my qualification' : 'Next'}</button>
      </div></div>`;

  const grab = () => {
    document.querySelectorAll('[data-f]').forEach(e => d[e.dataset.f] = e.value.trim());
    if (st === 2) d.tasks = [...document.querySelectorAll('[data-task]:checked')].map(e => +e.dataset.task);
    if (st === 3) d.consent = $('#consent').checked;
  };
  document.querySelectorAll('[data-o]').forEach(g => g.onclick = e => { if (e.target.dataset.v) { grab(); d[g.dataset.o] = e.target.dataset.v; worker(); } });
  document.querySelectorAll('[data-m]').forEach(g => g.onclick = e => {
    const v = e.target.dataset.v; if (!v) return; grab();
    d.tools = d.tools.includes(v) ? d.tools.filter(x => x !== v) : [...d.tools, v]; worker();
  });
  if ($('#mic')) $('#mic').onclick = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast('Voice not supported in this browser. Use Chrome, or type.');
    const r = new SR(); r.lang = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' }[lang];
    r.onresult = e => { document.querySelector('[data-f=desc]').value += ' ' + e.results[0][0].transcript; };
    r.onerror = () => toast('Could not hear you. Try again or type.');
    r.start(); toast('Listening...');
  };
  if ($('#back')) $('#back').onclick = () => { grab(); wf.step--; worker(); };
  $('#next').onclick = async () => {
    grab();
    const err = [
      !d.name ? 'Enter your full name.' : !/^\d{10}$/.test(d.mobile || '') ? 'Mobile number must be 10 digits.' : !(+d.age >= 18 && +d.age <= 70) ? 'Age must be between 18 and 70.' : !d.gender ? 'Select gender.' : !d.state || !d.district ? 'Enter state and district.' : '',
      !d.exp ? 'Select years of experience.' : !d.emp ? 'Select how you work.' : !d.learned ? 'Select how you learned.' : '',
      !d.tasks.length && !(d.desc || '').trim() ? 'Tick at least one job or describe your work.' : '',
      !d.consent ? 'Please tick the consent box to continue.' : '',
    ][st];
    if (err) return toast(err);
    if (st < 3) { wf.step++; worker(); scrollTo(0, 0); return; }
    const text = ((d.desc || '') + ' ' + d.tools.join(' ')).toLowerCase();
    const m = calcMatch(text, d.tasks);
    const rec = { id: crypto.randomUUID(), ...d, qp: QP.code, matchConfidence: m.conf, createdAt: new Date().toISOString(), synced: false };
    await put('workers', rec);
    draft.cand = d.name; wf.done = { rec, m };
    toast(navigator.onLine ? 'Registered. Syncing...' : 'Saved Offline: Pending Sync');
    await renderStatus(); syncPending(); worker();
  };
}

function workerDone() {
  const { rec, m } = wf.done;
  app.innerHTML = `<h1>Thank you, ${esc(rec.name)}</h1>
    <div class="card"><p>Your worker ID: <b>${rec.id.slice(0, 8).toUpperCase()}</b></p>${matchHTML(m)}
      <div class="notice">This is a suggestion, not a certificate. An assessor will check your skills in person and make the final decision.</div>
      <div class="row"><a class="btn" href="#/assess">Start assessor checklist for ${esc(rec.name)}</a>
      <button class="btn alt" id="again">Register another worker</button></div></div>`;
  $('#again').onclick = () => { wf = blankWF(); worker(); };
}

let draft = { scores: {}, photo: null };
function assess() {
  const total = Object.values(draft.scores).reduce((a, b) => a + b, 0);
  const done = Object.keys(draft.scores).length;
  const pct = Math.round(total / 25 * 100);
  const v = verdict(pct);
  app.innerHTML = `
    <h1>Practical assessment</h1>
    <div class="notice"><b>AI assists. Final certification is by the human assessor.</b> Score each task 1 to 5 using the same rubric: 1 = cannot do, 3 = does with help, 5 = does safely and correctly alone.</div>
    <div class="card">
      <label for="cand">Candidate name</label><input type="text" id="cand" value="${esc(draft.cand || '')}" placeholder="e.g. Ravi Kumar">
      ${QP.tasks.map(tk => `<div class="task"><b>${tk.id}. ${esc(tk.text)}</b>
        <div class="scale" data-t="${tk.id}">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}" class="${draft.scores[tk.id] === n ? 'sel' : ''}">${n}</button>`).join('')}</div></div>`).join('')}
    </div>
    <div class="card"><b>Photo evidence</b>
      <p class="small">Photo is stamped with time and GPS, and given a tamper-check code (SHA-256).</p>
      <input type="file" id="photo" accept="image/*" capture="environment">
      ${draft.photo ? `<img class="photo" src="${draft.photo.url}" alt="Evidence"><p class="small">GPS: ${draft.photo.gps} | Hash: ${draft.photo.hash}</p>` : ''}
    </div>
    <div class="card">
      <div class="meter"><i style="width:${pct}%"></i></div>
      <p><b>${pct}%</b> (${done}/5 tasks scored)</p>
      ${done === 5 ? `<div class="result ${v.c}">${v.t}</div>` : `<p class="small">Score all 5 tasks to see the recommendation.</p>`}
      <label for="asr">Assessor name (sign-off)</label><input type="text" id="asr" value="${esc(draft.asr || '')}" placeholder="Your name">
      <p><button class="btn go" id="save" ${done === 5 ? '' : 'disabled'}>${t('save')}</button></p>
    </div>`;
  document.querySelectorAll('.scale').forEach(s => s.onclick = e => {
    if (!e.target.dataset.n) return;
    draft.cand = $('#cand').value; draft.asr = $('#asr').value;
    draft.scores[s.dataset.t] = +e.target.dataset.n; assess();
  });
  $('#photo').onchange = async e => {
    draft.cand = $('#cand').value; draft.asr = $('#asr').value;
    if (e.target.files[0]) { draft.photo = await stamp(e.target.files[0]); assess(); }
  };
  $('#save').onclick = async () => {
    const cand = $('#cand').value.trim(), asr = $('#asr').value.trim();
    if (!cand || !asr) return toast('Enter candidate and assessor names.');
    const scores = QP.tasks.map(tk => draft.scores[tk.id]);
    const rec = { id: crypto.randomUUID(), candidate: cand, assessor: asr, qp: QP.code, level: QP.level, scores, percent: pct, verdict: v.t, photo: draft.photo, signedAt: new Date().toISOString(), synced: false };
    await put('assessments', rec);
    draft = { scores: {}, photo: null };
    toast(navigator.onLine ? 'Saved. Syncing...' : 'Saved Offline: Pending Sync');
    await renderStatus(); syncPending(); location.hash = '#/admin';
  };
}

async function stamp(file) {
  const img = await createImageBitmap(file), c = document.createElement('canvas'), s = Math.min(1, 800 / img.width);
  c.width = img.width * s; c.height = img.height * s;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
  let gps = 'GPS n/a';
  try { const p = await new Promise((a, b) => navigator.geolocation.getCurrentPosition(a, b, { timeout: 4000 })); gps = p.coords.latitude.toFixed(4) + ',' + p.coords.longitude.toFixed(4); } catch (e) {}
  x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(0, c.height - 26, c.width, 26);
  x.fillStyle = '#fff'; x.font = '14px sans-serif'; x.fillText(new Date().toISOString() + ' | ' + gps, 8, c.height - 8);
  const url = c.toDataURL('image/jpeg', 0.7); let hash = 'n/a';
  try { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url)); hash = [...new Uint8Array(h)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) {}
  return { url, gps, hash };
}

/* ========= ADMIN ========= */
async function seedDemo() {
  const people = [['Ravi', [4, 4, 3, 4, 5]], ['Sita', [3, 2, 3, 3, 4]], ['Imran', [5, 4, 4, 5, 4]]];
  const bias = { 'Assessor A': 0, 'Assessor B': 0, 'Assessor C': 1 }; // C scores too generously
  for (const [name, base] of people) for (const a in bias) {
    const scores = base.map(s => Math.max(1, Math.min(5, s + bias[a] + (a === 'Assessor B' && s > 3 ? -0 : 0))));
    const percent = Math.round(scores.reduce((x, y) => x + y) / 25 * 100);
    await put('server', { id: crypto.randomUUID(), candidate: name, assessor: a, scores, percent, verdict: verdict(percent).t, signedAt: new Date().toISOString(), synced: true, demo: true });
  }
  toast('Demo data added'); route();
}
function consistency(recs) {
  const by = {}; recs.forEach(r => (by[r.candidate] ||= []).push(r));
  let dev = 0, n = 0; const ab = {};
  Object.values(by).filter(g => g.length > 1).forEach(g => {
    for (let i = 0; i < 5; i++) {
      const m = g.reduce((a, r) => a + r.scores[i], 0) / g.length;
      g.forEach(r => { dev += Math.abs(r.scores[i] - m); n++; (ab[r.assessor] ||= []).push(r.scores[i] - m); });
    }
  });
  return { agree: n ? Math.round(100 - dev / n / 4 * 100) : null, ab: Object.entries(ab).map(([a, d]) => [a, d.reduce((x, y) => x + y) / d.length]) };
}
async function admin() {
  const sw = await all('sworkers'), srv = await all('server'), local = (await all('assessments')).filter(r => !r.synced);
  const c = consistency(srv);
  app.innerHTML = `
    <h1>Admin dashboard</h1>
    <div class="stats">
      <div class="stat"><b>${sw.length}</b>Registered workers</div><div class="stat"><b>${srv.length}</b>Synced assessments</div>
      <div class="stat"><b>${local.length}</b>Waiting on devices</div>
      <div class="stat"><b>${c.agree === null ? '-' : c.agree + '%'}</b>Inter-assessor agreement</div>
    </div>
    <div class="row noprint" style="margin:14px 0">
      <button class="btn alt" id="seed">Add demo data (3 assessors)</button>
      <button class="btn alt" id="sync">Sync now</button>
    </div>
    <h2>Assessor consistency</h2>
    <div class="card">${c.ab.length ? c.ab.map(([a, d]) => `<p><b>${a}</b>: ${d > 0 ? '+' : ''}${d.toFixed(2)} vs peers ${Math.abs(d) > 0.6 ? '🚩 <b>Flagged for audit</b>' : '✅ in range'}
        <span class="bar" style="display:block;width:${Math.min(100, 50 + d * 40)}%;background:${Math.abs(d) > 0.6 ? 'var(--bad)' : 'var(--ok)'}"></span></p>`).join('') : `<span class="small">Needs 2+ assessors scoring the same candidate. Use the demo data button.</span>`}</div>
    <h2>Results</h2>
    <div class="tbl"><table><tr><th>Candidate</th><th>Assessor</th><th>Score</th><th>Recommendation</th><th></th></tr>
    ${srv.length ? srv.map(r => `<tr><td>${esc(r.candidate)}</td><td>${esc(r.assessor)}</td><td>${r.percent}%</td><td>${esc(r.verdict)}</td><td>${r.percent >= 60 && !r.demo ? `<a href="#/cert/${r.id}">Certificate</a>` : ''}</td></tr>`).join('') : '<tr><td colspan="5" class="small">No synced results yet.</td></tr>'}
    </table></div>`;
  $('#seed').onclick = seedDemo; $('#sync').onclick = () => { syncPending(); toast('Syncing...'); };
}

async function cert(id) {
  const r = (await all('server')).find(x => x.id === id) || (await all('assessments')).find(x => x.id === id);
  if (!r) { app.innerHTML = '<p>Certificate not found.</p>'; return; }
  const full = r.percent >= 75;
  app.innerHTML = `
    <div class="cert"><p class="small">Recognition of Prior Learning | NSQF aligned</p>
      <h1>Skill Certificate</h1><p>This is to recognise that</p>
      <div class="big">${esc(r.candidate)}</div>
      <p>has demonstrated practical competence as</p>
      <b style="font-size:1.3rem">${QP.name} (${QP.code}), NSQF Level ${QP.level}</b>
      <p>Practical score: <b>${r.percent}%</b>. ${full ? 'Status: Certified.' : 'Status: Conditional clearance, 1-day refresher pending.'}</p>
      <p class="small">Signed off by assessor: ${esc(r.assessor)} on ${new Date(r.signedAt).toLocaleDateString()}<br>Verification code: ${r.id.slice(0, 8).toUpperCase()}</p></div>
    <p class="noprint"><button class="btn" onclick="print()">Download PDF (choose Save as PDF)</button></p>`;
}

/* ========= ROUTER ========= */
function route() {
  const h = location.hash || '#/';
  document.querySelectorAll('.top nav a').forEach(a => a.classList.toggle('on', h.startsWith(a.getAttribute('href'))));
  document.querySelectorAll('[data-i]').forEach(e => e.textContent = t(e.dataset.i));
  if (h.startsWith('#/worker')) worker();
  else if (h.startsWith('#/assess')) assess();
  else if (h.startsWith('#/admin')) admin();
  else if (h.startsWith('#/cert/')) cert(h.split('/')[2]);
  else landing();
  scrollTo(0, 0);
}
$('#lang').value = lang;
$('#lang').onchange = e => { lang = e.target.value; localStorage.setItem('lang', lang); route(); };
addEventListener('hashchange', route);
route(); renderStatus(); syncPending();
