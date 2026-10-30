import {openPlatformDb} from './platform-db.mjs';
import {ensureSyntheticVersions,createPlatformStore} from './platform-store.mjs';
import {bootstrapOwner,createDemoSession,login,logout,sessionFromRequest,validCsrf,cookieFor} from './platform-auth.mjs';

const error=(message,status=400)=>{throw Object.assign(Error(message),{status});};
async function jsonBody(req,max=1048576){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))error('JSON content type required',415);
 let size=0;const chunks=[];
 for await(const chunk of req){size+=chunk.length;if(size>max)error('Request too large',413);chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{error('Invalid JSON');}
}
const openapi={openapi:'3.1.0',info:{title:'ListProof V4 API',version:'0.1.0',description:'Synthetic committed-dataset evidence. No legal clearance or live DON claim.'},servers:[{url:'/'}],paths:{
 '/api/v2/login':{post:{summary:'Start authenticated workspace session',requestBody:{required:true,content:{'application/json':{schema:{type:'object',required:['email','password','orgSlug']}}}},responses:{200:{description:'Session and CSRF token'},401:{description:'Invalid credentials'}}}},
 '/api/v2/demo':{post:{summary:'Start an isolated, bounded jury demo session when enabled',responses:{200:{description:'Demo session'},404:{description:'Demo mode disabled'},429:{description:'Demo capacity reached'}}}},
 '/api/v2/session':{get:{summary:'Current authenticated user',responses:{200:{description:'Session'},401:{description:'Not authenticated'}}}},
 '/api/v2/screenings':{post:{summary:'Create real proof screening for approved version',responses:{200:{description:'Persisted screening'}}}},
 '/api/v2/batch':{post:{summary:'Screen up to 100 addresses with per-row outcomes',responses:{200:{description:'Batch results'}}}},
 '/api/v2/cases':{get:{summary:'List workspace cases',responses:{200:{description:'Cases'}}},post:{summary:'Create case from screening',responses:{200:{description:'Case'}}}},
 '/api/v2/cases/{id}':{get:{summary:'Case, notes and verifiable audit chain',responses:{200:{description:'Case'}}}},
 '/api/v2/datasets':{get:{summary:'Workspace and synthetic dataset versions',responses:{200:{description:'Versions'}}},post:{summary:'Import unverified dataset version; owner only',responses:{200:{description:'Draft commitment'}}}},
 '/api/v2/datasets/{id}/approve':{post:{summary:'Approve imported version for local screening; owner only',responses:{200:{description:'Approved version'}}}}
}};
export async function createPlatform(){
 const db=await openPlatformDb();
 try{
  await ensureSyntheticVersions(db);
  const email=process.env.LISTPROOF_OWNER_EMAIL,password=process.env.LISTPROOF_OWNER_PASSWORD;
  if(Boolean(email)!==Boolean(password))throw Error('Both LISTPROOF_OWNER_EMAIL and LISTPROOF_OWNER_PASSWORD are required for owner bootstrap');
  if(email)await bootstrapOwner(db,{email,password,orgSlug:process.env.LISTPROOF_ORG_SLUG||'listproof',orgName:process.env.LISTPROOF_ORG_NAME||'ListProof Workspace'});
  if(!(await db.query('SELECT id FROM users LIMIT 1')).length)throw Error('Owner bootstrap is required before the private workspace can start');
 }catch(error){await db.close();throw error;}
 const store=createPlatformStore(db);
 const demoEnabled=process.env.DEMO_MODE_ENABLED==='true';
 let demoStarts=[];const demoTraffic=new Map();
 const sendError=(send,res,e)=>send(res,e.status&&Number.isInteger(e.status)?e.status:500,{error:e.status?e.message:'Internal server error',code:e.status?'PLATFORM_REQUEST':'PLATFORM_INTERNAL'});
 async function handle(req,res,send,url){
  if(!url.pathname.startsWith('/api/v2/'))return false;
  const path=url.pathname,method=req.method;
  try{
   if(path==='/api/v2/openapi.json'&&method==='GET'){send(res,200,openapi);return true;}
   if(path==='/api/v2/demo'&&method==='POST'){
    if(!demoEnabled)error('Not found',404);
    let origin;try{origin=new URL(String(req.headers.origin||''));}catch{error('Same-origin request required',403);}
    if(origin.host!==req.headers.host||(process.env.NODE_ENV==='production'&&origin.protocol!=='https:'))error('Same-origin request required',403);
    if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)error('Demo sign-in takes no input',400);
    const existing=await sessionFromRequest(db,req);
    if(existing?.demo){const user={id:existing.userId,email:existing.email,orgId:existing.orgId,orgSlug:existing.orgSlug,role:existing.role,demo:true};send(res,200,{user,csrf:existing.csrf,expiresAt:existing.expiresAt});return true;}
    const now=Date.now();demoStarts=demoStarts.filter(at=>now-at<60000);
    if(demoStarts.length>=20)error('Demo sign-in rate limit reached',429);
    demoStarts.push(now);
    const session=await createDemoSession(db);
    send(res,200,{user:session.user,csrf:session.csrf,expiresAt:session.expiresAt},'application/json',{'set-cookie':cookieFor(session.token,{secure:process.env.NODE_ENV==='production',maxAge:7200})});return true;
   }
   if(path==='/api/v2/login'&&method==='POST'){
    const body=await jsonBody(req,4096);
    const session=await login(db,{...body,remoteAddress:req.socket.remoteAddress});
    send(res,200,{user:session.user,csrf:session.csrf,expiresAt:session.expiresAt},'application/json',{'set-cookie':cookieFor(session.token,{secure:process.env.NODE_ENV==='production'})});return true;
   }
   const session=await sessionFromRequest(db,req);
   if(!session)error('Authentication required',401);
   if(session.demo&&!demoEnabled)error('Demo mode disabled',401);
   if(session.demo){const now=Date.now(),entry=demoTraffic.get(session.tokenHash);if(!entry||now-entry.at>=60000)demoTraffic.set(session.tokenHash,{at:now,count:1});else if(++entry.count>120)error('Demo request limit reached',429);if(demoTraffic.size>2000)for(const [key,value] of demoTraffic)if(now-value.at>=60000)demoTraffic.delete(key);}
   const user={id:session.userId,userId:session.userId,email:session.email,orgId:session.orgId,orgSlug:session.orgSlug,role:session.role,demo:session.demo};
   if(path==='/api/v2/session'&&method==='GET'){send(res,200,{user,csrf:session.csrf,storageMode:db.kind});return true;}
   if(method!=='GET'&&!validCsrf(session,req.headers['x-csrf-token']))error('CSRF token required',403);
   if(path==='/api/v2/logout'&&method==='POST'){await logout(db,session);send(res,200,{ok:true},'application/json',{'set-cookie':cookieFor('',{secure:process.env.NODE_ENV==='production',clear:true})});return true;}
   if(path==='/api/v2/datasets'&&method==='GET'){send(res,200,await store.versions(user));return true;}
   if(path==='/api/v2/datasets'&&method==='POST'){send(res,201,await store.importDataset(user,await jsonBody(req)));return true;}
   let match=path.match(/^\/api\/v2\/datasets\/([0-9a-f-]{36})\/approve$/);
   if(match&&method==='POST'){send(res,200,await store.approveDataset(user,match[1]));return true;}
   if(path==='/api/v2/screenings'&&method==='POST'){
    const body=await jsonBody(req,16384);
    send(res,201,await store.screening(user,{...body,idempotencyKey:req.headers['idempotency-key']}));return true;
   }
   if(path==='/api/v2/verify'&&method==='POST'){send(res,200,await store.verifyReceipt(user,await jsonBody(req,131072)));return true;}
   if(path==='/api/v2/batch'&&method==='POST'){send(res,200,await store.batch(user,await jsonBody(req,262144)));return true;}
   if(path==='/api/v2/cases'&&method==='GET'){send(res,200,await store.cases(user,{status:url.searchParams.get('status'),search:url.searchParams.get('search'),sort:url.searchParams.get('sort')}));return true;}
   if(path==='/api/v2/cases'&&method==='POST'){send(res,201,await store.createCase(user,await jsonBody(req,4096)));return true;}
   match=path.match(/^\/api\/v2\/cases\/([0-9a-f-]{36})(?:\/(status|notes|reverify))?$/);
   if(match){
    const [,id,action]=match;
    if(!action&&method==='GET'){send(res,200,await store.case(user,id));return true;}
    if(action==='status'&&method==='POST'){const body=await jsonBody(req,4096);send(res,200,await store.status(user,id,body.status));return true;}
    if(action==='notes'&&method==='POST'){const body=await jsonBody(req,4096);send(res,200,await store.note(user,id,body.body));return true;}
    if(action==='reverify'&&method==='POST'){send(res,200,await store.reverify(user,id));return true;}
   }
   error('Not found',404);
  }catch(e){sendError(send,res,e);return true;}
 }
 return {handle,db,store};
}
