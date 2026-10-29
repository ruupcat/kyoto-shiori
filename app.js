'use strict';
const $ = selector => document.querySelector(selector);
const KEY = 'autumn-shiori-v1';
let trip, activeDay = '2026-11-15', registration;
if ('serviceWorker' in navigator) {
  const alreadyControlled = Boolean(navigator.serviceWorker.controller);
  let refreshed = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(alreadyControlled && !refreshed) { refreshed = true; window.location.reload(); }
  });
}
let saved = {version:1, memo:'', choices:{}};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function validateSaved(value) {
  if (!value || value.version !== 1 || typeof value.memo !== 'string' || value.memo.length > 100000 || !value.choices || typeof value.choices !== 'object' || Array.isArray(value.choices)) throw new Error('形式が違います');
  const choices = {};
  for (const [key, choice] of Object.entries(value.choices)) if(key === 'breakfast' && ['a','b'].includes(choice)) choices[key] = choice;
  return {version:1, memo:value.memo, choices};
}
try { const raw = localStorage.getItem(KEY); if(raw) saved = validateSaved(JSON.parse(raw)); }
catch { $('#save-status').textContent = '保存内容を読み込めませんでした。バックアップから復元できます。'; }
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(saved)); $('#save-status').textContent = 'この端末に保存しました'; }
  catch { $('#save-status').textContent = '端末に保存できません。バックアップをダウンロードしてください。'; }
}
function eventHTML(event, printing = false) {
  const e = escapeHTML;
  const mapURL = event.map && /^https:\/\/maps\.app\.goo\.gl\//.test(event.map) ? event.map : event.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}` : '';
  const maps = mapURL ? `<a class="map-link" href="${e(mapURL)}" target="_blank" rel="noopener noreferrer">地図を開く ↗ <small>（オンライン）</small></a>` : '';
  const contacts = `${event.hours || event.contactInfo ? `<span class="detail-label">営業時間・受付時間</span><p>${e(event.hours || '未登録')}</p>` : ''}${event.phone || event.contactInfo ? `<span class="detail-label">電話</span><p>${event.phone ? `<a href="tel:${e(event.phone.replace(/[^\d+]/g,''))}">${e(event.phone)}</a>` : '未登録'}</p>` : ''}`;
  const choices = event.choices ? `<div role="group" aria-label="朝食の候補">${event.choices.map(choice => `<label class="choice"><input type="radio" name="${printing?'print-':''}breakfast" value="${e(choice.id)}" ${saved.choices[event.id] === choice.id?'checked':''} ${printing?'disabled':''}>${e(choice.label)}</label>`).join('')}</div>` : '';
  return `<details class="event ${event.fixed?'fixed':''}" ${printing?'open':''}><summary><div class="event-head"><div><span class="time">${e(event.time || '時刻未定')}${event.fixed?' · 時刻固定':''}</span><h3 class="event-title"><span class="event-icon" aria-hidden="true">${e(event.icon || '📍')}</span><span>${e(event.title)}</span></h3><div class="tags">${event.status?`<span class="tag warm">${e(event.status)}</span>`:''}${event.transport?`<span class="tag">${e(event.transport)}</span>`:''}</div></div></div></summary><div class="event-body">${event.place?`<span class="detail-label">場所</span><p>${e(event.place)}</p>`:''}${event.address?`<span class="detail-label">住所 · オフラインでも確認できます</span><p>${e(event.address)}</p>`:''}${contacts}<p>${e(event.note)}</p>${choices}${maps}</div></details>`;
}
function dayHTML(day, printing = false) {
  return `<div class="${printing?'print-day':''}"><div class="day-intro"><span class="day-number">${escapeHTML(day.chapter)} · ${Number(day.date.slice(5,7))}月${Number(day.date.slice(8))}日（${escapeHTML(day.weekday)}）</span><h2>${escapeHTML(day.title)}</h2><p>${escapeHTML(day.subtitle)}</p></div>${day.warning?`<div class="day-warning">要確認 · ${escapeHTML(day.warning)}</div>`:''}<div class="timeline">${day.events.map(event=>eventHTML(event, printing)).join('')}</div></div>`;
}
function render() {
  $('#days').innerHTML = trip.days.map(day => `<button class="day-tab" data-weekday="${escapeHTML(day.weekday)}" type="button" aria-pressed="${day.date === activeDay}" data-date="${day.date}" aria-label="${Number(day.date.slice(5,7))}月${Number(day.date.slice(8))}日 ${escapeHTML(day.label)}"><span>${Number(day.date.slice(5,7))}月</span><strong>${Number(day.date.slice(8))}日<small style="font-size:10px"> ${day.weekday}</small></strong><span>${escapeHTML(day.label)}</span></button>`).join('');
  $('#day-content').innerHTML = dayHTML(trip.days.find(day=>day.date===activeDay));
}
$('#days').addEventListener('click', event => { const button = event.target.closest('[data-date]'); if(button) { activeDay = button.dataset.date; render(); } });
$('#day-content').addEventListener('change', event => { if(event.target.name === 'breakfast') { saved.choices.breakfast = event.target.value; persist(); } });
$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({...saved, exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = '秋の旅しおり-backup.json'; document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),10000);
});
$('#import').addEventListener('click', ()=>$('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if(!file) return;
  try {
    if(file.size > 500000) throw new Error('ファイルが大きすぎます');
    const restored = validateSaved(JSON.parse(await file.text()));
    if(!confirm('現在の保存内容を、このバックアップで置き換えますか？')) return;
    saved = restored; persist(); if(trip) render();
  } catch { alert('復元できませんでした。このしおりから保存したJSONファイルを選んでください。'); }
  finally { event.target.value = ''; }
});
function preparePrint() { if(trip) $('#day-content').innerHTML = trip.days.map(day=>dayHTML(day,true)).join(''); }
window.addEventListener('beforeprint', preparePrint);
window.addEventListener('afterprint', ()=>{if(trip)render();});
$('#print').addEventListener('click', ()=>{ if(trip) { preparePrint(); window.print(); } });
function connection() { $('#connection').textContent = navigator.onLine ? '接続あり' : 'オフライン'; }
window.addEventListener('online',connection); window.addEventListener('offline',connection); connection();
async function checkCache() {
  const status = $('#cache-status'), button = $('#prepare'); button.disabled = true;
  try {
    if(!registration) throw new Error('not ready');
    const worker = registration.active;
    if(!worker) throw new Error('not active');
    const result = await new Promise((resolve,reject)=>{
      const channel = new MessageChannel();
      const timeout = setTimeout(()=>reject(new Error('timeout')),10000);
      channel.port1.onmessage = message => { clearTimeout(timeout); resolve(message.data); };
      worker.postMessage({type:'CHECK_CACHE'}, [channel.port2]);
    });
    status.textContent = result.ready ? `保存完了 · 全${trip?.days.length || 6}日間とアプリをこの端末に保存済み。機内モードで再起動も試してください。` : '保存が未完了です。通信がある状態で再読み込みしてください。';
  } catch { status.textContent = '保存を確認できません。HTTPSの公開URL（PCではlocalhost）で開き、再読み込み後にお試しください。'; }
  finally { button.disabled = false; }
}
$('#prepare').addEventListener('click',checkCache);
async function initialize() {
  try {
    // The initial itinerary travels with the HTML, so rendering never waits for
    // a second request or Service Worker installation.
    trip = JSON.parse($('#trip-data').textContent);
    if(!Array.isArray(trip.days) || !trip.days.length) throw new Error('Invalid itinerary');
    render();
  } catch (error) {
    console.error('Itinerary initialization failed:', error);
    $('#day-content').innerHTML = '<p class="load-error">旅程データを表示できませんでした。ページを再読み込みしてください。解消しない場合はファイル一式を更新してください。</p>';
  }
  if('serviceWorker' in navigator && location.protocol !== 'file:') {
    try {
      await navigator.serviceWorker.register('./sw.js', {scope:'./',updateViaCache:'none'});
      registration = await navigator.serviceWorker.ready;
      await checkCache();
    } catch { $('#cache-status').textContent = 'オフライン保存ができませんでした。通信がある状態で再読み込みしてください。'; }
  } else { $('#cache-status').textContent = 'オフライン保存にはHTTPS公開が必要です。PCの確認にはlocalhostを使います。'; }
}
initialize();
