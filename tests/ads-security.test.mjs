import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { ApiError, body, handle, readReplies, validateAd } from '../lib/ads-api.mjs';
const sql = await readFile(new URL('../supabase/ads_security.sql', import.meta.url),'utf8');
const secret='00000000-0000-4000-8000-000000000001', pub='00000000-0000-4000-8000-000000000002', other='00000000-0000-4000-8000-000000000003';
async function asRole(db, role, statement, args=[]) {
 await db.exec(`set role ${role}`);
 try { return await db.query(statement,args); } finally { await db.exec('reset role'); }
}
test('actual SQL migration: access controls, legacy hashing, public/private replies and persistent budget',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create table ads(id uuid primary key default gen_random_uuid(),title text,description text,city text,lat double precision,lng double precision,event_date text,event_time text,response_mode text,public_contact text,image_url text,created_at timestamptz default now(),password text);
 create table responses(id uuid primary key default gen_random_uuid(),ad_id uuid references ads(id),message text,contact text,created_at timestamptz default now());
 grant all on ads,responses to anon,authenticated; grant select(password) on ads to anon;
 alter table ads enable row level security; create policy old_open_ads on ads for all using(true) with check(true);
 alter table responses enable row level security; create policy old_open_responses on responses for all using(true) with check(true);
 insert into ads(id,title,response_mode,password) values('${secret}','Private','secret','abc'),('${pub}','Public','public',''),('${other}','Unknown',null,'different');
 insert into responses(ad_id,message,contact) values('${secret}','PRIVATE SENTINEL','PRIVATE CONTACT'),('${pub}','PUBLIC SENTINEL','PUBLIC CONTACT'),('${other}','OTHER SENTINEL','OTHER CONTACT');`);
 await db.exec(sql);
 assert(!(await db.query("select column_name from information_schema.columns where table_name='ads'")).rows.some(r=>r.column_name==='password'));
 for(const role of ['anon','authenticated']) for(const statement of ['select * from ads','select password_hash from ads','select * from responses',"select ff_read_replies('x','')",'select ff_list_ads()',"insert into ads(title) values('forged')","update ads set response_mode='public'","delete from responses"])
  await assert.rejects(asRole(db,role,statement),/permission denied/);
 assert.equal((await db.query("select * from pg_policies where tablename in ('ads','responses')")).rows.length,0);
 const list=(await asRole(db,'service_role','select ff_list_ads() as data')).rows[0].data;
 assert.equal(list.ads.length,3); assert.equal(list.counts[secret],1); assert(!JSON.stringify(list).includes('password')); assert(!JSON.stringify(list).includes('SENTINEL'));
 const read=async(id,password)=>(await asRole(db,'service_role','select ff_read_replies($1,$2) as data',[id,password])).rows[0].data;
 for(const pass of ['', 'wrong', 'different']) { const r=await read(secret,pass); assert.equal(r.status,403); assert(!r.replies); }
 assert.equal((await read(secret,'abc')).replies[0].message,'PRIVATE SENTINEL');
 assert.equal((await read(pub,'')).replies[0].message,'PUBLIC SENTINEL');
 assert.equal((await read(other,'')).status,403);
 assert.equal((await read('missing','abc')).status,403);
 await db.query('update ff_reply_attempts set attempts=30 where ad_id=$1',[secret]);
 assert.equal((await read(secret,'abc')).status,429);
 await db.query("update ff_reply_attempts set window_start=now()-interval '16 minutes' where ad_id=$1",[secret]);
 assert.equal((await read(secret,'abc')).replies.length,1);
 const input={title:'New ad',description:'Description',city:'Prague',response_mode:'secret',password:'strong-new-password',lat:null,lng:null};
 await asRole(db,'service_role','select ff_create_ad($1::jsonb)',[JSON.stringify(input)]);
 const created=(await db.query("select * from ads where title='New ad'")).rows[0]; assert(created.password_hash.startsWith('$2')); assert(!created.password_hash.includes(input.password));
 await asRole(db,'service_role','select ff_send_reply($1,$2,$3)',[created.id,'NEW PRIVATE','CONTACT']);
 assert.equal((await read(created.id,input.password)).replies[0].message,'NEW PRIVATE');
 await assert.rejects(asRole(db,'service_role','select ff_create_ad($1::jsonb)',[JSON.stringify({...input,password:'short'})]),/Invalid password/);
 // Exercise the actual route handlers against real PostgreSQL functions.
 const originalFetch=globalThis.fetch;
 const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY, previousURL=process.env.SUPABASE_URL;
 process.env.SUPABASE_SERVICE_ROLE_KEY='integration-service-key'; process.env.SUPABASE_URL='https://db.example.test';
 try {
  globalThis.fetch=async(url,options)=>{
   assert.equal(options.headers.apikey,'integration-service-key');
   const name=new URL(url).pathname.split('/').pop();
   const args=JSON.parse(options.body);
   const signatures={ff_list_ads:[],ff_create_ad:['p_ad'],ff_send_reply:['p_ad_id','p_message','p_contact'],ff_read_replies:['p_ad_id','p_password']};
   const keys=signatures[name]; assert(keys);
   const values=keys.map(k=>k==='p_ad'?JSON.stringify(args[k]):args[k]);
   try {
    const result=await asRole(db,'service_role',`select ${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')}) as result`,values);
    return Response.json(result.rows[0].result ?? null);
   } catch { return Response.json({error:'database failure'},{status:500}); }
  };
  const listing=await import('../app/api/ads/route.js');
  const reading=await import('../app/api/ads/[id]/replies/read/route.js');
  const sending=await import('../app/api/ads/[id]/replies/route.js');
  const request=data=>new Request('https://site.example.test/api/ads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const response=await listing.GET(); assert.equal(response.status,200); assert(!JSON.stringify(await response.json()).includes('password'));
  const denied=await reading.POST(request({password:'wrong'}),{params:Promise.resolve({id:secret})}); assert.equal(denied.status,403); assert(!('replies' in await denied.json()));
  const publicResponse=await reading.POST(request({}),{params:Promise.resolve({id:pub})}); assert.equal(publicResponse.status,200); assert.equal((await publicResponse.json()).replies[0].message,'PUBLIC SENTINEL');
  const send=await sending.POST(request({message:'THROUGH API',contact:'PRIVATE'}),{params:Promise.resolve({id:secret})}); assert.equal(send.status,200);
  const privateResponse=await reading.POST(request({password:'abc'}),{params:Promise.resolve({id:secret})}); assert.equal(privateResponse.status,200); assert.equal((await privateResponse.json()).replies.length,2);
  const createdResponse=await listing.POST(request({...input,password:'another-long-password'})); assert.equal(createdResponse.status,200);
 } finally {
  globalThis.fetch=originalFetch;
  if(previousKey===undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;
  if(previousURL===undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=previousURL;
 }
 } finally { await db.close(); }
});
test('API rejects invalid requests, forwards password only to server RPC and suppresses backend details',async()=>{
 assert.throws(()=>validateAd({response_mode:'secret',title:'X',description:'X',city:'X',password:'short'}),ApiError);
 assert.throws(()=>validateAd({response_mode:'secret',title:'X',description:'X',city:'X',password:'😀'.repeat(20)}),ApiError);
 const valid=validateAd({response_mode:'public',title:'X',description:'X',city:'X',public_contact:'Meet here',password:'discard',password_hash:'forged'});
 assert.equal(valid.password,''); assert(!('password_hash' in valid));
 const req=(value,origin='https://example.test')=>new Request('https://example.test/api/ads',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:value});
 await assert.rejects(body(req('{}','https://evil.test')),e=>e.status===403);
 await assert.rejects(body(req('x'.repeat(32769))),e=>e.status===413);
 await assert.rejects(body(req('{')),e=>e.status===400);
 const original=globalThis.fetch;
 process.env.SUPABASE_URL='https://database.example.test'; process.env.SUPABASE_SERVICE_ROLE_KEY='test-server-secret';
 try {
 globalThis.fetch=async(url,options)=>{
  assert(url.endsWith('/rpc/ff_read_replies')); assert.equal(options.cache,'no-store'); assert.equal(JSON.parse(options.body).p_ad_id,secret);
  return Response.json({status:403,error:'Ad unavailable or incorrect password.'});
 };
 const denied=await handle(()=>readReplies(secret,{password:'wrong'})); assert.equal(denied.status,403); assert.match(denied.headers.get('cache-control'),/no-store/); assert(!JSON.stringify(await denied.json()).includes('replies'));
 globalThis.fetch=async()=>Response.json({error:'SQL SECRET INTERNAL'},{status:500});
 const failure=await handle(()=>readReplies(secret,{password:'wrong'})); assert.equal(failure.status,503); assert(!JSON.stringify(await failure.json()).includes('SQL SECRET'));
 delete process.env.SUPABASE_SERVICE_ROLE_KEY; assert.equal((await handle(()=>readReplies(secret,{}))).status,503);
 } finally {globalThis.fetch=original;delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;}
});
