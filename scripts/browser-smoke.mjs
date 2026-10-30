import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';

const endpoint=process.argv[2]||'http://127.0.0.1:9228';
const pageOrigin=process.argv[3]||'http://127.0.0.1:4173';
const targets=await (await fetch(endpoint+'/json')).json();
const target=targets.find(x=>x.type==='page'&&x.url.startsWith(pageOrigin));
assert.ok(target,'Open the local ListProof page in headless Chrome first');
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let nextId=1;
const pending=new Map();
ws.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const request=pending.get(message.id);if(!request)return;pending.delete(message.id);message.error?request.reject(Error(message.error.message)):request.resolve(message.result);};
function command(method,params={}){return new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){
 const result=await command('Runtime.evaluate',{expression:`(async()=>{${expression}})()`,awaitPromise:true,returnByValue:true});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
 return result.result.value;
}
const wait=`const until=async(test)=>{for(let i=0;i<80;i++){if(test())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+location.hash+' / '+document.querySelector('#toast')?.textContent+' / '+JSON.parse(localStorage.getItem('listproof:cases:v1')||'[]').at(-1)?.events?.map(x=>x.type))};`;
try{
 await command('Page.reload',{ignoreCache:true});
 await new Promise(resolve=>setTimeout(resolve,500));
 const outcome=await evaluate(`${wait}
 location.hash='#overview';
 await until(()=>document.querySelector('h1')?.textContent==='Evidence you can revisit');
 location.hash='#screening';
 await until(()=>document.querySelector('#screen-form'));
 document.querySelector('#screen-form').requestSubmit();
 await until(()=>document.querySelector('#save-case'));
 if(!document.querySelector('#screen-result').textContent.includes('Not present in committed dataset'))throw Error('Valid proof result absent');
 document.querySelector('#save-case').click();
 await until(()=>location.hash.startsWith('#cases/'));
 const caseId=location.hash.split('/')[1];
 await until(()=>document.querySelector('#case-report'));
 document.querySelector('#case-change-status').value='Under Review';
 document.querySelector('#case-save-status').click();
 if(JSON.parse(localStorage.getItem('listproof:cases:v1')).find(x=>x.id===caseId)?.status!=='Under Review')throw Error('Status did not save: '+document.querySelector('#toast').textContent);
 document.querySelector('#case-note').value='Browser smoke verification note';
 document.querySelector('#note-form').requestSubmit();
 if(JSON.parse(localStorage.getItem('listproof:cases:v1')).find(x=>x.id===caseId)?.notes.length!==1)throw Error('Note did not save: '+document.querySelector('#toast').textContent);
 document.querySelector('#case-reverify').click();
 await new Promise(r=>setTimeout(r,500));
 if(!JSON.parse(localStorage.getItem('listproof:cases:v1')).find(x=>x.id===caseId)?.events.some(e=>e.type==='EVIDENCE_REVERIFIED'))throw Error('Reverification event missing: '+document.querySelector('#toast').textContent+' / '+JSON.stringify(JSON.parse(localStorage.getItem('listproof:cases:v1')).find(x=>x.id===caseId)?.events.map(e=>e.type)));
 const saved=JSON.parse(localStorage.getItem('listproof:cases:v1'));
 const item=saved.find(x=>x.id===caseId);
 if(item.status!=='Under Review'||item.notes.length!==1||item.latestVerification.verified!==true)throw Error('Case workflow failed');
 location.hash='#proof';
 await until(()=>document.querySelector('#receipt-text'));
 document.querySelector('#receipt-text').value=JSON.stringify(item.receipt);
 document.querySelector('#verify-receipt').click();
 await until(()=>document.querySelector('#download-verification'));
 if(!document.querySelector('.result-banner')?.textContent.includes('Proof verified'))throw Error('Receipt verification failed');
 const forged=JSON.parse(document.querySelector('#receipt-text').value);
 forged.commitment.root='0x'+'00'.repeat(32);
 document.querySelector('#receipt-text').value=JSON.stringify(forged);
 document.querySelector('#verify-receipt').click();
 await until(()=>document.querySelector('.result-banner')?.textContent.includes('Proof rejected'));
 location.hash='#registry';
 await until(()=>document.querySelector('#refresh-registry'));
 location.hash='#cre';
 await until(()=>document.querySelector('h1')?.textContent==='Chainlink CRE Integration');
 return {caseId,status:item.status,notes:item.notes.length,reverified:item.latestVerification.verified,receiptVerified:true,tamperedReceiptRejected:true,navigation:'screening/case/proof/registry/cre'};
 `);
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const mobile=await evaluate(`${wait} location.hash='#screening'; await until(()=>document.querySelector('#screen-form')); return {innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth};`);
 assert.ok(mobile.scrollWidth<=mobile.innerWidth+1,'Mobile page overflows horizontally');
 await new Promise(resolve=>setTimeout(resolve,3700));
 const screenshot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 writeFileSync(new URL('../docs/assets/v3-mobile-local.png',import.meta.url),Buffer.from(screenshot.data,'base64'));
 await command('Emulation.clearDeviceMetricsOverride');
 console.log(JSON.stringify({...outcome,mobileLayout:mobile,mobileScreenshot:'docs/assets/v3-mobile-local.png'},null,2));
}finally{ws.close();}
