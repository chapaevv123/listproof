import {randomBytes,randomUUID,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt);
const sha=value=>createHash('sha256').update(value).digest('hex');
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const slugPattern=/^[a-z0-9][a-z0-9-]{2,39}$/;
const attempts=new Map();
const random=()=>randomBytes(32).toString('base64url');
export async function passwordHash(password){
 if(typeof password!=='string'||password.length<12||password.length>256)throw Error('Password must be 12–256 characters');
 const salt=randomBytes(16).toString('hex');
 const key=await derive(password,Buffer.from(salt,'hex'),64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return 'scrypt$32768$'+salt+'$'+key.toString('hex');
}
export async function passwordMatches(password,encoded){
 try{
  const [scheme,cost,salt,hex]=encoded.split('$');
  if(scheme!=='scrypt'||cost!=='32768'||!/^([0-9a-f]{32})$/.test(salt)||!/^([0-9a-f]{128})$/.test(hex))return false;
  const actual=await derive(password,Buffer.from(salt,'hex'),64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
  return timingSafeEqual(actual,Buffer.from(hex,'hex'));
 }catch{return false;}
}
export async function bootstrapOwner(db,{email,password,orgSlug,orgName}){
 if(!emailPattern.test(email)||!slugPattern.test(orgSlug)||typeof orgName!=='string'||!orgName.trim()||orgName.length>100)throw Error('Invalid owner or workspace');
 const hash=await passwordHash(password),now=new Date().toISOString(),userId=randomUUID(),orgId=randomUUID();
 return db.transaction(async tx=>{
  if(tx.kind==='postgres')await tx.query('SELECT pg_advisory_xact_lock(1279877435)');
  if((await tx.query('SELECT id FROM users LIMIT 1')).length){
   const rows=await tx.query("SELECT u.id user_id,o.id org_id FROM users u JOIN memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.org_id WHERE u.email=? AND o.slug=? AND m.role='owner'",[email.toLowerCase(),orgSlug]);
   if(rows.length!==1)throw Error('Owner already exists');
   return {userId:rows[0].user_id,orgId:rows[0].org_id,email:email.toLowerCase(),orgSlug};
  }
  await tx.query('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)',[userId,email.toLowerCase(),hash,now]);
  await tx.query('INSERT INTO organizations(id,slug,name,created_at) VALUES(?,?,?,?)',[orgId,orgSlug,orgName.trim(),now]);
  await tx.query('INSERT INTO memberships(org_id,user_id,role,created_at) VALUES(?,?,?,?)',[orgId,userId,'owner',now]);
  return {userId,orgId,email:email.toLowerCase(),orgSlug};
 });
}
export async function addUser(db,{actor,orgId,email,password,role}){
 if(actor.role!=='owner'||actor.orgId!==orgId)throw Error('Forbidden');
 if(!emailPattern.test(email)||!['analyst','auditor'].includes(role))throw Error('Invalid member');
 const hash=await passwordHash(password),now=new Date().toISOString(),userId=randomUUID();
 await db.transaction(async tx=>{
  await tx.query('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)',[userId,email.toLowerCase(),hash,now]);
  await tx.query('INSERT INTO memberships(org_id,user_id,role,created_at) VALUES(?,?,?,?)',[orgId,userId,role,now]);
 });
 return {userId,email:email.toLowerCase(),role};
}
export async function login(db,{email,password,orgSlug,remoteAddress}){
 const key=String(remoteAddress||'unknown')+'|'+String(email||'').toLowerCase(),now=Date.now();
 const prior=attempts.get(key);if(prior&&prior.until>now&&prior.count>=5)throw Object.assign(Error('Too many login attempts'),{status:429});
 const rows=await db.query('SELECT u.id user_id,u.password_hash,u.disabled_at,o.id org_id,o.slug,m.role FROM users u JOIN memberships m ON m.user_id=u.id JOIN organizations o ON o.id=m.org_id WHERE u.email=? AND o.slug=?',[String(email||'').toLowerCase(),orgSlug]);
 const user=rows[0];
 const ok=typeof password==='string'&&user&&!user.disabled_at&&await passwordMatches(password,user.password_hash);
 if(!ok){attempts.set(key,{count:(prior&&prior.until>now?prior.count:0)+1,until:now+15*60*1000});throw Object.assign(Error('Invalid credentials'),{status:401});}
 attempts.delete(key);
 const token=random(),csrf=sha('csrf:'+token),expiresAt=new Date(now+8*60*60*1000).toISOString();
 await db.query('INSERT INTO sessions(token_hash,user_id,org_id,csrf_hash,expires_at,created_at) VALUES(?,?,?,?,?,?)',[sha(token),user.user_id,user.org_id,sha(csrf),expiresAt,new Date(now).toISOString()]);
 return {token,csrf,expiresAt,user:{id:user.user_id,email:String(email).toLowerCase(),orgId:user.org_id,orgSlug:user.slug,role:user.role}};
}
export function cookieFor(token,{secure=false,clear=false}={}){
 return 'lp_session='+(clear?'':token)+'; Path=/api/v2; HttpOnly; SameSite=Strict'+(secure?'; Secure':'')+'; Max-Age='+(clear?'0':'28800');
}
export async function sessionFromRequest(db,req){
 const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('lp_session='));
 if(!cookie)return null;
 const token=cookie.slice('lp_session='.length);if(!/^[A-Za-z0-9_-]{40,50}$/.test(token))return null;
 const rows=await db.query('SELECT s.token_hash,s.csrf_hash,s.expires_at,u.id user_id,u.email,o.id org_id,o.slug,m.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN organizations o ON o.id=s.org_id JOIN memberships m ON m.user_id=u.id AND m.org_id=o.id WHERE s.token_hash=? AND u.disabled_at IS NULL',[sha(token)]);
 const row=rows[0];if(!row||row.expires_at<=new Date().toISOString())return null;
 return {tokenHash:row.token_hash,csrfHash:row.csrf_hash,csrf:sha('csrf:'+token),userId:row.user_id,email:row.email,orgId:row.org_id,orgSlug:row.slug,role:row.role};
}
export function validCsrf(session,header){
 if(typeof header!=='string'||!/^[0-9a-f]{64}$/.test(header))return false;
 return timingSafeEqual(Buffer.from(session.csrfHash,'hex'),Buffer.from(sha(header),'hex'));
}
export async function logout(db,session){await db.query('DELETE FROM sessions WHERE token_hash=?',[session.tokenHash]);}
