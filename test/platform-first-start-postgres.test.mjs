import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {Pool} from 'pg';
import {openPlatformDb} from '../src/platform-db.mjs';
import {createPlatformStore} from '../src/platform-store.mjs';

const password='correct horse battery staple';
const tables=['schema_migrations','organizations','users','memberships','sessions','dataset_versions','import_jobs','screenings','cases','case_notes','case_events','cre_audits','demo_workspaces'];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const port=()=>new Promise((resolve,reject)=>{const socket=createServer();socket.on('error',reject);socket.listen(0,'127.0.0.1',()=>{const value=socket.address().port;socket.close(()=>resolve(value));});});

test('empty PostgreSQL production startup migrates, bootstraps, persists data and fails closed',
 {skip:!process.env.LISTPROOF_TEST_DATABASE_URL,timeout:60000},async()=>{
  const admin=new Pool({connectionString:process.env.LISTPROOF_TEST_DATABASE_URL,ssl:false});
  const schema='lp_first_'+randomUUID().replaceAll('-','');
  const broken='lp_broken_'+randomUUID().replaceAll('-','');
  const scoped=name=>{const url=new URL(process.env.LISTPROOF_TEST_DATABASE_URL);url.searchParams.set('options',`-c search_path=${name}`);return url.toString();};
  const email=`owner-${schema}@example.test`,orgSlug=`org-${schema.slice(-12)}`;
  const makeServer=(url,listenPort,owner=true)=>spawn(process.execPath,['scripts/server.mjs'],{
   env:{...process.env,DATABASE_URL:url,LISTPROOF_DB_SSL:'disable',LISTPROOF_REQUIRE_DATABASE:'1',NODE_ENV:'production',LISTPROOF_PORT:String(listenPort),LISTPROOF_HOST:'127.0.0.1',LISTPROOF_OWNER_EMAIL:owner?email:'',LISTPROOF_OWNER_PASSWORD:owner?password:'',LISTPROOF_ORG_SLUG:orgSlug},stdio:'ignore'});
  const healthy=async listenPort=>{for(let i=0;i<120;i++){try{const response=await fetch(`http://127.0.0.1:${listenPort}/api/health`);if(response.status===200)return await response.json();}catch{}await pause(50);}throw Error('Production server did not become healthy');};
  const stop=async child=>{if(child.exitCode===null&&child.signalCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});};
  const children=[];
  try{
   await admin.query(`CREATE SCHEMA "${schema}"`);
   await admin.query(`CREATE SCHEMA "${broken}"`);
   const url=scoped(schema),ports=await Promise.all([port(),port()]);
   await assert.rejects(openPlatformDb({databaseUrl:url,migrate:false}),/no migration metadata/);
   const first=makeServer(url,ports[0]),concurrent=makeServer(url,ports[1]);children.push(first,concurrent);
   assert.equal((await healthy(ports[0])).caseStorage,'postgres');
   assert.equal((await healthy(ports[1])).privateWorkspaceEnabled,true);
   const db=await openPlatformDb({databaseUrl:url,migrate:false});
   let caseId;
   try{
    const found=await db.query("SELECT tablename FROM pg_tables WHERE schemaname=?",[schema]);
    assert.deepEqual(tables.filter(name=>!found.some(row=>row.tablename===name)),[]);
    assert.deepEqual((await db.query('SELECT version FROM schema_migrations ORDER BY version')).map(row=>row.version),[1,2]);
    const owners=await db.query("SELECT u.id user_id,o.id org_id FROM users u JOIN memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.org_id WHERE u.email=? AND o.slug=? AND m.role='owner'",[email,orgSlug]);
    assert.equal(owners.length,1);
    const actor={userId:owners[0].user_id,orgId:owners[0].org_id,role:'owner'};
    const store=createPlatformStore(db);
    const screened=await store.screening(actor,{address:'0x0000000000000000000000000000000000000006',datasetVersionId:'synthetic-epoch-1'});
    const saved=await store.createCase(actor,{screeningId:screened.id});caseId=saved.id;
    await store.note(actor,caseId,'Survives second startup');
   }finally{await db.close();}
   await Promise.all(children.map(stop));
   const again=makeServer(url,ports[0]);children.push(again);await healthy(ports[0]);
   const reopened=await openPlatformDb({databaseUrl:url,migrate:false});
   try{
    assert.equal((await reopened.query('SELECT id FROM users')).length,1);
    const result=await reopened.query('SELECT body FROM case_notes WHERE case_id=?',[caseId]);
    assert.equal(result[0].body,'Survives second startup');
    assert.equal((await reopened.query('SELECT id FROM case_events WHERE case_id=?',[caseId])).length,2);
   }finally{await reopened.close();}
   await stop(again);
   await admin.query(`CREATE VIEW "${broken}".organizations AS SELECT 'placeholder'::text AS id`);
   const badPort=await port(),bad=makeServer(scoped(broken),badPort);children.push(bad);
   await Promise.race([new Promise(resolve=>bad.once('exit',resolve)),pause(5000).then(()=>{throw Error('Broken migration did not stop startup');})]);
   await assert.rejects(fetch(`http://127.0.0.1:${badPort}/api/health`));
   const metadata=await admin.query('SELECT to_regclass($1) AS table_name',[`${broken}.schema_migrations`]);
   assert.equal(metadata.rows[0].table_name,null);
  }finally{
   await Promise.all(children.map(stop));
   await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
   await admin.query(`DROP SCHEMA IF EXISTS "${broken}" CASCADE`);
   await admin.end();
  }
 });
