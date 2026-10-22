// Keep trip.json as the editable source; embed it for reliable first render.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const trip = JSON.parse(fs.readFileSync(path.join(root,'trip.json'),'utf8'));
const data = JSON.stringify(trip).replace(/</g,'\\u003c');
const file = path.join(root,'index.html');
const html = fs.readFileSync(file,'utf8');
const marker = /<!-- TRIP_DATA_START -->[\s\S]*?<!-- TRIP_DATA_END -->/;
if(!marker.test(html)) throw new Error('Missing trip data markers');
fs.writeFileSync(file,html.replace(marker,()=>`<!-- TRIP_DATA_START -->\n  <script id="trip-data" type="application/json">${data}</script>\n  <!-- TRIP_DATA_END -->`));
console.log(`Embedded ${trip.days.length} days in index.html`);
