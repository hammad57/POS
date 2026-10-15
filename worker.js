/* Cloudflare Worker - WhatsApp Clone push sender (free plan) */
const DB='https://earn-platform-76c26-default-rtdb.firebaseio.com';
const SUBJECT='mailto:admin@example.com';   // apni email likh dein
const VAPID_PUB='BCOXyUWncyxLQaSn8LXOwa6-Yw9siIYP1Kv9Kd0_2oS-sLVYKlTEBEVw8AhYObtljfI2eP0ygmwRsbJqPyryuqE';
const VAPID_JWK={kty:'EC',crv:'P-256',
  x:'I5fJRadzLEtBpKfwtc7Brr5jD2yIhg_Uq_0p3T_ahL4',
  y:'sLVYKlTEBEVw8AhYObtljfI2eP0ygmwRsbJqPyryuqE',
  d:'5O0UUYBU9PLLBbSJCZH-zbq5t6Vo53_BACy_lVE-9RA'};
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,OPTIONS'};
const b64u=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const enc=s=>b64u(new TextEncoder().encode(s));

let keyP;
const key=()=>keyP||(keyP=crypto.subtle.importKey('jwk',VAPID_JWK,{name:'ECDSA',namedCurve:'P-256'},false,['sign']));

async function vapid(endpoint){
  const aud=new URL(endpoint).origin;
  const head=enc(JSON.stringify({typ:'JWT',alg:'ES256'}));
  const body=enc(JSON.stringify({aud,exp:Math.floor(Date.now()/1000)+12*3600,sub:SUBJECT}));
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},await key(),new TextEncoder().encode(head+'.'+body));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${VAPID_PUB}`;
}

async function pushTo(phone,kind){
  const subs=await (await fetch(`${DB}/wa_push/${phone}.json`)).json();
  if(!subs)return 0;
  let n=0;
  await Promise.all(Object.entries(subs).map(async([id,s])=>{
    try{
      const r=await fetch(s.endpoint,{method:'POST',headers:{
        Authorization:await vapid(s.endpoint),
        TTL:kind==='c'?'45':'86400',Urgency:'high','Content-Length':'0'}});
      if(r.status===404||r.status===410)await fetch(`${DB}/wa_push/${phone}/${id}.json`,{method:'DELETE'});
      else if(r.ok)n++;
    }catch(e){}
  }));
  return n;
}

export default{async fetch(req){
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return new Response('WhatsApp Clone push worker OK',{headers:CORS});
  let d;try{d=JSON.parse(await req.text())}catch(e){return new Response('bad',{status:400,headers:CORS})}
  const to=(Array.isArray(d.to)?d.to:[]).map(String).filter(p=>/^\d{6,15}$/.test(p)).slice(0,50);
  const sent=(await Promise.all(to.map(p=>pushTo(p,d.kind)))).reduce((a,b)=>a+b,0);
  return new Response(JSON.stringify({sent}),{headers:{...CORS,'Content-Type':'application/json'}});
}};
