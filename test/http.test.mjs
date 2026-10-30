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
  const html=await(await fetch(base+'/')).text();assert.match(html,/<script src="\/app\.js"><\/script>/);
  const app=await fetch(base+'/app.js');assert.equal(app.status,200);assert.match(await app.text(),/independentVerification/);
  const dataset=await(await fetch(base+'/dataset/1')).json();assert.equal(dataset.schema,'listproof-addresses-v1');
  const sepolia=await(await fetch(base+'/api/sepolia')).json();
  assert.equal(sepolia.chainId,11155111);
  assert.equal(sepolia.epoch,1);
  assert.equal(sepolia.root,'0xd5a80d20b41a1049e2a75edbc04761063113ea3002b8f575c4993284b8ab5888');
  assert.equal(sepolia.rootPublication.transactionHash,'0x824c1f5a44aff746f8737b9e97d6e92d5e42a23a69d4627b6a8fe7de8e7d478d');
  assert.ok(['not-run','verified-read-only'].includes(sepolia.proofCheck.status));
  const ask=async(address,mode)=>{const r=await fetch(base+'/api/proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address,epoch:1,mode})});assert.equal(r.status,200);return await r.json()};
  const a=n=>'0x'+n.toString(16).padStart(40,'0');
  const clean=await ask(a(6),'clean');assert.equal(clean.status,'verified');assert.equal(clean.receipt.verified,true);
  assert.equal((await ask(a(5),'listed')).status,'listed');
  assert.equal((await ask(a(6),'stale')).status,'rejected');assert.equal((await ask(a(6),'tampered')).status,'rejected');
  const independently=await fetch(base+'/api/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proof:clean.proof,againstEpoch:1})});
  assert.equal((await independently.json()).verified,true);
  const stale=await fetch(base+'/api/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proof:clean.proof,againstEpoch:2})});
  assert.equal((await stale.json()).verified,false);
 }finally{child.kill()}
});
