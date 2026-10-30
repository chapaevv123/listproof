import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {unlinkSync,existsSync} from 'node:fs';
import {openPlatformDb} from '../src/platform-db.mjs';
import {bootstrapOwner} from '../src/platform-auth.mjs';
const freePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});s.on('error',reject);});
const a=n=>'0x'+n.toString(16).padStart(40,'0');
test('V4 private HTTP API enforces session, CSRF and case workflow while V1 remains public',async()=>{
 const path=join(tmpdir(),'listproof-v4-http-'+randomUUID()+'.sqlite');
 const db=await openPlatformDb({sqlitePath:path});
 await bootstrapOwner(db,{email:'owner@example.test',password:'correct horse battery staple',orgSlug:'alpha-org',orgName:'Alpha'});await db.close();
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['scripts/server.mjs'],{env:{...process.env,LISTPROOF_DB_PATH:path,LISTPROOF_PORT:String(port),LISTPROOF_HOST:'127.0.0.1'},stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,40));}assert.ok(ready,'V4 server started');
  const get=path=>fetch(base+path);
  const post=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
  assert.equal((await(await get('/api/health')).json()).productVersion,'v4-rc');
  assert.equal((await get('/api/v2/cases')).status,401);
  assert.equal((await get('/api/v2/openapi.json')).status,200);
  for(const [path,type] of [['/workspace','text/html'],['/platform.css','text/css'],['/platform.js','text/javascript']]){
   const asset=await get(path);assert.equal(asset.status,200,path);assert.ok(asset.headers.get('content-type').startsWith(type));assert.ok((await asset.text()).length>100);
  }
  assert.equal((await post('/api/v1/screenings',{address:a(6),epoch:1,mode:'clean'})).status,200);
  const login=await post('/api/v2/login',{email:'owner@example.test',password:'correct horse battery staple',orgSlug:'alpha-org'});
  assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],{csrf}=await login.json();
  assert.match(login.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const auth={'cookie':cookie,'x-csrf-token':csrf};
  assert.equal((await post('/api/v2/screenings',{address:a(6),datasetVersionId:'synthetic-epoch-1'},{cookie})).status,403);
  const screen=await post('/api/v2/screenings',{address:a(6),datasetVersionId:'synthetic-epoch-1'},auth);assert.equal(screen.status,201,await screen.clone().text());
  const screened=await screen.json();assert.equal(screened.result,'not-present');assert.equal(screened.receipt.verified,true);
  const checked=await post('/api/v2/verify',{receipt:screened.receipt,datasetVersionId:'synthetic-epoch-1'},auth);assert.equal((await checked.json()).verified,true);
  const forged=structuredClone(screened.receipt);forged.commitment.root='0x'+'00'.repeat(32);
  const rejected=await post('/api/v2/verify',{receipt:forged,datasetVersionId:'synthetic-epoch-1'},auth);assert.equal((await rejected.json()).verified,false);
  const saved=await post('/api/v2/cases',{screeningId:screened.id},auth);assert.equal(saved.status,201);const item=await saved.json();
  const detail=await get('/api/v2/cases/'+item.id);assert.equal(detail.status,401);
  const details=await fetch(base+'/api/v2/cases/'+item.id,{headers:{cookie}});assert.equal((await details.json()).auditChainValid,true);
  const note=await post('/api/v2/cases/'+item.id+'/notes',{body:'Reviewed proof metadata'},auth);assert.equal(note.status,200);
  const status=await post('/api/v2/cases/'+item.id+'/status',{status:'Evidence Verified'},auth);assert.equal((await status.json()).status,'Evidence Verified');
  const batch=await post('/api/v2/batch',{addresses:[a(6),a(5),'invalid'],datasetVersionId:'synthetic-epoch-1'},auth);
  assert.deepEqual((await batch.json()).results.map(x=>x.status),['not-present','listed','error']);
  const draft=await post('/api/v2/datasets',{datasetId:'http-import',epoch:1,addresses:[a(2),a(9)],provenance:'Manual synthetic source for HTTP test'},auth);
  assert.equal(draft.status,201);const version=await draft.json();assert.equal(version.approvalStatus,'draft');
  assert.equal((await post('/api/v2/datasets/'+version.id+'/approve',{},auth)).status,200);
  assert.equal((await post('/api/v2/logout',{},auth)).status,200);
  assert.equal((await fetch(base+'/api/v2/cases',{headers:{cookie}})).status,401);
  for(const path of ['/deploy.html','/api/publication/epoch-1'])assert.equal((await get(path)).status,404);
 }finally{
  child.kill();
  await new Promise(resolve=>child.once('exit',resolve));
  for(const suffix of ['','-wal','-shm'])if(existsSync(path+suffix))unlinkSync(path+suffix);
 }
});
