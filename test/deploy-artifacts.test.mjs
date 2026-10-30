import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {server,DATASET_ID,ACCOUNT} from '../scripts/deploy-server.mjs';

test('deployment dataset ID and required wallet match source',()=>{
 const id='0x'+createHash('sha256').update('listproof-synthetic-demo').digest('hex');
 assert.equal(DATASET_ID,id);
 assert.equal(ACCOUNT.toLowerCase(),'0x765fb7e6a0bdddc29f57eece34aeda0fb318805d');
 const script=readFileSync(new URL('../script/DeploySynthetic.s.sol',import.meta.url),'utf8');
 assert.match(script,new RegExp(`bytes32 constant ID\\s*=\\s*${id}`,'i'));
});

test('pinned Sepolia constructor artifacts and compiler settings',t=>{
 if(!existsSync(new URL('../out/ListProof.sol/ListProofRegistry.json',import.meta.url))){t.skip('Run forge build to generate ignored artifacts');return;}
 for(const [name,inputs] of [['ListProofRegistry',['bytes32','address']],['ListProofGate',['address']]]){
  const a=JSON.parse(readFileSync(new URL(`../out/ListProof.sol/${name}.json`,import.meta.url)));
  assert.equal(a.metadata.compiler.version,'0.8.24+commit.e11b9ed9');
  assert.deepEqual(a.metadata.settings.optimizer,{enabled:true,runs:200});
  assert.equal(a.metadata.settings.viaIR,true);
  assert.deepEqual(a.abi.find(x=>x.type==='constructor').inputs.map(x=>x.type),inputs);
  assert.match(a.bytecode.object,/^0x[0-9a-f]+$/);
 }
});

test('local deployment page exposes no transaction or evidence on first load',async()=>{
 const evidence=new URL('../evidence/sepolia-deployments.json',import.meta.url);
 const existedBefore=existsSync(evidence);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const port=server.address().port,base=`http://127.0.0.1:${port}`;
  const [page,config]=await Promise.all([fetch(base+'/'),fetch(base+'/api/config')]);
  assert.equal(page.status,200);assert.match(await page.text(),/Confirm Gate deployment/);
  assert.equal(config.status,200);assert.equal((await config.json()).chainId,11155111);
  const forged=await fetch(base+'/api/evidence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contract:'ListProofRegistry',transactionHash:'0x'+'0'.repeat(64)})});
  assert.equal(forged.status,403,'cross-origin evidence writes are rejected');
  const rootWrite=await fetch(base+'/api/publication/epoch-1',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({transactionHash:'0x'+'0'.repeat(64)})});
  assert.equal(rootWrite.status,403,'cross-origin root evidence writes are rejected');
  assert.equal(existsSync(evidence),existedBefore);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
