import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {unlinkSync,existsSync} from 'node:fs';
import {openPlatformDb} from '../src/platform-db.mjs';
import {bootstrapOwner,addUser,login,sessionFromRequest,validCsrf,logout} from '../src/platform-auth.mjs';
import {createPlatformStore,ensureSyntheticVersions,verifyAuditEvents} from '../src/platform-store.mjs';
const password='correct horse battery staple';
const a=n=>'0x'+n.toString(16).padStart(40,'0');
async function fixture(path=':memory:'){
 const db=await openPlatformDb({sqlitePath:path});await ensureSyntheticVersions(db);
 const owner=await bootstrapOwner(db,{email:'owner@example.test',password,orgSlug:'alpha-org',orgName:'Alpha'});
 return {db,owner,actor:{userId:owner.userId,orgId:owner.orgId,role:'owner'},store:createPlatformStore(db)};
}
test('migration, durable SQLite restart, foreign keys and owner bootstrap guard',async()=>{
 const path=join(tmpdir(),'listproof-v4-'+randomUUID()+'.sqlite');
 let db;
 try{
  const f=await fixture(path);db=f.db;
  const screened=await f.store.screening(f.actor,{address:a(6),datasetVersionId:'synthetic-epoch-1'});
  const saved=await f.store.createCase(f.actor,{screeningId:screened.id});
  assert.equal(saved.status,'Open');await db.close();db=null;
  db=await openPlatformDb({sqlitePath:path});
  const reopened=await createPlatformStore(db).case(f.actor,saved.id);
  assert.equal(reopened.screening.address,a(6));assert.equal(reopened.auditChainValid,true);
  assert.deepEqual((await db.query('SELECT version FROM schema_migrations ORDER BY version')).map(x=>x.version),[1,2]);
  await assert.rejects(bootstrapOwner(db,{email:'other@example.test',password,orgSlug:'other-org',orgName:'Other'}),/already exists/);
  await assert.rejects(db.query('INSERT INTO cases(id,org_id,screening_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)',['bad','missing','missing','Open','x','x']));
 }finally{if(db)await db.close();for(const suffix of ['','-wal','-shm'])if(existsSync(path+suffix))unlinkSync(path+suffix);}
});
test('authentication, CSRF, logout and role-scoped private records',async()=>{
 const f=await fixture();
 try{
  await addUser(f.db,{actor:f.actor,orgId:f.owner.orgId,email:'analyst@example.test',password,role:'analyst'});
  await addUser(f.db,{actor:f.actor,orgId:f.owner.orgId,email:'auditor@example.test',password,role:'auditor'});
  await assert.rejects(login(f.db,{email:'owner@example.test',password:'incorrect',orgSlug:'alpha-org'}),/Invalid credentials/);
  const signed=await login(f.db,{email:'owner@example.test',password,orgSlug:'alpha-org'});
  const session=await sessionFromRequest(f.db,{headers:{cookie:'lp_session='+signed.token}});
  assert.equal(session.role,'owner');assert.equal(validCsrf(session,signed.csrf),true);assert.equal(validCsrf(session,'0'.repeat(64)),false);
  await logout(f.db,session);assert.equal(await sessionFromRequest(f.db,{headers:{cookie:'lp_session='+signed.token}}),null);
  const otherOrg=randomUUID();
  await f.db.query('INSERT INTO organizations(id,slug,name,created_at) VALUES(?,?,?,?)',[otherOrg,'other-org','Other',new Date().toISOString()]);
  const screened=await f.store.screening(f.actor,{address:a(6),datasetVersionId:'synthetic-epoch-1'}),item=await f.store.createCase(f.actor,{screeningId:screened.id});
  await assert.rejects(f.store.case({...f.actor,orgId:otherOrg},item.id),/Case not found/);
  const auditor=(await f.db.query('SELECT id FROM users WHERE email=?',['auditor@example.test']))[0];
  await assert.rejects(f.store.screening({userId:auditor.id,orgId:f.owner.orgId,role:'auditor'},{address:a(6),datasetVersionId:'synthetic-epoch-1'}),/Read-only role/);
 }finally{await f.db.close();}
});
test('case status, audit hash chain, notes and idempotent screening',async()=>{
 const f=await fixture();
 try{
  const first=await f.store.screening(f.actor,{address:a(6),datasetVersionId:'synthetic-epoch-1',idempotencyKey:'request-key-123'});
  const repeated=await f.store.screening(f.actor,{address:a(6),datasetVersionId:'synthetic-epoch-1',idempotencyKey:'request-key-123'});
  assert.equal(repeated.id,first.id);
  await assert.rejects(f.store.screening(f.actor,{address:a(7),datasetVersionId:'synthetic-epoch-1',idempotencyKey:'request-key-123'}),/Idempotency key reused/);
  const item=await f.store.createCase(f.actor,{screeningId:first.id});
  await f.store.status(f.actor,item.id,'Evidence Verified');
  await f.store.note(f.actor,item.id,'Independent review requested');
  await f.store.reverify(f.actor,item.id);
  const detail=await f.store.case(f.actor,item.id);
  assert.equal(detail.status,'Evidence Verified');assert.equal(detail.events.length,4);assert.equal(detail.auditChainValid,true);
  await f.db.query('UPDATE case_events SET new_state=? WHERE case_id=? AND sequence=?',['forged',item.id,2]);
  assert.equal((await f.store.case(f.actor,item.id)).auditChainValid,false);
  assert.equal(verifyAuditEvents(await f.db.query('SELECT * FROM case_events WHERE case_id=? ORDER BY sequence',[item.id])),false);
  const listed=await f.store.screening(f.actor,{address:a(5),datasetVersionId:'synthetic-epoch-1'});
  const listedCase=await f.store.createCase(f.actor,{screeningId:listed.id});
  await assert.rejects(f.store.status(f.actor,listedCase.id,'Evidence Verified'),/Proof does not verify/);
 }finally{await f.db.close();}
});
test('batch has real per-address results and dataset import is isolated and approved',async()=>{
 const f=await fixture();
 try{
  const batch=await f.store.batch(f.actor,{addresses:[a(6),a(5),a(6),'wrong'],datasetVersionId:'synthetic-epoch-1'});
  assert.deepEqual(batch.results.map(x=>x.status),['not-present','listed','duplicate','error']);
  await assert.rejects(f.store.batch(f.actor,{addresses:Array(101).fill(a(6)),datasetVersionId:'synthetic-epoch-1'}),/1–100/);
  const imported=await f.store.importDataset(f.actor,{datasetId:'custom-test',epoch:1,addresses:[a(9),a(3),a(3)],provenance:'Owner-supplied synthetic test source',sourceRef:'manual upload'});
  assert.equal(imported.duplicateCount,1);assert.equal(imported.count,2);assert.equal(imported.classification,'imported-unverified');
  await assert.rejects(f.store.screening(f.actor,{address:a(6),datasetVersionId:imported.id}),/awaits owner approval/);
  await f.store.approveDataset(f.actor,imported.id);
  const screened=await f.store.screening(f.actor,{address:a(6),datasetVersionId:imported.id});
  assert.equal(screened.result,'not-present');
  await assert.rejects(f.store.importDataset({...f.actor,role:'analyst'},{datasetId:'other-test',epoch:1,addresses:[a(1)],provenance:'Synthetic manual import'}),/Owner role required/);
 }finally{await f.db.close();}
});
