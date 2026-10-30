import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {Pool} from 'pg';
import {openPlatformDb} from '../src/platform-db.mjs';
import {bootstrapOwner,login,sessionFromRequest,passwordHash} from '../src/platform-auth.mjs';
import {createPlatformStore,ensureSyntheticVersions} from '../src/platform-store.mjs';

test('PostgreSQL migration, auth, case persistence across connections and workspace isolation',
 {skip:!process.env.LISTPROOF_TEST_DATABASE_URL},async()=>{
  const admin=new Pool({connectionString:process.env.LISTPROOF_TEST_DATABASE_URL,ssl:false});
  const schema='lp_existing_'+randomUUID().replaceAll('-','');
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const scoped=new URL(process.env.LISTPROOF_TEST_DATABASE_URL);
  scoped.searchParams.set('options',`-c search_path=${schema}`);
  const url=scoped.toString();
  try{
  const id=randomUUID().slice(0,8);
  const [firstConnection,secondConnection]=await Promise.all([openPlatformDb({databaseUrl:url,migrate:true}),openPlatformDb({databaseUrl:url,migrate:true})]);
  await secondConnection.close();let db=firstConnection;
  const owner=await bootstrapOwner(db,{email:`owner-${id}@example.test`,password:'correct horse battery staple',orgSlug:`org-${id}`,orgName:'Postgres test'});
  await ensureSyntheticVersions(db);
  const actor={userId:owner.userId,orgId:owner.orgId,role:'owner'};
  const store=createPlatformStore(db);
  const address='0x0000000000000000000000000000000000000006';
  const screened=await store.screening(actor,{address,datasetVersionId:'synthetic-epoch-1'});
  const saved=await store.createCase(actor,{screeningId:screened.id});
  await store.note(actor,saved.id,'PostgreSQL persisted note');
  await store.status(actor,saved.id,'Under Review');
  const otherOrg=randomUUID(),otherUser=randomUUID(),at=new Date().toISOString();
  await db.query('INSERT INTO organizations(id,slug,name,created_at) VALUES(?,?,?,?)',[otherOrg,`other-${id}`,'Other',at]);
  await db.query('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)',[otherUser,`other-${id}@example.test`,await passwordHash('correct horse battery staple'),at]);
  await db.query('INSERT INTO memberships(org_id,user_id,role,created_at) VALUES(?,?,?,?)',[otherOrg,otherUser,'owner',at]);
  const signed=await login(db,{email:`owner-${id}@example.test`,password:'correct horse battery staple',orgSlug:`org-${id}`,remoteAddress:'127.0.0.1'});
  assert.equal((await sessionFromRequest(db,{headers:{cookie:'lp_session='+signed.token}})).orgId,owner.orgId);
  await db.close();
  db=await openPlatformDb({databaseUrl:url,migrate:false});
  try{
   const reopened=await createPlatformStore(db).case(actor,saved.id);
   assert.equal(reopened.screening.address,address);
   assert.equal(reopened.notes[0].body,'PostgreSQL persisted note');
   assert.equal(reopened.status,'Under Review');
   assert.equal(reopened.auditChainValid,true);
   await assert.rejects(createPlatformStore(db).case({...actor,orgId:randomUUID()},saved.id),/Case not found/);
  }finally{await db.close();}
  const port=await new Promise((resolve,reject)=>{const socket=createServer();socket.listen(0,'127.0.0.1',()=>{const value=socket.address().port;socket.close(()=>resolve(value));});socket.on('error',reject);});
  const base='http://127.0.0.1:'+port;
  const start=()=>spawn(process.execPath,['scripts/server.mjs'],{env:{...process.env,DATABASE_URL:url,LISTPROOF_DB_SSL:'disable',LISTPROOF_REQUIRE_DATABASE:'1',NODE_ENV:'production',LISTPROOF_PORT:String(port),LISTPROOF_HOST:'127.0.0.1'},stdio:'ignore'});
  let server=start();
  const ready=async()=>{for(let i=0;i<100;i++){try{const response=await fetch(base+'/api/health');if(response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Production PostgreSQL server did not become healthy');};
  const signIn=async(email,orgSlug)=>{const response=await fetch(base+'/api/v2/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'correct horse battery staple',orgSlug})});assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Secure/);return {cookie:response.headers.get('set-cookie').split(';')[0],body:await response.json()};};
  try{
   await ready();
   const first=await signIn(`owner-${id}@example.test`,`org-${id}`);
   assert.equal((await fetch(base+'/api/v2/cases/'+saved.id,{headers:{cookie:first.cookie}})).status,200);
   assert.equal((await fetch(base+'/api/v2/logout',{method:'POST',headers:{cookie:first.cookie,'x-csrf-token':first.body.csrf,'content-type':'application/json'},body:'{}'})).status,200);
   server.kill();await new Promise(resolve=>server.once('exit',resolve));server=start();await ready();
   const second=await signIn(`owner-${id}@example.test`,`org-${id}`);
   const caseResponse=await fetch(base+'/api/v2/cases/'+saved.id,{headers:{cookie:second.cookie}});assert.equal(caseResponse.status,200);
   const persisted=await caseResponse.json();assert.equal(persisted.status,'Under Review');assert.equal(persisted.auditChainValid,true);
   const verify=await fetch(base+'/api/v2/cases/'+saved.id+'/reverify',{method:'POST',headers:{cookie:second.cookie,'x-csrf-token':second.body.csrf,'content-type':'application/json'},body:'{}'});assert.equal(verify.status,200);assert.equal((await verify.json()).screening.latestVerification.verified,true);
   const foreign=await signIn(`other-${id}@example.test`,`other-${id}`);
   assert.equal((await fetch(base+'/api/v2/cases/'+saved.id,{headers:{cookie:foreign.cookie}})).status,404);
  }finally{server.kill();if(server.exitCode===null&&server.signalCode===null)await new Promise(resolve=>server.once('exit',resolve));}
  }finally{await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}
 });
