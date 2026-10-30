import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const freePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))});s.on('error',reject)});
test('HTTP adapter and complete proof scenarios',async()=>{
 const port=await freePort();const child=spawn(process.execPath,['scripts/server.mjs'],{env:{...process.env,LISTPROOF_PORT:String(port)},stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/state`);if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,40))}assert.ok(ready,'server started');
  const base=`http://127.0.0.1:${port}`;
  const health=await(await fetch(base+'/api/health')).json();assert.equal(health.localProofOnly,true);assert.equal(health.sepoliaContractsPublished,true);
  const html=await(await fetch(base+'/')).text();assert.match(html,/<script type="module" src="\/app\.js"><\/script>/);
  const demo=await(await fetch(base+'/demo')).text();assert.match(demo,/<script type="module" src="\/app\.js"><\/script>/);
  const app=await fetch(base+'/app.js');assert.equal(app.status,200);assert.match(await app.text(),/independentVerification/);
  const style=await fetch(base+'/styles.css');assert.equal(style.status,200);assert.match(await style.text(),/#375bd2/i);
  const caseModule=await fetch(base+'/cases.js');assert.equal(caseModule.status,200);assert.match(await caseModule.text(),/class CaseStore/);
  const creAudit=await fetch(base+'/evidence/cre-onchain-settings.txt');assert.equal(creAudit.status,200);assert.match(await creAudit.text(),/read-only registry check; no transaction sent/);
  const dataset=await(await fetch(base+'/dataset/1')).json();assert.equal(dataset.schema,'listproof-addresses-v1');
  const sepolia=await(await fetch(base+'/api/sepolia')).json();
  assert.equal(sepolia.chainId,11155111);
  assert.equal(sepolia.epoch,1);
  assert.equal(sepolia.root,'0xd5a80d20b41a1049e2a75edbc04761063113ea3002b8f575c4993284b8ab5888');
  assert.equal(sepolia.rootPublication.transactionHash,'0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d');
  assert.ok(['not-run','verified-read-only'].includes(sepolia.proofCheck.status));
  const datasets=await(await fetch(base+'/api/v1/datasets')).json();assert.equal(datasets.length,2);assert.equal(datasets[0].classification,'synthetic');assert.equal(datasets[0].registryPublished,true);assert.equal(datasets[1].registryPublished,false);
  const cre=await(await fetch(base+'/api/v1/cre/evidence')).json();assert.equal(cre.class,'OFFICIAL_CRE_SIMULATION');assert.equal(cre.liveDonExecution,false);assert.equal(cre.root,sepolia.root);
  const ask=async(address,mode)=>{const r=await fetch(base+'/api/proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,epoch:1,mode})});assert.equal(r.status,200);return await r.json()};
  const a=n=>'0x'+n.toString(16).padStart(40,'0');
  const clean=await ask(a(6),'clean');assert.equal(clean.status,'verified');assert.equal(clean.receipt.verified,true);
  const versioned=await fetch(base+'/api/v1/screenings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:a(6),epoch:1,mode:'clean'})});assert.equal((await versioned.json()).status,'verified');
  assert.equal((await ask(a(5),'listed')).status,'listed');
  assert.equal((await ask(a(6),'stale')).status,'rejected');assert.equal((await ask(a(6),'tampered')).status,'rejected');
  const independently=await fetch(base+'/api/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proof:clean.proof,againstEpoch:1})});
  assert.equal((await independently.json()).verified,true);
  const stale=await fetch(base+'/api/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proof:clean.proof,againstEpoch:2})});
  assert.equal((await stale.json()).verified,false);
  const tampered=structuredClone(clean.proof);tampered.target=a(5);
  const rejected=await fetch(base+'/api/v1/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proof:tampered,againstEpoch:1})});assert.equal((await rejected.json()).verified,false);
  const invalid=await fetch(base+'/api/v1/screenings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:a(6),epoch:1,mode:'unknown'})});assert.equal(invalid.status,400);
  for(const path of ['/deploy.html','/deploy.js','/api/publication/epoch-1','/api/evidence'])assert.equal((await fetch(base+path)).status,404);
  assert.equal((await fetch(base+'/api/health')).headers.get('access-control-allow-origin'),null);
 }finally{child.kill()}
});
test('public API rate limit and Registry RPC failure are explicit',async()=>{
 const port=await freePort();const child=spawn(process.execPath,['scripts/server.mjs'],{env:{...process.env,LISTPROOF_PORT:String(port),LISTPROOF_RATE_LIMIT:'4',LISTPROOF_SEPOLIA_RPC_URL:'https://127.0.0.1:1'},stdio:'ignore'});
 try{
  const base=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<50;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,40))}assert.ok(ready);
  const status=await(await fetch(base+'/api/v1/registry/status')).json();assert.equal(status.status,'unavailable');assert.match(status.reason,/fetch failed|RPC/);
  await fetch(base+'/api/health');await fetch(base+'/api/health');
  const limited=await fetch(base+'/api/health');assert.equal(limited.status,429);assert.equal((await limited.json()).code,'RATE_LIMIT');
 }finally{child.kill()}
});
