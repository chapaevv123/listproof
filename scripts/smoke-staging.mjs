import assert from 'node:assert/strict';

const origin=new URL(process.argv[2]||'');
const local=origin.hostname==='127.0.0.1'||origin.hostname==='localhost';
if(origin.protocol!=='https:'&&!(local&&origin.protocol==='http:'&&process.argv.includes('--allow-http-local')))throw Error('HTTPS staging URL required');
const get=(path,headers={})=>fetch(new URL(path,origin),{headers,signal:AbortSignal.timeout(10000)});
const health=await get('/api/health');assert.equal(health.status,200);const status=await health.json();
assert.equal(status.productVersion,'v4-rc');assert.equal(status.caseStorage,'postgres');assert.equal(status.privateWorkspaceEnabled,true);
for(const path of ['/workspace','/platform.css','/platform.js']){const response=await get(path);assert.equal(response.status,200,path);assert.ok((await response.text()).length>100);}
assert.equal((await get('/api/v2/openapi.json')).status,200);
const cre=await get('/api/v1/cre/v4');assert.equal(cre.status,200);const audit=await cre.json();assert.equal(audit.class,'OFFICIAL_CRE_SIMULATION');assert.equal(audit.liveDonExecution,false);
assert.equal((await get('/api/v2/cases')).status,401);
for(const path of ['/deploy.html','/api/publication/epoch-1'])assert.equal((await get(path)).status,404,path);
const publicScreen=await fetch(new URL('/api/v1/screenings',origin),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:'0x0000000000000000000000000000000000000006',epoch:1}),signal:AbortSignal.timeout(10000)});
assert.equal(publicScreen.status,200);assert.equal((await publicScreen.json()).status,'verified');
let auth='not configured';
if(process.env.LISTPROOF_STAGING_EMAIL&&process.env.LISTPROOF_STAGING_PASSWORD&&process.env.LISTPROOF_STAGING_ORG_SLUG){
 const response=await fetch(new URL('/api/v2/login',origin),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:process.env.LISTPROOF_STAGING_EMAIL,password:process.env.LISTPROOF_STAGING_PASSWORD,orgSlug:process.env.LISTPROOF_STAGING_ORG_SLUG}),signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0],session=await response.json();
 assert.equal((await get('/api/v2/cases',{cookie})).status,200);
 const logout=await fetch(new URL('/api/v2/logout',origin),{method:'POST',headers:{cookie,'x-csrf-token':session.csrf,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});assert.equal(logout.status,200);
 auth='pass';
}
console.log(JSON.stringify({origin:origin.origin,health:'pass',database:'postgres',assets:'pass',publicV1:'pass',savedCreV4:'pass',privateUnauthenticated:'401',privilegedPaths:'404',optionalAuthentication:auth}));
