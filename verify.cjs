// Runtime checks without browser dependencies. Not a replacement for iPhone QA.
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const trip = JSON.parse(fs.readFileSync('trip.json','utf8'));
async function main() {
  assert.equal(trip.days.length,6);
  assert.equal(trip.lodgingNights,3);
  assert.equal(trip.days.at(-1).date,'2026-11-19');
  const secondDay=trip.days.find(day=>day.date==='2026-11-16');
  assert.deepEqual(secondDay.events.filter(event=>['kurama','kifune','hiei'].includes(event.id)).map(event=>event.id),['kurama','kifune','hiei']);
  assert.equal(secondDay.events.find(event=>event.id==='car-pickup').time,'18:00');
  assert.equal(trip.days.find(day=>day.date==='2026-11-18').events[0].id,'koyasan');
  assert.equal(new Set(trip.days.flatMap(day=>day.events.map(event=>event.id))).size,trip.days.flatMap(day=>day.events).length);
  const nodes = {}, storage = new Map(), windowListeners = {};
  storage.set('autumn-shiori-v1',JSON.stringify({version:1,memo:'以前保存したメモ',choices:{}}));
  const element = selector => nodes[selector] ||= {innerHTML:'',textContent:'',value:'',addEventListener(type,fn){this[type]=fn;}};
  const embedded = fs.readFileSync('index.html','utf8').match(/<script id="trip-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(embedded,'Embedded itinerary exists');
  assert.deepEqual(JSON.parse(embedded[1]),trip);
  element('#trip-data').textContent = embedded[1];
  const context = vm.createContext({
    document:{querySelector:selector=>selector==='#memo'?null:element(selector)}, navigator:{onLine:true}, location:{protocol:'http:'},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    window:{addEventListener:(type,fn)=>windowListeners[type]=fn},
    fetch:async()=>{throw new Error('Network unavailable on first render');}, console, setTimeout, clearTimeout
  });
  vm.runInContext(fs.readFileSync('app.js','utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal((element('#days').innerHTML.match(/class="day-tab"/g)||[]).length,6);
  assert.ok(!fs.readFileSync('index.html','utf8').includes('id="memo"'));
  assert.match(element('#day-content').innerHTML,/13:00–16:00/);
  assert.match(element('#day-content').innerHTML,/旅荘茶谷/);
  assert.match(element('#day-content').innerHTML,/assets\/fushimi-inari-map\.png/);
  for(const day of trip.days){
    element('#days').click({target:{closest:()=>({dataset:{date:day.date}})}});
    assert.match(element('#day-content').innerHTML,new RegExp(day.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  element('#days').click({target:{closest:()=>({dataset:{date:'2026-11-16'}})}});
  assert.match(element('#day-content').innerHTML,/href="tel:0747630560"/);
  assert.match(element('#day-content').innerHTML,/18:00–21:00/);
  assert.match(element('#day-content').innerHTML,/南日裏508/);
  element('#days').click({target:{closest:()=>({dataset:{date:'2026-11-19'}})}});
  element('#day-content').change({target:{name:'breakfast',value:'b'}});
  assert.equal(JSON.parse(storage.get('autumn-shiori-v1')).memo,'以前保存したメモ');
  assert.equal(JSON.parse(storage.get('autumn-shiori-v1')).choices.breakfast,'b');
  windowListeners.beforeprint();
  assert.equal((element('#day-content').innerHTML.match(/class="print-day"/g)||[]).length,6);
  windowListeners.afterprint();
  assert.match(element('#day-content').innerHTML,/帰宅日/);
  const handlers={},cacheEntries=new Map();
  const cache={addAll:async urls=>{for(const url of urls){const file=new URL(url).pathname.replace('/kyoto-shiori/','')||'index.html';assert.ok(fs.existsSync(file),file);cacheEntries.set(url,{file});}},match:async req=>cacheEntries.get(typeof req==='string'?req:req.url),put:async(req,response)=>cacheEntries.set(typeof req==='string'?req:req.url,response)};
  const swContext=vm.createContext({URL,Response,AbortController,setTimeout,clearTimeout,
    self:{registration:{scope:'https://example.test/kyoto-shiori/'},location:{origin:'https://example.test'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(type,fn)=>handlers[type]=fn},
    caches:{open:async()=>cache,keys:async()=>['autumn-shiori-shell-v40'],delete:async()=>true},fetch:async()=>{throw new Error('offline');}
  });
  vm.runInContext(fs.readFileSync('sw.js','utf8'),swContext);
  let pending;handlers.install({waitUntil:p=>pending=p});await pending;
  let status;handlers.message({data:{type:'CHECK_CACHE'},ports:[{postMessage:value=>status=value}],waitUntil:p=>pending=p});await pending;
  assert.equal(status.ready,true);assert.equal(status.count,10);
  let response;
  handlers.fetch({request:{url:'https://example.test/kyoto-shiori/trip.json',method:'GET'},respondWith:p=>response=p});
  assert.equal((await response).file,'trip.json');
  handlers.fetch({request:{url:'https://example.test/kyoto-shiori/assets/fushimi-inari-map.png',method:'GET'},respondWith:p=>response=p});
  assert.equal((await response).file,'assets/fushimi-inari-map.png');
  handlers.fetch({request:{url:'https://example.test/kyoto-shiori/unknown',method:'GET',mode:'navigate'},respondWith:p=>response=p});
  assert.equal((await response).file,'index.html');
  swContext.fetch=async()=>new Response('最新の日本語画面',{status:200});
  const request={url:'https://example.test/kyoto-shiori/',method:'GET',mode:'navigate'};
  handlers.fetch({request,respondWith:p=>response=p});
  assert.equal(await (await response).text(),'最新の日本語画面');
  swContext.fetch=async()=>{throw new Error('offline');};
  handlers.fetch({request,respondWith:p=>response=p});
  assert.equal(await (await response).text(),'最新の日本語画面');
  console.log('PASS: online fetch replaces old cache; subsequent offline navigation uses the updated cache.');
  console.log('PASS: 6 days / 3 lodging nights, new itinerary order and contacts, memo UI removed with stored data preserved, embedded offline data, choices, print and offline cache.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
