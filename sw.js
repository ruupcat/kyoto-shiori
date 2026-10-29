'use strict';
const CACHE = 'autumn-shiori-shell-v39';
const ASSETS = ['./','./index.html','./style.css','./app.js','./trip.json','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./assets/fushimi-inari-map.png'];
const urls = ASSETS.map(path=>new URL(path,self.registration.scope).href);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('autumn-shiori-shell-') && key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async()=>{
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request,{ignoreSearch:true});
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),2500);
    try {
      const response = await fetch(event.request,{cache:'no-store',signal:controller.signal});
      if(response.ok) {
        if(urls.includes(url.href)) await cache.put(event.request,response.clone());
        return response;
      }
      return cached || response;
    }
    catch {
      if(cached) return cached;
      if(event.request.mode === 'navigate') return (await cache.match(new URL('./index.html',self.registration.scope).href)) || Response.error();
      return Response.error();
    }
    finally { clearTimeout(timeout); }
  })());
});
self.addEventListener('message', event => {
  if(event.data?.type !== 'CHECK_CACHE' || !event.ports[0]) return;
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    const entries = await Promise.all(urls.map(url=>cache.match(url)));
    event.ports[0].postMessage({ready:entries.every(Boolean),count:entries.filter(Boolean).length});
  }));
});
