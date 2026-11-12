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
let saved = {version:1, memo:'', choices:{}, packing:{}};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function validateSaved(value) {
  if (!value || value.version !== 1 || typeof value.memo !== 'string' || value.memo.length > 100000 || !value.choices || typeof value.choices !== 'object' || Array.isArray(value.choices)) throw new Error('形式が違います');
  const choices = {};
  for (const [key, choice] of Object.entries(value.choices)) if(key === 'breakfast' && ['a','b'].includes(choice)) choices[key] = choice;
  const packing = {};
  if(value.packing && (typeof value.packing !== 'object' || Array.isArray(value.packing))) throw new Error('形式が違います');
  for(const [id, checked] of Object.entries(value.packing || {})) if(/^pack-[a-z0-9-]{1,40}$/.test(id) && typeof checked === 'boolean') packing[id] = checked;
  return {version:1, memo:value.memo, choices, packing};
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
  const sourceLink = event.sourceURL && /^https:\/\/(?:www\.kyotobus\.jp|www\.keihan\.co\.jp|coin-locker\.net|eizandensha\.co\.jp|transit\.yahoo\.co\.jp|r\.goope\.jp|toji\.or\.jp|www\.navitime\.co\.jp|kuramadera\.or\.jp|share\.timescar\.jp|tamakijinja\.or\.jp|nambaparks\.com|www\.dd-holdings\.jp|www\.koyasan\.or\.jp)\//.test(event.sourceURL) ? '<a class="map-link" href="' + e(event.sourceURL) + '" target="_blank" rel="noopener noreferrer">' + e(event.sourceLabel || '公式時刻表を開く') + ' ↗（オンライン）</a>' : '';
  const guideImage = event.guideImage && /^\.\/assets\/[a-z0-9-]+\.(?:png|jpe?g|webp)$/.test(event.guideImage) ? '<figure class="guide-image"><a href="' + e(event.guideImage) + '" target="_blank" rel="noopener noreferrer" aria-label="境内案内図を拡大して開く"><img src="' + e(event.guideImage) + '" alt="' + e(event.guideImageAlt || '案内図') + '" loading="lazy"></a><figcaption>タップして拡大 · オフライン保存対象</figcaption></figure>' : '';
  const saying = event.saying ? `<div class="event-saying"><span class="detail-label">${e(event.saying.label)}</span><blockquote>「${e(event.saying.text)}」</blockquote></div>` : '';
  const contacts = `${event.hours || event.contactInfo ? `<span class="detail-label">営業時間・受付時間</span><p>${e(event.hours || '未登録')}</p>` : ''}${event.phone || event.contactInfo ? `<span class="detail-label">電話</span><p>${event.phone ? `<a href="tel:${e(event.phone.replace(/[^\d+]/g,''))}">${e(event.phone)}</a>` : '未登録'}</p>` : ''}`;
  const departures = event.departures ? '<div class="departure-options"><span class="detail-label">' + e(event.serviceLabel || '保存したバス候補') + ' · ' + e(event.scheduleSource || '提供情報（要確認）') + '</span>' + event.departures.map(service => '<div class="departure-option"><strong>' + e(service.departure) + '発' + (service.arrival ? ' → ' + e(service.arrival) + '着' : '') + '</strong><p>' + e(service.note) + '</p></div>').join('') + '</div>' : '';
  const routeOptions = event.routeOptions ? event.routeOptions.map(option => `<section class="departure-option route-option"><h4>${e(option.departure)} 出町柳 → ${e(option.arrival)} 橋本${option.preferred ? ' <small>乗りたい便の候補</small>' : ''}</h4><p class="route-price">${e(option.fare)} · 乗り換え2回</p>${option.legs.map((leg, index) => `<div class="route-leg"><strong>${e(leg.departure)} ${e(leg.from)} → ${e(leg.arrival)} ${e(leg.to)}</strong><p>${e(leg.line)}${leg.position ? ' · ' + e(leg.position) : ''}</p></div>${index < option.legs.length - 1 ? `<p class="route-transfer">↓ 乗り換え${e(leg.transferMinutes)}分</p>` : ''}`).join('')}</section>`).join('') : '';
  const timetable = event.timetable ? `<table class="saved-timetable"><caption>${e(event.timetable.label)}</caption><thead><tr><th scope="col">貴船口 発</th><th scope="col">出町柳 着</th></tr></thead><tbody>${event.timetable.services.map(service => `<tr><td>${e(service.departure)}</td><td>${e(service.arrival)}</td></tr>`).join('')}</tbody></table><p>${e(event.timetable.note)}</p>` : '';
  const priceList = event.priceList ? `<table class="saved-timetable"><caption>${e(event.priceList.label)}</caption><thead><tr><th scope="col">サイズ</th><th scope="col">料金の目安</th></tr></thead><tbody>${event.priceList.items.map(item=>`<tr><th scope="row">${e(item.name)}</th><td>${e(item.price)}</td></tr>`).join('')}</tbody></table><p>${e(event.priceList.note)}</p>` : '';
  const admission = event.admission ? `<div class="departure-options"><strong>${e(event.admission.label)}</strong><p>${e(event.admission.period)}</p>${event.admission.items.map(item => `<div class="departure-option"><span>${e(item.name)}</span>：<strong>${e(item.price)}</strong></div>`).join('')}<p>${e(event.admission.free)}</p></div>` : '';
  const stops = event.stops ? '<ul class="visit-stops">' + event.stops.map(stop => '<li><h4>' + e(stop.name) + '</h4><p class="stop-access">' + e(stop.access) + '</p>' + (stop.address ? '<p>' + e(stop.address) + '</p>' : '') + '<p>' + e(stop.note) + '</p>' + (stop.address ? '<a class="map-link" href="https://www.google.com/maps/search/?api=1&amp;query=' + encodeURIComponent(stop.name + ' ' + stop.address) + '" target="_blank" rel="noopener noreferrer">地図を開く ↗ <small>（オンライン）</small></a>' : '') + '</li>').join('') + '</ul>' : '';
  const venues = event.venues ? event.venues.map(venue => `<div class="departure-option"><strong>${e(venue.name)}</strong><p>${e(venue.hours)}</p><p>${e(venue.address)}</p>${venue.phone ? `<p><a href="tel:${e(venue.phone.replace(/[^\d+]/g,''))}">${e(venue.phone)}</a></p>` : ''}<a class="map-link" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(venue.name + ' ' + venue.address)}" target="_blank" rel="noopener noreferrer">地図を開く ↗ <small>（オンライン）</small></a></div>`).join('') : '';
  const choices = event.choices ? `<div role="group" aria-label="朝食の候補">${event.choices.map(choice => `<label class="choice"><input type="radio" name="${printing?'print-':''}breakfast" value="${e(choice.id)}" ${saved.choices[event.id] === choice.id?'checked':''} ${printing?'disabled':''}>${e(choice.label)}</label>`).join('')}</div>` : '';
  return `<details class="event ${event.fixed?'fixed':''}" ${printing?'open':''}><summary><div class="event-head"><div><span class="time">${e(event.time || '時刻未定')}${event.fixed?' · 時刻固定':''}</span><h3 class="event-title"><span class="event-icon" aria-hidden="true">${e(event.icon || '📍')}</span><span>${e(event.title)}</span></h3><div class="tags">${event.status?`<span class="tag warm">${e(event.status)}</span>`:''}${event.transport?`<span class="tag">${e(event.transport)}</span>`:''}</div></div></div></summary><div class="event-body">${event.place?`<span class="detail-label">場所</span><p>${e(event.place)}</p>`:''}${event.address?`<span class="detail-label">住所 · オフラインでも確認できます</span><p>${e(event.address)}</p>`:''}${saying}${contacts}<p>${e(event.note)}</p>${choices}${priceList}${admission}${stops}${venues}${departures}${routeOptions}${timetable}${guideImage}${sourceLink}${maps}</div></details>`;
}
function dayHTML(day, printing = false) {
  const dayIndex = trip.days.findIndex(candidate=>candidate.date===day.date);
  const nextDay = trip.days[dayIndex + 1], prevDay = trip.days[dayIndex - 1];
  const previous = !printing && prevDay ? '<button type="button" class="prev-day-button" data-prev-day="' + escapeHTML(prevDay.date) + '" aria-label="前日を見る：' + Number(prevDay.date.slice(5,7)) + '月' + Number(prevDay.date.slice(8)) + '日 ' + escapeHTML(prevDay.label) + '">← 前日を見る</button>' : '';
  const next = !printing && nextDay ? '<button type="button" class="next-day-button" data-next-day="' + escapeHTML(nextDay.date) + '" aria-label="翌日を見る：' + Number(nextDay.date.slice(5,7)) + '月' + Number(nextDay.date.slice(8)) + '日 ' + escapeHTML(nextDay.label) + '">翌日を見る →</button>' : '';
  const nextButton = previous || next ? '<div class="day-navigation">' + previous + next + '</div>' : '';
  return `<div class="${printing?'print-day':''}"><div class="day-intro"><span class="day-number">${escapeHTML(day.chapter)} · ${Number(day.date.slice(5,7))}月${Number(day.date.slice(8))}日（${escapeHTML(day.weekday)}）</span><h2>${escapeHTML(day.title)}</h2><p>${escapeHTML(day.subtitle)}</p></div><div class="timeline">${day.events.map(event=>eventHTML(event, printing)).join('')}</div>${nextButton}</div>`;
}
function checklistHTML(printing = false) {
  const e = escapeHTML;
  const packing = '<section class="packing-card"><h3>持ってくもの</h3>' + (trip.checklist?.packingGroups || []).map(group => '<div class="packing-group" role="group" aria-label="' + e(group.label) + '">' + group.items.map(item => '<label class="packing-item"><input type="checkbox" name="packing" value="' + e(item.id) + '" ' + (saved.packing[item.id] ? 'checked ' : '') + (printing ? 'disabled ' : '') + '><span><span class="packing-name">' + e(item.name) + '</span>' + (item.note ? '<small>' + e(item.note) + '</small>' : '') + '</span></label>').join('') + '</div>').join('') + '</section>';
  return '<section class="checklist-page"><div class="day-intro"><h2>チェックリスト</h2></div>' + packing + (trip.checklist?.lodgingAmenities || []).map(stay => '<section class="amenity-card"><h3>' + e(stay.night) + '泊目 · ' + e(stay.name) + '</h3><table class="amenity-table" aria-label="' + e(stay.name) + 'のアメニティ"><thead><tr><th scope="col">有無</th><th scope="col">アメニティ</th><th scope="col">有無</th><th scope="col">アメニティ</th></tr></thead><tbody>' + stay.rows.map(row => '<tr>' + row.map(item => item ? '<td class="amenity-mark" aria-label="' + (item.available ? 'あり' : 'なし') + '">' + (item.available ? '○' : '×') + '</td><td>' + e(item.name) + '</td>' : '<td></td><td></td>').join('') + '</tr>').join('') + '</tbody></table>' + (stay.note ? '<p class="amenity-note">' + e(stay.note) + '</p>' : '') + '</section>').join('') + '</section>';
}
function weatherHTML() {
  return '<section class="weather-page"><div class="day-intro"><h2>天気</h2></div><section class="packing-card"><h3><a class="map-link" href="https://tenki.jp/forecast/6/29/6110/26100/10days.html" target="_blank" rel="noopener noreferrer">京都の天気 ↗</a></h3></section><section class="packing-card"><h3><a class="map-link" href="https://tenki.jp/forecast/6/32/6410/29402/10days.html" target="_blank" rel="noopener noreferrer">奈良（明日香村）の天気 ↗</a></h3></section><p>天気予報を見るには通信が必要です。</p></section>';
}
function contactsHTML() {
  const e = escapeHTML;
  return '<section class="contacts-page"><div class="day-intro"><h2>連絡先一覧</h2></div>' + (trip.contactDirectory || []).map(contact => '<section class="contact-card"><h3>' + e(contact.name) + '</h3>' + (contact.reading ? '<small>' + e(contact.reading) + '</small>' : '') + (contact.phone ? '<p><a class="contact-phone" href="tel:' + contact.phone.replace(/[^0-9+]/g,'') + '">' + e(contact.phone) + '</a></p>' : '') + (contact.address ? '<p>' + e(contact.address) + '</p><a class="map-link" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(contact.name + ' ' + contact.address) + '" target="_blank" rel="noopener noreferrer">地図を開く ↗</a>' : '') + '</section>').join('') + '</section>';
}
function render() {
  $('#days').innerHTML = `<button class="day-tab checklist-tab" type="button" data-date="weather" aria-pressed="${activeDay === 'weather'}">天気</button><button class="day-tab checklist-tab" type="button" data-date="contacts" aria-pressed="${activeDay === 'contacts'}">連絡先<br>一覧</button><button class="day-tab checklist-tab" type="button" data-date="checklist" aria-pressed="${activeDay === 'checklist'}">チェック<br>リスト</button>` + trip.days.map(day => `<button class="day-tab" data-weekday="${escapeHTML(day.weekday)}" type="button" aria-pressed="${day.date === activeDay}" data-date="${day.date}" aria-label="${Number(day.date.slice(5,7))}月${Number(day.date.slice(8))}日 ${escapeHTML(day.label)}"><strong>${Number(day.date.slice(8))}日<small style="font-size:10px">(${escapeHTML(day.weekday)})</small></strong><span>${escapeHTML(day.label)}</span></button>`).join('');
  $('#day-content').innerHTML = activeDay === 'weather' ? weatherHTML() : activeDay === 'contacts' ? contactsHTML() : activeDay === 'checklist' ? checklistHTML() : dayHTML(trip.days.find(day=>day.date===activeDay));
}
$('#days').addEventListener('click', event => { const button = event.target.closest('[data-date]'); if(button) { activeDay = button.dataset.date; render(); } });
$('#day-content').addEventListener('click', event => {
  const button = event.target.closest('[data-next-day], [data-prev-day]');
  const targetDay = button && (button.dataset.nextDay || button.dataset.prevDay);
  if(targetDay && trip.days.some(day=>day.date===targetDay)) { activeDay = targetDay; render(); window.scrollTo({top:0,behavior:'auto'}); }
});
$('#day-content').addEventListener('change', event => { if(event.target.name === 'packing' && /^pack-[a-z0-9-]{1,40}$/.test(event.target.value)) { saved.packing[event.target.value] = event.target.checked; persist(); } else if(event.target.name === 'breakfast') { saved.choices.breakfast = event.target.value; persist(); } });
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
function preparePrint() { if(trip) $('#day-content').innerHTML = checklistHTML(true) + trip.days.map(day=>dayHTML(day,true)).join(''); }
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
    status.textContent = result.ready ? `保存完了 · 全${trip?.days.length || 5}日間とアプリをこの端末に保存済み。機内モードで再起動も試してください。` : '保存が未完了です。通信がある状態で再読み込みしてください。';
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

const backToTop = $('#back-to-top');
function updateBackToTop() { backToTop.hidden = window.scrollY < 300; }
window.addEventListener('scroll', updateBackToTop, {passive:true});
backToTop.addEventListener('click', () => {
  window.scrollTo({top:0, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
});
updateBackToTop();
