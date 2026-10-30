import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {build,nonmember,normalize,leaf} from './core.mjs';
import {verifyNonMembership} from './verify.mjs';

const sha=value=>'0x'+createHash('sha256').update(value).digest('hex');
const now=()=>new Date().toISOString();
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const parse=value=>value?JSON.parse(value):null;
const statuses=['Open','Under Review','Evidence Verified','Evidence Rejected','Closed'];
const fixed=n=>JSON.parse(readFileSync(new URL('../data/epoch-'+n+'.json',import.meta.url),'utf8'));
const expected=tree=>({...tree.context,root:tree.root,count:tree.addresses.length});
const safeLeaf=(context,address)=>{try{return leaf(context,address);}catch{return null;}};
const versionView=row=>({id:row.id,datasetId:row.dataset_id,epoch:row.epoch,classification:row.classification,provenance:row.provenance,sourceRef:row.source_ref,sourceRetrievedAt:row.source_retrieved_at,importedAt:row.imported_at,chainId:row.chain_id,root:row.root,contentHash:row.content_hash,count:row.address_count,approvalStatus:row.approval_status,publicationStatus:row.publication_status});
const screeningView=row=>({id:row.id,address:row.address,result:row.result,datasetVersionId:row.dataset_version_id,receipt:parse(row.receipt_json),initialVerification:parse(row.initial_verification_json),latestVerification:parse(row.latest_verification_json),createdAt:row.created_at});
const eventBody=e=>({id:e.id,caseId:e.case_id,sequence:e.sequence,actorId:e.actor_id,action:e.action,previousState:e.previous_state,newState:e.new_state,evidenceRef:e.evidence_ref,createdAt:e.created_at,prevHash:e.prev_hash});
const eventHash=e=>sha(JSON.stringify(eventBody(e)));
async function appendEvent(tx,{caseId,actorId,action,previousState=null,newState=null,evidenceRef=null}){
 const prior=(await tx.query('SELECT sequence,event_hash FROM case_events WHERE case_id=? ORDER BY sequence DESC LIMIT 1',[caseId]))[0];
 const event={id:randomUUID(),case_id:caseId,sequence:(prior?.sequence||0)+1,actor_id:actorId,action,previous_state:previousState,new_state:newState,evidence_ref:evidenceRef,created_at:now(),prev_hash:prior?.event_hash||'0x'+'00'.repeat(32)};
 const hash=eventHash(event);
 await tx.query('INSERT INTO case_events(id,case_id,sequence,actor_id,action,previous_state,new_state,evidence_ref,created_at,prev_hash,event_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[event.id,event.case_id,event.sequence,event.actor_id,event.action,event.previous_state,event.new_state,event.evidence_ref,event.created_at,event.prev_hash,hash]);
 return {...eventBody(event),eventHash:hash};
}
export function verifyAuditEvents(events){
 let previous='0x'+'00'.repeat(32);
 for(let i=0;i<events.length;i++){
  const event=events[i];
  if(event.sequence!==i+1||event.prev_hash!==previous||event.event_hash!==eventHash(event))return false;
  previous=event.event_hash;
 }
 return true;
}
export async function ensureSyntheticVersions(db){
 for(const epoch of [1,2]){
  const data=fixed(epoch),tree=build(data),raw=JSON.stringify(data);
  await db.query('INSERT INTO dataset_versions(id,org_id,dataset_id,epoch,classification,provenance,source_ref,source_retrieved_at,imported_at,chain_id,root,content_hash,address_count,canonical_json,approval_status,publication_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',['synthetic-epoch-'+epoch,null,data.datasetId,epoch,'synthetic',data.provenance,null,null,'2026-10-30T00:00:00.000Z',data.chainId,tree.root,sha(raw),tree.addresses.length,raw,'approved',epoch===1?'published':'local']);
 }
}
async function getVersion(db,actor,id){
 const row=(await db.query('SELECT * FROM dataset_versions WHERE id=? AND (org_id=? OR org_id IS NULL)',[id,actor.orgId]))[0];
 if(!row)fail('Dataset version not found',404);
 return row;
}
async function getCaseRow(db,actor,id){
 const row=(await db.query('SELECT c.*,s.address,s.result,s.receipt_json,s.initial_verification_json,s.latest_verification_json,s.dataset_version_id,s.created_at screening_created_at FROM cases c JOIN screenings s ON s.id=c.screening_id WHERE c.id=? AND c.org_id=?',[id,actor.orgId]))[0];
 if(!row)fail('Case not found',404);
 return row;
}
function verifiedReceipt(receipt,version){
 if(!receipt?.proof)return false;
 const tree=build(parse(version.canonical_json)),commitment=receipt.commitment,proof=receipt.proof;
 return commitment?.root===version.root&&commitment?.contentHash===version.content_hash&&commitment?.datasetId===version.dataset_id&&commitment?.epoch===version.epoch&&commitment?.chainId===version.chain_id&&commitment?.count===version.address_count&&proof.root===version.root&&verifyNonMembership(proof,expected(tree));
}
export function createPlatformStore(db){
 return {
  async verifyReceipt(actor,{receipt,datasetVersionId}){
   const version=await getVersion(db,actor,datasetVersionId);
   if(!receipt||typeof receipt!=='object')fail('Receipt required');
   const proof=receipt.proof;
   const verified=Boolean(verifiedReceipt(receipt,version));
   return {verified,datasetVersion:versionView(version),target:proof?.target||null,proofType:proof?.left&&proof?.right?'interior':proof?.left?'upper-boundary':proof?.right?'lower-boundary':'invalid',checks:{receiptCommitment:receipt.commitment?.root===version.root&&receipt.commitment?.contentHash===version.content_hash&&receipt.commitment?.datasetId===version.dataset_id,neighborPaths:proof?verifyNonMembership(proof,expected(build(parse(version.canonical_json)))):false},neighbors:{left:proof?.left?{...proof.left,leafHash:safeLeaf(proof.context,proof.left.address)}:null,right:proof?.right?{...proof.right,leafHash:safeLeaf(proof.context,proof.right.address)}:null},reason:verified?'Authenticated neighbor paths, ordering, adjacency and commitment bindings passed. Absence is limited to this version.':'Witness or commitment binding failed. The receipt verdict was ignored.'};
  },
  async versions(actor){return (await db.query('SELECT * FROM dataset_versions WHERE org_id=? OR org_id IS NULL ORDER BY dataset_id,epoch DESC',[actor.orgId])).map(versionView);},
  async screening(actor,{address,datasetVersionId,idempotencyKey}){
   if(actor.role==='auditor')fail('Read-only role',403);
   const target=normalize(address);
   if(typeof datasetVersionId!=='string'||datasetVersionId.length>100)fail('Invalid dataset version');
   if(idempotencyKey!==undefined&&(typeof idempotencyKey!=='string'||idempotencyKey.length<8||idempotencyKey.length>100))fail('Invalid idempotency key');
   const version=await getVersion(db,actor,datasetVersionId),tree=build(parse(version.canonical_json));
   if(version.approval_status!=='approved')fail('Dataset version awaits owner approval',409);
   if(tree.root!==version.root||tree.addresses.length!==version.address_count||sha(version.canonical_json)!==version.content_hash)fail('Stored dataset commitment mismatch',500);
   let result,receipt=null,verification=null;
   if(tree.addresses.includes(target))result='listed';
   else{
    const proof=nonmember(tree,target),verified=verifyNonMembership(proof,expected(tree));
    if(!verified)fail('Proof engine disagreement',500);
    result='not-present';
    verification={verified,epoch:version.epoch,root:version.root,at:now(),method:'independent-local-verifier'};
    receipt={kind:'listproof-local-proof-v1',commitment:{...tree.context,root:version.root,count:version.address_count,contentHash:version.content_hash},proof,verifiedAgainst:{epoch:version.epoch,root:version.root},verified:true,provenance:version.provenance,chainStatus:'local proof only; no on-chain verification for this result'};
   }
   const id=randomUUID(),createdAt=now();
   try{
    await db.query('INSERT INTO screenings(id,org_id,actor_id,dataset_version_id,address,result,receipt_json,initial_verification_json,latest_verification_json,created_at,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[id,actor.orgId,actor.userId,version.id,target,result,receipt?JSON.stringify(receipt):null,verification?JSON.stringify(verification):null,verification?JSON.stringify(verification):null,createdAt,idempotencyKey||null]);
   }catch(error){
    if(!idempotencyKey)throw error;
    const existing=(await db.query('SELECT * FROM screenings WHERE org_id=? AND idempotency_key=?',[actor.orgId,idempotencyKey]))[0];
    if(!existing||existing.address!==target||existing.dataset_version_id!==version.id)fail('Idempotency key reused with different request',409);
    return screeningView(existing);
   }
   return {id,address:target,result,datasetVersionId:version.id,receipt,initialVerification:verification,latestVerification:verification,createdAt};
  },
  async batch(actor,{addresses,datasetVersionId}){
   if(actor.role==='auditor')fail('Read-only role',403);
   if(!Array.isArray(addresses)||addresses.length<1||addresses.length>100)fail('Batch must contain 1–100 addresses');
   const unique=new Set(),results=[];
   for(const [index,address] of addresses.entries()){
    try{const target=normalize(address);if(unique.has(target)){results.push({index,address:target,status:'duplicate'});continue;}unique.add(target);const screening=await this.screening(actor,{address:target,datasetVersionId});results.push({index,address:target,status:screening.result,screening});}
    catch(error){results.push({index,address:String(address).slice(0,100),status:'error',error:error.message});}
   }
   return {datasetVersionId,total:addresses.length,unique:unique.size,results};
  },
  async createCase(actor,{screeningId,assignedTo}){
   if(actor.role==='auditor')fail('Read-only role',403);
   if(typeof screeningId!=='string')fail('Invalid screening ID');
   return db.transaction(async tx=>{
    const screen=(await tx.query('SELECT * FROM screenings WHERE id=? AND org_id=?',[screeningId,actor.orgId]))[0];
    if(!screen)fail('Screening not found',404);
    const existing=(await tx.query('SELECT id FROM cases WHERE screening_id=? AND org_id=?',[screeningId,actor.orgId]))[0];
    if(existing)return this.case(actor,existing.id);
    if(assignedTo){const member=(await tx.query('SELECT user_id FROM memberships WHERE user_id=? AND org_id=?',[assignedTo,actor.orgId]))[0];if(!member)fail('Reviewer not in workspace',400);}
    const id=randomUUID(),at=now();
    await tx.query('INSERT INTO cases(id,org_id,screening_id,assigned_to,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',[id,actor.orgId,screeningId,assignedTo||null,'Open',at,at]);
    await appendEvent(tx,{caseId:id,actorId:actor.userId,action:'CASE_CREATED',newState:'Open',evidenceRef:screeningId});
    return {id,status:'Open',screeningId,createdAt:at};
   });
  },
  async cases(actor,{status,search,sort}={}){
   if(status&& !statuses.includes(status))fail('Invalid status');
   if(search&&String(search).length>100)fail('Search too long');
   const order=sort==='oldest'?'ASC':'DESC';
   const rows=await db.query('SELECT c.id,c.status,c.created_at,c.updated_at,c.assigned_to,s.address,s.result,s.dataset_version_id FROM cases c JOIN screenings s ON s.id=c.screening_id WHERE c.org_id=? ORDER BY c.created_at '+order,[actor.orgId]);
   return rows.filter(x=>(!status||x.status===status)&&(!search||[x.id,x.address,x.result].some(v=>String(v).toLowerCase().includes(String(search).toLowerCase())))).slice(0,200).map(x=>({id:x.id,status:x.status,createdAt:x.created_at,updatedAt:x.updated_at,assignedTo:x.assigned_to,address:x.address,result:x.result,datasetVersionId:x.dataset_version_id}));
  },
  async case(actor,id){
   const row=await getCaseRow(db,actor,id);
   const version=await getVersion(db,actor,row.dataset_version_id);
   const notes=await db.query('SELECT n.id,n.actor_id,n.body,n.created_at,u.email actor_email FROM case_notes n JOIN users u ON u.id=n.actor_id WHERE n.case_id=? ORDER BY n.created_at,n.id',[id]);
   const events=await db.query('SELECT * FROM case_events WHERE case_id=? ORDER BY sequence',[id]);
   return {id:row.id,status:row.status,assignedTo:row.assigned_to,createdAt:row.created_at,updatedAt:row.updated_at,screening:{id:row.screening_id,address:row.address,result:row.result,receipt:parse(row.receipt_json),initialVerification:parse(row.initial_verification_json),latestVerification:parse(row.latest_verification_json),createdAt:row.screening_created_at},datasetVersion:versionView(version),notes:notes.map(x=>({id:x.id,actorId:x.actor_id,actorEmail:x.actor_email,body:x.body,createdAt:x.created_at})),events:events.map(x=>({...eventBody(x),eventHash:x.event_hash})),auditChainValid:verifyAuditEvents(events)};
  },
  async status(actor,id,next){
   if(actor.role==='auditor')fail('Read-only role',403);
   if(!statuses.includes(next))fail('Invalid status');
   await db.transaction(async tx=>{
    const row=await getCaseRow(tx,actor,id);
    if(next==='Evidence Verified'){const version=await getVersion(tx,actor,row.dataset_version_id);if(!verifiedReceipt(parse(row.receipt_json),version))fail('Proof does not verify against stored commitment',409);}
    if(row.status===next)return;
    await tx.query('UPDATE cases SET status=?,updated_at=? WHERE id=? AND org_id=?',[next,now(),id,actor.orgId]);
    await appendEvent(tx,{caseId:id,actorId:actor.userId,action:'STATUS_CHANGED',previousState:row.status,newState:next,evidenceRef:row.screening_id});
   });
   return this.case(actor,id);
  },
  async note(actor,id,body){
   if(actor.role==='auditor')fail('Read-only role',403);
   if(typeof body!=='string'||!body.trim()||body.length>2000)fail('Note must be 1–2000 characters');
   await db.transaction(async tx=>{
    await getCaseRow(tx,actor,id);
    const noteId=randomUUID(),at=now();
    await tx.query('INSERT INTO case_notes(id,case_id,actor_id,body,created_at) VALUES(?,?,?,?,?)',[noteId,id,actor.userId,body.trim(),at]);
    await appendEvent(tx,{caseId:id,actorId:actor.userId,action:'NOTE_ADDED',newState:noteId,evidenceRef:noteId});
   });
   return this.case(actor,id);
  },
  async reverify(actor,id){
   if(actor.role==='auditor')fail('Read-only role',403);
   await db.transaction(async tx=>{
    const row=await getCaseRow(tx,actor,id),version=await getVersion(tx,actor,row.dataset_version_id);
    const verified=Boolean(verifiedReceipt(parse(row.receipt_json),version));
    const result={verified,epoch:version.epoch,root:version.root,at:now(),method:'independent-local-verifier'};
    await tx.query('UPDATE screenings SET latest_verification_json=? WHERE id=? AND org_id=?',[JSON.stringify(result),row.screening_id,actor.orgId]);
    await appendEvent(tx,{caseId:id,actorId:actor.userId,action:'EVIDENCE_REVERIFIED',newState:verified?'verified':'rejected',evidenceRef:row.screening_id});
   });
   return this.case(actor,id);
  },
  async importDataset(actor,{datasetId,epoch,addresses,provenance,sourceRef,sourceRetrievedAt}){
   if(actor.role!=='owner')fail('Owner role required',403);
   if(typeof datasetId!=='string'||!/^[-a-z0-9]{3,80}$/.test(datasetId)||!Number.isSafeInteger(epoch)||epoch<1||epoch>1000000)fail('Invalid dataset identity');
   if(typeof provenance!=='string'||provenance.trim().length<10||provenance.length>500)fail('Provenance is required');
   if(sourceRef!==undefined&&(typeof sourceRef!=='string'||sourceRef.length>500))fail('Invalid source reference');
   if(sourceRetrievedAt!==undefined&&(!Number.isFinite(Date.parse(sourceRetrievedAt))))fail('Invalid source retrieval time');
   if(!Array.isArray(addresses)||!addresses.length||addresses.length>10000)fail('Dataset must have 1–10000 addresses');
   const normalized=addresses.map(normalize),unique=[...new Set(normalized)].sort(),duplicates=normalized.length-unique.length;
   const data={schema:'listproof-addresses-v1',chainId:'11155111',datasetId,epoch,addresses:unique,provenance:provenance.trim()};
   const tree=build(data),canonical=JSON.stringify(data),id=randomUUID(),at=now(),jobId=randomUUID();
   await db.transaction(async tx=>{
    await tx.query('INSERT INTO dataset_versions(id,org_id,dataset_id,epoch,classification,provenance,source_ref,source_retrieved_at,imported_at,chain_id,root,content_hash,address_count,canonical_json,approval_status,publication_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,actor.orgId,datasetId,epoch,'imported-unverified',data.provenance,sourceRef||null,sourceRetrievedAt||null,at,'11155111',tree.root,sha(canonical),unique.length,canonical,'draft','local']);
    await tx.query('INSERT INTO import_jobs(id,org_id,actor_id,dataset_version_id,status,duplicate_count,error,created_at) VALUES(?,?,?,?,?,?,?,?)',[jobId,actor.orgId,actor.userId,id,'validated',duplicates,null,at]);
   });
   return {id,jobId,datasetId,epoch,root:tree.root,contentHash:sha(canonical),count:unique.length,duplicateCount:duplicates,classification:'imported-unverified',approvalStatus:'draft',publicationStatus:'local'};
  },
  async approveDataset(actor,id){
   if(actor.role!=='owner')fail('Owner role required',403);
   const version=await getVersion(db,actor,id);
   if(version.org_id!==actor.orgId)fail('Imported workspace version required',403);
   await db.query('UPDATE dataset_versions SET approval_status=? WHERE id=? AND org_id=?',['approved',id,actor.orgId]);
   return versionView({...version,approval_status:'approved'});
  }
 };
}
