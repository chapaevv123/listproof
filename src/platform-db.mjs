import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

const ddl=[
 'CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, disabled_at TEXT)',
 "CREATE TABLE IF NOT EXISTS memberships (org_id TEXT NOT NULL REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('owner','analyst','auditor')), created_at TEXT NOT NULL, PRIMARY KEY(org_id,user_id))",
 'CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), org_id TEXT NOT NULL REFERENCES organizations(id), csrf_hash TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)',
 "CREATE TABLE IF NOT EXISTS dataset_versions (id TEXT PRIMARY KEY, org_id TEXT REFERENCES organizations(id), dataset_id TEXT NOT NULL, epoch INTEGER NOT NULL CHECK(epoch>0), classification TEXT NOT NULL CHECK(classification IN ('synthetic','imported-unverified','verified-source')), provenance TEXT NOT NULL, source_ref TEXT, source_retrieved_at TEXT, imported_at TEXT NOT NULL, chain_id TEXT NOT NULL, root TEXT NOT NULL, content_hash TEXT NOT NULL, address_count INTEGER NOT NULL CHECK(address_count>0), canonical_json TEXT NOT NULL, approval_status TEXT NOT NULL CHECK(approval_status IN ('draft','approved')), publication_status TEXT NOT NULL CHECK(publication_status IN ('local','published')), UNIQUE(org_id,dataset_id,epoch))",
 "CREATE TABLE IF NOT EXISTS import_jobs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), actor_id TEXT NOT NULL REFERENCES users(id), dataset_version_id TEXT REFERENCES dataset_versions(id), status TEXT NOT NULL CHECK(status IN ('validated','rejected')), duplicate_count INTEGER NOT NULL, error TEXT, created_at TEXT NOT NULL)",
 "CREATE TABLE IF NOT EXISTS screenings (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), actor_id TEXT NOT NULL REFERENCES users(id), dataset_version_id TEXT REFERENCES dataset_versions(id), address TEXT NOT NULL, result TEXT NOT NULL, receipt_json TEXT, initial_verification_json TEXT, latest_verification_json TEXT, created_at TEXT NOT NULL, idempotency_key TEXT, UNIQUE(org_id,idempotency_key))",
 "CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id), screening_id TEXT NOT NULL UNIQUE REFERENCES screenings(id), assigned_to TEXT REFERENCES users(id), status TEXT NOT NULL CHECK(status IN ('Open','Under Review','Evidence Verified','Evidence Rejected','Closed')), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
 'CREATE TABLE IF NOT EXISTS case_notes (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), actor_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS case_events (id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id), sequence INTEGER NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, previous_state TEXT, new_state TEXT, evidence_ref TEXT, created_at TEXT NOT NULL, prev_hash TEXT NOT NULL, event_hash TEXT NOT NULL, UNIQUE(case_id,sequence))',
 'CREATE TABLE IF NOT EXISTS cre_audits (id TEXT PRIMARY KEY, org_id TEXT REFERENCES organizations(id), dataset_version_id TEXT REFERENCES dataset_versions(id), evidence_class TEXT NOT NULL, log_sha256 TEXT NOT NULL, report_json TEXT NOT NULL, observed_at TEXT, created_at TEXT NOT NULL)',
 'CREATE INDEX IF NOT EXISTS idx_cases_org_status_date ON cases(org_id,status,created_at)',
 'CREATE INDEX IF NOT EXISTS idx_events_case_date ON case_events(case_id,sequence)',
 'CREATE INDEX IF NOT EXISTS idx_screenings_org_date ON screenings(org_id,created_at)',
 'CREATE INDEX IF NOT EXISTS idx_versions_org_dataset ON dataset_versions(org_id,dataset_id,epoch)'
];
const demoDdl=[
 'CREATE TABLE IF NOT EXISTS demo_workspaces (org_id TEXT PRIMARY KEY REFERENCES organizations(id), user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, screenings INTEGER NOT NULL DEFAULT 0, cases INTEGER NOT NULL DEFAULT 0, notes INTEGER NOT NULL DEFAULT 0, events INTEGER NOT NULL DEFAULT 0)',
 'CREATE INDEX IF NOT EXISTS idx_demo_workspaces_created ON demo_workspaces(created_at)'
];
const convert=(sql)=>{let i=0;return sql.replace(/\?/g,()=>'$'+(++i));};
export async function openPlatformDb(options={}){
 const databaseUrl=options.databaseUrl??process.env.DATABASE_URL;
 const sqlitePath=options.sqlitePath??process.env.LISTPROOF_DB_PATH;
 const migrate=options.migrate??true;
 if(!databaseUrl&&!sqlitePath)throw Error('A durable database path or DATABASE_URL is required');
 if(process.env.NODE_ENV==='production'&&!databaseUrl)throw Error('Production private workspace requires DATABASE_URL; local SQLite paths are not durable on ephemeral hosting');
 let db;
 if(databaseUrl){
  const {Pool}=await import('pg');
  const sslMode=process.env.LISTPROOF_DB_SSL||'verify';
  if(!['verify','disable'].includes(sslMode))throw Error('LISTPROOF_DB_SSL must be verify or disable');
  const connectionUrl=new URL(databaseUrl);
  connectionUrl.searchParams.set('sslmode',sslMode==='verify'?'verify-full':'disable');
  const pool=new Pool({connectionString:connectionUrl.toString(),max:5,connectionTimeoutMillis:5000});
  pool.on('error',error=>console.error('ListProof PostgreSQL idle connection lost: '+(error.code||'unknown')));
  const query=(client,sql,params=[])=>client.query(convert(sql),params).then(x=>x.rows);
  db={kind:'postgres',query:(sql,params)=>query(pool,sql,params),transaction:async fn=>{const client=await pool.connect();try{await client.query('BEGIN');const result=await fn({kind:'postgres',query:(sql,params)=>query(client,sql,params)});await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},close:()=>pool.end()};
 }else{
  if(sqlitePath!==':memory:')mkdirSync(dirname(sqlitePath),{recursive:true});
  const connection=new DatabaseSync(sqlitePath,{timeout:5000});
  connection.exec('PRAGMA foreign_keys=ON');connection.exec('PRAGMA busy_timeout=5000');if(sqlitePath!==':memory:')connection.exec('PRAGMA journal_mode=WAL');
  const query=(sql,params=[])=>{const statement=connection.prepare(sql);return /^\s*(SELECT|WITH|PRAGMA)/i.test(sql)?statement.all(...params):(statement.run(...params),[]);};
  db={kind:'sqlite',query:async(sql,params)=>query(sql,params),transaction:async fn=>{connection.exec('BEGIN IMMEDIATE');try{const result=await fn({kind:'sqlite',query:async(sql,params)=>query(sql,params)});connection.exec('COMMIT');return result;}catch(error){connection.exec('ROLLBACK');throw error;}},close:async()=>connection.close()};
 }
 try{
  if(migrate)await db.transaction(async tx=>{
   if(tx.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(1279877434)');
   await tx.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
   const applied=await tx.query('SELECT version FROM schema_migrations WHERE version=?',[1]);
   if(!applied.length){for(const sql of ddl)await tx.query(sql);await tx.query('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)',[1,new Date().toISOString()]);}
   const demoApplied=await tx.query('SELECT version FROM schema_migrations WHERE version=?',[2]);
   if(!demoApplied.length){for(const sql of demoDdl)await tx.query(sql);await tx.query('INSERT INTO schema_migrations(version,applied_at) VALUES(?,?)',[2,new Date().toISOString()]);}
  });
  else{
   const metadata=await db.query(db.kind==='postgres'?"SELECT to_regclass('schema_migrations') AS name":"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'");
   if(!metadata[0]?.name)throw Error('Platform database has no migration metadata; run migrate:platform');
  }
  const versions=await db.query('SELECT version FROM schema_migrations ORDER BY version');
  if(versions.length!==2||versions[0].version!==1||versions[1].version!==2)throw Error('Unsupported or missing platform database migration; run migrate:platform');
 }catch(error){await db.close();throw error;}
 return db;
}
