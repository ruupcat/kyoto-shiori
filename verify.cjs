// Runtime checks without browser dependencies. Not a replacement for iPhone QA.
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const trip = JSON.parse(fs.readFileSync('trip.json','utf8'));
async function main() {
  assert.equal(trip.days.length,5);
  assert.equal(new Set(trip.days.flatMap(day=>day.events.map(event=>event.id))).size,trip.days.flatMap(day=>day.events).length);
  const nodes = {}, storage = new Map(), windowListeners = {};
  const element = selector => nodes[selector] ||= {innerHTML:'',textContent:'',value:'',addEventListener(type,fn){this[type]=fn;}};
  const embedded = fs.readFileSync('index.html','utf8').match(/<script id="trip-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(embedded,'Embedded itinerary exists');
  assert.deepEqual(JSON.parse(embedded[1]),trip);
  element('#trip-data').textContent = embedded[1];
  const context = vm.createContext({
    document:{querySelector:element}, navigator:{onLine:true}, location:{protocol:'http:'},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    window:{addEventListener:(type,fn)=>windowListeners[type]=fn},
    fetch:async()=>{throw new Error('Network unavailable on first render');}, console, setTimeout, clearTimeout
  });
  vm.runInContext(fs.readFileSync('app.js','utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal((element('#days').innerHTML.match(/class="day-tab"/g)||[]).length,5);
  assert.match(element('#day-content').innerHTML,/13:00–16:00/);
  assert.match(element('#day-content').innerHTML,/旅荘茶谷/);
  for(const day of trip.days){
    element('#days').click({target:{closest:()=>({dataset:{date:day.date}})}});
    assert.match(element('#day-content').innerHTML,new RegExp(day.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  element('#memo').value='電波がなくても残したいメモ';element('#memo').input();
  element('#day-content').change({target:{name:'breakfast',value:'b'}});
  assert.equal(JSON.parse(storage.get('autumn-shiori-v1')).memo,'電波がなくても残したいメモ');
  assert.equal(JSON.parse(storage.get('autumn-shiori-v1')).choices.breakfast,'b');
  windowListeners.beforeprint();
  assert.equal((element('#day-content').innerHTML.match(/class="print-day"/g)||[]).length,5);
  windowListeners.afterprint();
  assert.match(element('#day-content').innerHTML,/帰着日/);
  const handlers={},cacheEntries=new Map();
  const cache={addAll:async urls=>{for(const url of urls){const file=new URL(url).pathname.replace('/kyoto-shiori/','')||'index.html';assert.ok(fs.existsSync(file),file);cacheEntries.set(url,{file});}},match:async req=>cacheEntries.get(typeof req==='string'?req:req.url)};
  const swContext=vm.createContext({URL,Response,
    self:{registration:{scope:'https://example.test/kyoto-shiori/'},location:{origin:'https://example.test'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(type,fn)=>handlers[type]=fn},
    caches:{open:async()=>cache,keys:async()=>['autumn-shiori-shell-v5'],delete:async()=>true},fetch:async()=>{throw new Error('offline');}
  });
  vm.runInContext(fs.readFileSync('sw.js','utf8'),swContext);
  let pending;handlers.install({waitUntil:p=>pending=p});await pending;
  let status;handlers.message({data:{type:'CHECK_CACHE'},ports:[{postMessage:value=>status=value}],waitUntil:p=>pending=p});await pending;
  assert.equal(status.ready,true);assert.equal(status.count,9);
  let response;
  handlers.fetch({request:{url:'https://example.test/kyoto-shiori/trip.json',method:'GET'},respondWith:p=>response=p});
  assert.equal((await response).file,'trip.json');
  handlers.fetch({request:{url:'https://example.test/kyoto-shiori/unknown',method:'GET',mode:'navigate'},respondWith:p=>response=p});
  assert.equal((await response).file,'index.html');
  console.log('PASS: embedded itinerary matches JSON, first render without fetch, 5 days, fixed event, day navigation, local memo/choice save, all-day print, 9 cache assets, subpath offline JSON and navigation fallback.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
