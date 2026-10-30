import test from 'node:test';
import assert from 'node:assert/strict';
import {CaseStore,CASE_STATUSES,STORAGE_KEY} from '../web/cases.js';
const address='0x'+'06'.padStart(40,'0'),root='0x'+'ab'.repeat(32);
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),m};};
test('browser case workspace persists records and appends original audit events',()=>{
 const storage=memory();let n=0;const now=()=>new Date(1700000000000+n++*1000).toISOString();const id=()=>String(n).padStart(16,'0');
 const store=new CaseStore(storage,now,id);
 const item=store.create({address,datasetId:'listproof-synthetic-demo',epoch:1,root,result:'not-present',receipt:{kind:'listproof-local-proof-v1'},verification:{verified:true,epoch:1,root}});
 assert.equal(store.list().length,1);
 assert.equal(JSON.parse(storage.getItem(STORAGE_KEY))[0].id,item.id);
 store.status(item.id,'Under Review');store.note(item.id,'Check the source policy');store.reverification(item.id,{verified:false,epoch:2,root});
 const saved=new CaseStore(storage).get(item.id);
 assert.equal(saved.status,'Under Review');assert.equal(saved.notes[0].text,'Check the source policy');
 assert.equal(saved.initialVerification.verified,true);assert.equal(saved.latestVerification.verified,false);
 assert.deepEqual(saved.events.map(x=>x.type),['CASE_CREATED','STATUS_CHANGED','NOTE_ADDED','EVIDENCE_REVERIFIED']);
 assert.equal(saved.events[0].at,item.createdAt);
 store.status(item.id,'Open');assert.equal(store.get(item.id).status,'Open');
});
test('case workspace rejects invalid input, status and notes',()=>{
 const store=new CaseStore(memory(),()=>new Date().toISOString(),()=>crypto.randomUUID());
 assert.throws(()=>store.create({address:'bad',datasetId:'x',epoch:1,root,result:'not-present'}));
 const item=store.create({address,datasetId:'x',epoch:1,root,result:'listed'});
 assert.throws(()=>store.status(item.id,'Approved'));
 assert.throws(()=>store.status(item.id,'Evidence Verified'),/Reverify a valid proof/);
 assert.throws(()=>store.note(item.id,'  '));
 assert.throws(()=>store.note(item.id,'a'.repeat(2001)));
 assert.ok(CASE_STATUSES.includes('Evidence Rejected'));
});
test('corrupt case storage is reported and never silently replaced',()=>{
 const storage=memory();storage.setItem(STORAGE_KEY,'{broken');
 const store=new CaseStore(storage);
 assert.throws(()=>store.list());
 assert.equal(storage.getItem(STORAGE_KEY),'{broken');
});
