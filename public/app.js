const S = { token: localStorage.getItem('cslackers_token'), user: null, channels: [], activeChannel: null, ws: null, reconnects: 0 };
const $ = id => document.getElementById(id);
function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

// API
async function api(path, opts = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (S.token) h['Authorization'] = `Bearer ${S.token}`;
  const res = await fetch(`/api${path}`, { ...opts, headers: { ...h, ...opts.headers } });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// WebSocket
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  S.ws = new WebSocket(`${proto}//${location.host}?token=${S.token}`);
  S.ws.onopen = () => { S.reconnects = 0; setStatus(true); };
  S.ws.onclose = () => { setStatus(false); if (S.reconnects < 5) setTimeout(() => { S.reconnects++; connectWS(); }, 3000 * S.reconnects); };
  S.ws.onmessage = e => { const d = JSON.parse(e.data); if (d.type === 'message' && d.payload?.channel_id === S.activeChannel?.id) appendMsg(d.payload); };
}
function setStatus(on) { const d = $('status-dot'), t = $('status-text'); if (d) d.className = `status-dot ${on ? 'connected' : 'disconnected'}`; if (t) t.textContent = on ? 'Connected' : 'Reconnecting...'; }

// Channels
async function loadChannels() { const d = await api('/channels'); S.channels = d.data || []; renderChannels(); if (S.channels.length && !S.activeChannel) selectChannel(S.channels[0]); }
async function createChannel() { const name = prompt('Channel name:'); if (!name) return; const d = await api('/channels', { method: 'POST', body: JSON.stringify({ name }) }); S.channels.push(d.data); renderChannels(); selectChannel(d.data); }
function renderChannels() {
  const list = $('channel-list');
  list.innerHTML = S.channels.map(ch => `<div class="channel-item ${S.activeChannel?.id === ch.id ? 'active' : ''}" data-id="${esc(ch.id)}"><span class="channel-hash">#</span><span class="channel-name-text">${esc(ch.name)}</span><button class="channel-delete" data-id="${esc(ch.id)}" title="Delete channel">&times;</button></div>`).join('');
  list.querySelectorAll('.channel-item').forEach(el => el.onclick = e => { if (!e.target.classList.contains('channel-delete')) selectChannel(S.channels.find(c => c.id === el.dataset.id)); });
  list.querySelectorAll('.channel-delete').forEach(btn => btn.onclick = e => { e.stopPropagation(); deleteChannel(btn.dataset.id); });
}
async function deleteChannel(id) {
  const ch = S.channels.find(c => c.id === id);
  if (!ch) return;
  if (!confirm(`Delete channel #${ch.name}?`)) return;
  await api(`/channels/${id}`, { method: 'DELETE' });
  S.channels = S.channels.filter(c => c.id !== id);
  if (S.activeChannel?.id === id) { S.activeChannel = S.channels[0] || null; if (S.activeChannel) selectChannel(S.activeChannel); else $('message-list').innerHTML = ''; }
  renderChannels();
}
async function selectChannel(ch) {
  S.activeChannel = ch; $('channel-name').textContent = ch.name; $('mobile-channel-name').textContent = `# ${ch.name}`;
  $('message-list').innerHTML = ''; $('sidebar').classList.remove('open'); renderChannels();
  const d = await api(`/channels/${ch.id}/messages`); (d.data?.items || []).forEach(m => appendMsg(m));
  $('message-list').scrollTop = $('message-list').scrollHeight;
}

// Messages (XSS-safe rendering)
function appendMsg(msg) {
  const isHuman = msg.user_type === 'human', avatar = isHuman ? '👤' : '🤖';
  const time = new Date(msg.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isQ = msg.type === 'question', isImg = msg.type === 'image';
  const div = document.createElement('div');
  div.className = `message ${isHuman ? 'human' : 'agent'}`;
  const textDiv = document.createElement('div'); textDiv.className = 'message-text';
  if (isImg) { const img = document.createElement('img'); img.src = msg.content; img.className = 'message-image'; img.loading = 'lazy'; textDiv.appendChild(img); }
  else { textDiv.textContent = msg.content || ''; }
  div.innerHTML = `<div class="message-avatar">${avatar}</div><div class="message-content"><div class="message-header"><span class="message-sender">${esc(msg.user_name || 'unknown')}</span><span class="message-time">${esc(time)}</span></div></div>`;
  div.querySelector('.message-content').appendChild(textDiv);
  if (isQ) {
    const badge = document.createElement('div'); badge.className = 'question-badge'; badge.textContent = '❓ Waiting for answer';
    badge.dataset.qid = msg.question_id || ''; textDiv.appendChild(badge);
    badge.onclick = () => { const a = prompt('Your answer:'); if (a) api(`/questions/${msg.question_id}/answer`, { method: 'POST', body: JSON.stringify({ content: a }) }); };
  }
  $('message-list').appendChild(div);
  $('message-list').scrollTop = $('message-list').scrollHeight;
}

async function sendMessage() { const i = $('message-input'), c = i.value.trim(); if (!c || !S.activeChannel) return; i.value = ''; await api(`/channels/${S.activeChannel.id}/messages`, { method: 'POST', body: JSON.stringify({ content: c }) }); }
async function uploadImage(file) { if (!S.activeChannel) return; const fd = new FormData(); fd.append('image', file); await fetch(`/api/channels/${S.activeChannel.id}/images`, { method: 'POST', headers: { Authorization: `Bearer ${S.token}` }, body: fd }); }

// Search (XSS-safe)
async function doSearch(query) {
  if (!query.trim()) return; const d = await api(`/search?q=${encodeURIComponent(query)}`); const results = d.data || [];
  $('search-results-list').innerHTML = '';
  results.forEach(m => { const div = document.createElement('div'); div.className = 'search-result'; div.dataset.ch = m.channel_id;
    const strong = document.createElement('strong'); strong.textContent = m.user_name || '';
    const p = document.createElement('p'); p.textContent = (m.content || '').substring(0, 100);
    div.appendChild(strong); div.appendChild(p); div.onclick = () => { selectChannel(S.channels.find(c => c.id === m.channel_id)); $('search-overlay').classList.add('hidden'); };
    $('search-results-list').appendChild(div);
  });
}

// Register
async function register(name) { const d = await api('/register', { method: 'POST', body: JSON.stringify({ name, type: 'human' }) }); S.token = d.data.token; S.user = d.data.user; localStorage.setItem('cslackers_token', S.token); $('register-screen').classList.add('hidden'); $('main-app').classList.remove('hidden'); connectWS(); loadChannels(); }

// Events
$('register-form').onsubmit = e => { e.preventDefault(); register($('username-input').value.trim()); };
$('send-btn').onclick = sendMessage;
$('message-input').onkeypress = e => { if (e.key === 'Enter') sendMessage(); };
$('menu-toggle').onclick = () => $('sidebar').classList.toggle('open');
$('close-sidebar').onclick = () => $('sidebar').classList.remove('open');
$('create-channel-btn').onclick = createChannel;
$('search-toggle').onclick = () => { $('search-overlay').classList.remove('hidden'); $('overlay-search-input').focus(); };
$('close-search').onclick = () => $('search-overlay').classList.add('hidden');
$('overlay-search-input').oninput = e => doSearch(e.target.value);
$('image-upload-btn').onclick = () => $('image-input').click();
$('image-input').onchange = e => { if (e.target.files[0]) uploadImage(e.target.files[0]); e.target.value = ''; };

// Init
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
if (S.token) { connectWS(); loadChannels(); $('register-screen').classList.add('hidden'); $('main-app').classList.remove('hidden'); }
else { $('register-screen').classList.remove('hidden'); }
