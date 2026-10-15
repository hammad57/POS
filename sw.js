/* WhatsApp Clone - Service Worker (background notifications) */
const DB='https://earn-platform-76c26-default-rtdb.firebaseio.com';
const ME=new URL(self.location.href).searchParams.get('p')||'';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));

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
        vibrate:[600,300,600,300,600,300,600,300,600],data:{call:1}});
    }
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
  e.waitUntil((async()=>{
    const cl=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of cl){
      if(d.k)c.postMessage({open:d.k});
      return c.focus();
    }
    return self.clients.openWindow(self.registration.scope+(d.k?'?chat='+encodeURIComponent(d.k):''));
  })());
});
