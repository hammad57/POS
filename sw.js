/* WhatsApp Clone - Service Worker (offline cache + background notifications) */
const DB='https://earn-platform-76c26-default-rtdb.firebaseio.com';
const ME=new URL(self.location.href).searchParams.get('p')||'';
const CACHE='wa-clone-v2';
const LOCAL=['./whatsappclone.html','./manifest.json','./icon-192.png','./icon-512.png'];
const CDN=['https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.2/firebase-app-compat.min.js','https://cdnjs.cloudflare.com/ajax/libs/firebase/10.12.2/firebase-database-compat.min.js'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(async c=>{
    await Promise.all([...LOCAL,...CDN].map(u=>c.add(u).catch(()=>{})));
  }));
});
self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const ks=await caches.keys();
  await Promise.all(ks.filter(k=>k!==CACHE&&k.startsWith('wa-clone')).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));

/* Same-origin files: pehle network (taake GitHub par nayi file upload karte hi update aaye),
   net na ho ya sust ho to mobile ka saved cache. Firebase scripts: cache-first (offline chalne ke liye). */
async function netFirst(req){
  const cache=await caches.open(CACHE);
  try{
    const nreq=new Request(req.url,{cache:'no-cache',credentials:'same-origin'});
    const r=await Promise.race([fetch(nreq),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),4000))]);
    if(r&&r.ok)cache.put(req,r.clone()).catch(()=>{});
    return r;
  }catch(e){
    const c=await cache.match(req,{ignoreSearch:true});
    if(c)return c;
    if(req.mode==='navigate'){const h=await cache.match('./whatsappclone.html');if(h)return h}
    return Response.error();
  }
}
async function cacheFirst(req){
  const cache=await caches.open(CACHE);
  const c=await cache.match(req);
  if(c)return c;
  try{const r=await fetch(req);if(r&&(r.ok||r.type==='opaque'))cache.put(req,r.clone()).catch(()=>{});return r}
  catch(e){return Response.error()}
}
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const u=new URL(req.url);
  if(u.origin===self.location.origin){e.respondWith(netFirst(req));return}
  if(u.hostname==='cdnjs.cloudflare.com'){e.respondWith(cacheFirst(req));return}
});

const j=async p=>{try{return await (await fetch(DB+p+'.json')).json()}catch(e){return null}};

self.addEventListener('push',e=>e.waitUntil((async()=>{
  const cl=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  if(cl.some(c=>c.visibilityState==='visible'))return; // app khula hai, notification ki zaroorat nahi
  if(ME){
    const r=await j('/wa_ring/'+ME);
    if(r&&r.room&&Date.now()-r.ts<120000){
      return self.registration.showNotification('📞 '+(r.name||'Incoming call'),{
        body:(r.video?'Video':'Audio')+' call aa rahi hai - kholne ke liye tap karein',
        tag:'call',renotify:true,requireInteraction:true,
        vibrate:[600,300,600,300,600,300,600,300,600],data:{call:1},
        actions:[{action:'accept',title:'✅ Accept'},{action:'decline',title:'❌ Decline'}]});
    }
    const old=(await self.registration.getNotifications({tag:'call'})).filter(n=>n.title.startsWith('📞'));
    if(old.length)return self.registration.showNotification('📵 Missed call',{body:old[0].title.replace('📞 ',''),tag:'call',renotify:true,vibrate:[200,100,200],data:{}});
    const ib=await j('/wa_inbox/'+ME)||{};
    const top=Object.entries(ib).filter(([k,v])=>v&&v.unread>0&&v.from!==ME).sort((a,b)=>b[1].ts-a[1].ts)[0];
    if(top){
      const [k,v]=top;let title=await j('/wa_users/'+v.from+'/name')||v.from;
      if(k.startsWith('g_')){const gn=await j('/wa_groups/'+k.slice(2)+'/name');if(gn)title=gn+' • '+title}
      return self.registration.showNotification(title,{body:v.last||'Naya message',tag:k,renotify:true,
        vibrate:[200,100,200],data:{k}});
    }
  }
  return self.registration.showNotification('WhatsApp Clone',{body:'Naya activity',tag:'generic'});
})()));

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const d=e.notification.data||{};
  if(e.action==='decline'){
    e.waitUntil(fetch(DB+'/wa_ring/'+ME+'.json',{method:'DELETE'}).catch(()=>{}));
    return;
  }
  const acc=e.action==='accept';
  e.waitUntil((async()=>{
    const cl=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of cl){
      if(d.k)c.postMessage({open:d.k});
      if(acc)c.postMessage({accept:1});
      return c.focus();
    }
    return self.clients.openWindow(self.registration.scope+(acc?'?accept=1':(d.k?'?chat='+encodeURIComponent(d.k):'')));
  })());
});
