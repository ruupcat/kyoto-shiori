// Runtime checks without browser dependencies. Not a replacement for iPhone QA.
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const trip = JSON.parse(fs.readFileSync('trip.json','utf8'));
async function main() {
  assert.equal(trip.days.length,5);
  assert.equal(trip.lodgingNights,3);
  assert.equal(trip.days.at(-1).date,'2026-11-18');
  const secondDay=trip.days.find(day=>day.date==='2026-11-16');
  assert.deepEqual(secondDay.events.filter(event=>['kurama','kifune'].includes(event.id)).map(event=>event.id),['kurama','kifune']);
  assert.equal(secondDay.events.find(event=>event.id==='car-pickup').time,'17:30');
  assert.equal(trip.days.find(day=>day.date==='2026-11-18').events[0].id,'breakfast-konono');
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
    window:{scrollY:0,matchMedia:()=>({matches:false}),scrollTo:options=>{nodes.scrollOptions=options;},addEventListener:(type,fn)=>windowListeners[type]=fn},
    fetch:async()=>{throw new Error('Network unavailable on first render');}, console, setTimeout, clearTimeout
  });
  vm.runInContext(fs.readFileSync('app.js','utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(element('#back-to-top').hidden,true);
  context.window.scrollY=400;windowListeners.scroll();
  assert.equal(element('#back-to-top').hidden,false);
  element('#back-to-top').click();assert.equal(nodes.scrollOptions.top,0);assert.equal(nodes.scrollOptions.behavior,'smooth');
  context.window.matchMedia=()=>({matches:true});element('#back-to-top').click();assert.equal(nodes.scrollOptions.behavior,'auto');
  context.window.scrollY=0;windowListeners.scroll();assert.equal(element('#back-to-top').hidden,true);
  assert.equal((element('#days').innerHTML.match(/class="day-tab(?: checklist-tab)?"/g)||[]).length,8);
  assert.ok(!fs.readFileSync('index.html','utf8').includes('id="memo"'));
  assert.match(element('#day-content').innerHTML,/data-prev-day="2026-11-14"/);
  element('#day-content').click({target:{closest:()=>({dataset:{prevDay:'2026-11-14'}})}});
  assert.match(element('#day-content').innerHTML,/大宮駅西口のバス乗り場に集合/);
  assert.ok(!element('#day-content').innerHTML.includes('data-prev-day='));
  assert.equal(nodes.scrollOptions.top,0);
  element('#days').click({target:{closest:()=>({dataset:{date:'2026-11-15'}})}});
  assert.match(element('#day-content').innerHTML,/data-next-day="2026-11-16"/);
  element('#day-content').click({target:{closest:()=>({dataset:{nextDay:'2026-11-16'}})}});
  assert.match(element('#day-content').innerHTML,/鞍馬寺を参拝/);
  assert.equal(nodes.scrollOptions.top,0);
  element('#days').click({target:{closest:()=>({dataset:{date:'2026-11-15'}})}});
  assert.match(element('#day-content').innerHTML,/13:00–16:00/);
  assert.match(element('#day-content').innerHTML,/旅荘茶谷/);
  assert.match(element('#day-content').innerHTML,/assets\/fushimi-inari-map\.png/);
  element('#days').click({target:{closest:()=>({dataset:{date:'checklist'}})}});
  assert.equal((element('#day-content').innerHTML.match(/name="packing"/g)||[]).length,14);
  assert.ok(element('#day-content').innerHTML.indexOf('持ってくもの') < element('#day-content').innerHTML.indexOf('旅荘茶谷'));
  assert.ok(!element('#day-content').innerHTML.includes('amenity-legend'));
  element('#day-content').change({target:{name:'packing',value:'pack-underwear',checked:true}});
  vm.runInContext('saved = validateSaved(JSON.parse(localStorage.getItem(KEY))); render();',context);
  assert.match(element('#day-content').innerHTML,/value="pack-underwear" checked/);
  assert.equal(JSON.parse(storage.get('autumn-shiori-v1')).memo,'以前保存したメモ');
  assert.match(element('#day-content').innerHTML,/旅荘茶谷のアメニティ/);
  assert.match(element('#day-content').innerHTML,/松月館のアメニティ/);
  assert.equal((element('#day-content').innerHTML.match(/class="amenity-card"/g)||[]).length,3);
  assert.ok(element('#days').innerHTML.indexOf('data-date="checklist"') < element('#days').innerHTML.indexOf('data-date="2026-11-14"'));
  for(const day of trip.days){
    element('#days').click({target:{closest:()=>({dataset:{date:day.date}})}});
    assert.match(element('#day-content').innerHTML,new RegExp(day.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  element('#days').click({target:{closest:()=>({dataset:{date:'2026-11-16'}})}});
  assert.equal((element('#day-content').innerHTML.match(/class="departure-option route-option"/g)||[]).length,6);
  for(const option of secondDay.events.find(e=>e.id==='nara-move').routeOptions){
    assert.equal(option.legs.length,3);
    const toMinutes=s=>s.split(':').reduce((h,m)=>Number(h)*60+Number(m));
    for(let i=0;i<2;i++)assert.equal(toMinutes(option.legs[i+1].departure)-toMinutes(option.legs[i].arrival),option.legs[i].transferMinutes);
    assert.ok(option.legs.slice(0,2).every(leg=>leg.transferMinutes>=5));
  }
  assert.match(element('#day-content').innerHTML,/assets\/kurama-map\.png/);
  assert.match(element('#day-content').innerHTML,/kuramadera\.or\.jp\/annai\.html/);
  assert.match(element('#day-content').innerHTML,/href="tel:09073641862"/);
  assert.match(element('#day-content').innerHTML,/チェックイン 22:00まで/);
  assert.match(element('#day-content').innerHTML,/大淀町下渕172/);
  element('#days').click({target:{closest:()=>({dataset:{date:'2026-11-18'}})}});
  assert.ok(!element('#day-content').innerHTML.includes('data-next-day='));
  assert.match(element('#day-content').innerHTML,/data-prev-day="2026-11-17"/);
  element('#day-content').change({target:{name:'breakfast',value:'b'}});
  assert.equal(JSON.parse(storage.get('autumn-shiori-v1')).memo,'以前保存したメモ');
  assert.equal(JSON.parse(storage.get('autumn-shiori-v1')).choices.breakfast,'b');
  windowListeners.beforeprint();
  assert.equal((element('#day-content').innerHTML.match(/class="print-day"/g)||[]).length,5);
  windowListeners.afterprint();
  assert.match(element('#day-content').innerHTML,/高野山・大阪から帰路へ/);
  const handlers={},cacheEntries=new Map();
  const cache={addAll:async urls=>{for(const url of urls){const file=new URL(url).pathname.replace('/kyoto-shiori/','')||'index.html';assert.ok(fs.existsSync(file),file);cacheEntries.set(url,{file});}},match:async req=>cacheEntries.get(typeof req==='string'?req:req.url),put:async(req,response)=>cacheEntries.set(typeof req==='string'?req:req.url,response)};
  const swContext=vm.createContext({URL,Response,AbortController,setTimeout,clearTimeout,
    self:{registration:{scope:'https://example.test/kyoto-shiori/'},location:{origin:'https://example.test'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(type,fn)=>handlers[type]=fn},
    caches:{open:async()=>cache,keys:async()=>['autumn-shiori-shell-v149'],delete:async()=>true},fetch:async()=>{throw new Error('offline');}
  });
  vm.runInContext(fs.readFileSync('sw.js','utf8'),swContext);
  let pending;handlers.install({waitUntil:p=>pending=p});await pending;
  let status;handlers.message({data:{type:'CHECK_CACHE'},ports:[{postMessage:value=>status=value}],waitUntil:p=>pending=p});await pending;
  assert.equal(status.ready,true);assert.equal(status.count,14);
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
  console.log('PASS: 5 days / 3 lodging nights, new itinerary order and contacts, memo UI removed with stored data preserved, embedded offline data, choices, print and offline cache.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
