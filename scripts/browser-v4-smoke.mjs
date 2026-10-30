import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,unlinkSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openPlatformDb} from '../src/platform-db.mjs';
import {bootstrapOwner} from '../src/platform-auth.mjs';

const base='http://127.0.0.1:4184',debug='http://127.0.0.1:9229';
const chrome=process.env.LISTPROOF_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const temporary=mkdtempSync(join(tmpdir(),'listproof-v4-browser-'));
const database=join(temporary,'workspace.sqlite');
const password='local smoke only '+crypto.randomUUID();
let server,browser,ws;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){for(let i=0;i<100;i++){try{const value=await check();if(value)return value;}catch{}await pause(100);}throw Error('Timed out: '+label);}
try{
 const db=await openPlatformDb({sqlitePath:database});
 await bootstrapOwner(db,{email:'smoke@example.test',password,orgSlug:'smoke-org',orgName:'Smoke workspace'});
 await db.close();
 server=spawn(process.execPath,['scripts/server.mjs'],{env:{...process.env,LISTPROOF_DB_PATH:database,LISTPROOF_PORT:'4184',LISTPROOF_HOST:'127.0.0.1'},stdio:'ignore',windowsHide:true});
 await until(async()=>{const response=await fetch(base+'/api/health');return response.ok&&response.json().then(x=>x.privateWorkspaceEnabled);},'V4 server');
 browser=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-allow-origins=*','--remote-debugging-port=9229','--user-data-dir='+join(temporary,'chrome'),base+'/workspace'],{stdio:'ignore',windowsHide:true});
 const target=await until(async()=>{const rows=await(await fetch(debug+'/json')).json();return rows.find(x=>x.type==='page'&&x.url.startsWith(base+'/workspace'));},'Chrome page');
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map();
 ws.onmessage=event=>{const value=JSON.parse(event.data),request=pending.get(value.id);if(!request)return;pending.delete(value.id);value.error?request.reject(Error(value.error.message)):request.resolve(value.result);};
 const command=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
 const evaluate=async expression=>{const result=await command('Runtime.evaluate',{expression:`(async()=>{${expression}})()`,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value;};
 await until(()=>evaluate("return document.querySelector('#login-form')?.tagName"),'login form');
 await evaluate(`document.querySelector('#login-email').value='smoke@example.test';document.querySelector('#login-org').value='smoke-org';document.querySelector('#login-password').value=${JSON.stringify(password)};document.querySelector('#login-form').requestSubmit();`);
 await until(()=>evaluate("return document.querySelector('.platform-rail')?.textContent.includes('smoke-org')"),'authenticated workspace');
 await evaluate("location.hash='#screening'");
 await until(()=>evaluate("return Boolean(document.querySelector('#screen-form'))"),'screen form');
 await evaluate("document.querySelector('#screen-form').requestSubmit()");
 await until(()=>evaluate("return Boolean(document.querySelector('#save-screen-case'))"),'screening result');
 await evaluate("document.querySelector('#save-screen-case').click()");
 await until(()=>evaluate("return Boolean(document.querySelector('#case-note-form'))"),'case page');
 await evaluate("document.querySelector('#case-note').value='Browser smoke review';document.querySelector('#case-note-form').requestSubmit()");
 await until(()=>evaluate("return document.querySelector('.platform-content')?.textContent.includes('Browser smoke review')"),'note persisted');
 await evaluate("document.querySelector('#case-reverify').click()");
 await until(()=>evaluate("return document.querySelector('.platform-content')?.textContent.includes('EVIDENCE REVERIFIED')"),'reverification event');
 await evaluate("document.querySelector('#case-inspect').click()");
 await until(()=>evaluate("return Boolean(document.querySelector('#verify-proof'))"),'proof inspector');
 await evaluate("document.querySelector('#verify-proof').click()");
 await until(()=>evaluate("return document.querySelector('.platform-content')?.textContent.includes('Proof verified')"),'proof verification');
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await pause(200);
 const mobile=await evaluate("return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,navDisplay:getComputedStyle(document.querySelector('.platform-nav')).display,navDirection:getComputedStyle(document.querySelector('.platform-nav')).flexDirection}");
 assert.ok(mobile.scrollWidth<=mobile.width+1,'Mobile viewport overflows');
 assert.equal(mobile.width,390,'Mobile layout viewport expanded unexpectedly');
 assert.equal(mobile.navDisplay,'flex','Mobile navigation must use horizontal scrolling');
 assert.equal(mobile.navDirection,'row','Mobile navigation must be horizontal');
 await evaluate("location.hash='#overview'");
 await until(()=>evaluate("return document.querySelector('h1')?.textContent.includes('Every result')"),'overview');
 await pause(3700);
 const mobileShot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync(new URL('../docs/assets/v4-workspace-mobile.png',import.meta.url),Buffer.from(mobileShot.data,'base64'));
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await pause(200);
 const screenshot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync(new URL('../docs/assets/v4-workspace-local.png',import.meta.url),Buffer.from(screenshot.data,'base64'));
 console.log(JSON.stringify({login:true,screening:true,caseNote:true,reverification:true,proofVerified:true,mobile,screenshots:['docs/assets/v4-workspace-local.png','docs/assets/v4-workspace-mobile.png']}));
}finally{
 ws?.close();browser?.kill();server?.kill();
 if(server&&server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));
 for(const suffix of ['','-wal','-shm'])if(existsSync(database+suffix)){
  for(let attempt=0;attempt<20;attempt++)try{unlinkSync(database+suffix);break;}catch(error){if(error.code!=='EBUSY'||attempt===19)throw error;await pause(100);}
 }
}
