import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openPlatformDb} from '../src/platform-db.mjs';
import {bootstrapOwner,login,sessionFromRequest} from '../src/platform-auth.mjs';
import {createPlatformStore,ensureSyntheticVersions} from '../src/platform-store.mjs';

test('PostgreSQL migration, auth, case persistence across connections and workspace isolation',
 {skip:!process.env.LISTPROOF_TEST_DATABASE_URL},async()=>{
  const url=process.env.LISTPROOF_TEST_DATABASE_URL;
  const id=randomUUID().slice(0,8);
  let db=await openPlatformDb({databaseUrl:url});
  const owner=await bootstrapOwner(db,{email:`owner-${id}@example.test`,password:'correct horse battery staple',orgSlug:`org-${id}`,orgName:'Postgres test'});
  await ensureSyntheticVersions(db);
  const actor={userId:owner.userId,orgId:owner.orgId,role:'owner'};
  const store=createPlatformStore(db);
  const address='0x0000000000000000000000000000000000000006';
  const screened=await store.screening(actor,{address,datasetVersionId:'synthetic-epoch-1'});
  const saved=await store.createCase(actor,{screeningId:screened.id});
  await store.note(actor,saved.id,'PostgreSQL persisted note');
  const signed=await login(db,{email:`owner-${id}@example.test`,password:'correct horse battery staple',orgSlug:`org-${id}`,remoteAddress:'127.0.0.1'});
  assert.equal((await sessionFromRequest(db,{headers:{cookie:'lp_session='+signed.token}})).orgId,owner.orgId);
  await db.close();
  db=await openPlatformDb({databaseUrl:url});
  try{
   const reopened=await createPlatformStore(db).case(actor,saved.id);
   assert.equal(reopened.screening.address,address);
   assert.equal(reopened.notes[0].body,'PostgreSQL persisted note');
   assert.equal(reopened.auditChainValid,true);
   await assert.rejects(createPlatformStore(db).case({...actor,orgId:randomUUID()},saved.id),/Case not found/);
  }finally{await db.close();}
 });
