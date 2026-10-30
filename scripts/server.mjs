import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build,nonmember,normalize} from '../src/core.mjs';
import {verifyNonMembership} from '../src/verify.mjs';
const load=n=>JSON.parse(readFileSync(new URL(`../data/epoch-${n}.json`,import.meta.url)));
const trees={1:build(load(1)),2:build(load(2))};
const readCRELog=name=>{const raw=readFileSync(new URL(`../evidence/${name}`,import.meta.url));return raw[0]===0xff&&raw[1]===0xfe?raw.toString('utf16le').slice(1):raw.toString('utf8').replace(/^\uFEFF/,'');};
const contentHash=n=>'0x'+createHash('sha256').update(JSON.stringify(load(n))).digest('hex');
const send=(res,status,body,type='application/json',extra={})=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'",...extra});res.end(type==='application/json'?JSON.stringify(body):body);};
const rpcUrl=process.env.LISTPROOF_SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com';
if(!/^https:\/\//.test(rpcUrl))throw Error('Sepolia RPC URL must use HTTPS');
const registry='0x1607Af4E1DA1C06362871443d2e95C367B984Efa';
const selectors={epoch:'0x900cf0cf',root:'0xebf0c717',count:'0x06661abd',datasetId:'0xd02d7019',contentHash:'0x646c2e33'};
let registryCache=null;
async function rpc(method,params){
 const response=await fetch(rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error(`RPC HTTP ${response.status}`);
 const data=await response.json();if(data.error||!data.result)throw Error('RPC result unavailable');return data.result;
}
async function registryStatus(){
 if(registryCache&&Date.now()-registryCache.at<60000)return registryCache.value;
 const checkedAt=new Date().toISOString();
 try{
  const [chain,block]=await Promise.all([rpc('eth_chainId',[]),rpc('eth_blockNumber',[])]);
  if(BigInt(chain)!==11155111n)throw Error('RPC chain mismatch');
  const code=await rpc('eth_getCode',[registry,block]);if(code==='0x')throw Error('Registry code missing');
  const entries=await Promise.all(Object.entries(selectors).map(async([name,selector])=>[name,await rpc('eth_call',[{to:registry,data:selector},block])]));
  const values=Object.fromEntries(entries);
  if(Object.values(values).some(x=>!/^0x[0-9a-fA-F]{64}$/.test(x)))throw Error('Malformed Registry result');
  const published=JSON.parse(readFileSync(new URL('../data/sepolia-public.json',import.meta.url),'utf8'));
  const result={status:'online',method:'read-only Sepolia RPC at one block',checkedAt,blockNumber:Number(BigInt(block)),chainId:11155111,registry,epoch:Number(BigInt(values.epoch)),root:values.root.toLowerCase(),count:Number(BigInt(values.count)),datasetId:values.datasetId.toLowerCase(),contentHash:values.contentHash.toLowerCase()};
  result.matchesSavedEpochOne=result.epoch===published.epoch&&result.root===published.root&&result.count===published.count&&result.datasetId===published.datasetId&&result.contentHash===published.contentHash;
  registryCache={at:Date.now(),value:result};return result;
 }catch(error){const result={status:'unavailable',method:'read-only Sepolia RPC',checkedAt,reason:error.message};registryCache={at:Date.now(),value:result};return result;}
}
function creEvidence(){
 const raw=readCRELog('cre-v3-onchain-settings.txt');
 const match=raw.match(/\[USER LOG\] (\{[^\r\n]+\})/);
 if(!match)throw Error('CRE audit log missing result');
 const report=JSON.parse(match[1]);
 const published=JSON.parse(readFileSync(new URL('../data/sepolia-public.json',import.meta.url),'utf8'));
 const valid=report.root===published.root&&report.contentHash===published.contentHash&&report.count===published.count&&report.epoch===published.epoch&&report.registryObservation?.includes(`epoch=${published.epoch}`)&&report.publishStatus?.includes('no transaction sent');
 if(!valid)throw Error('CRE audit log differs from published evidence');
 return {class:'OFFICIAL_CRE_SIMULATION',status:'verified-saved-log',observedSepoliaBlock:report.observedSepoliaBlock,registryObservation:report.registryObservation,publishStatus:report.publishStatus,root:report.root,contentHash:report.contentHash,count:report.count,logPath:'/evidence/cre-v3-onchain-settings.txt',logSha256:'0x'+createHash('sha256').update(raw).digest('hex'),liveDonExecution:false,onchainWrite:false};
}
const configuredLimit=Number(process.env.LISTPROOF_RATE_LIMIT||300);
const rateLimit=Number.isSafeInteger(configuredLimit)&&configuredLimit>0&&configuredLimit<=1000?configuredLimit:300;
const traffic=new Map();
function allowed(req){const key=req.socket.remoteAddress||'unknown',now=Date.now(),prior=traffic.get(key);if(traffic.size>2000)for(const [ip,v] of traffic)if(now-v.start>=60000)traffic.delete(ip);if(!prior||now-prior.start>=60000){traffic.set(key,{start:now,count:1});return true;}prior.count++;return prior.count<=rateLimit;}
const server=createServer(async(req,res)=>{
 if(!allowed(req))return send(res,429,{error:'Rate limit exceeded',code:'RATE_LIMIT'},'application/json',{'retry-after':'60'});
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/')return send(res,200,readFileSync(new URL('../web/index.html',import.meta.url),'utf8'),'text/html; charset=utf-8');
 if(req.method==='GET'&&url.pathname==='/styles.css')return send(res,200,readFileSync(new URL('../web/styles.css',import.meta.url),'utf8'),'text/css; charset=utf-8');
 if(req.method==='GET'&&url.pathname==='/app.js')return send(res,200,readFileSync(new URL('../web/app.js',import.meta.url),'utf8'),'text/javascript; charset=utf-8');
 if(req.method==='GET'&&url.pathname==='/cases.js')return send(res,200,readFileSync(new URL('../web/cases.js',import.meta.url),'utf8'),'text/javascript; charset=utf-8');
 if(req.method==='GET'&&url.pathname==='/api/health')return send(res,200,{ok:true,productVersion:'v3',mode:'synthetic-read-only',caseStorage:'browser-local',localProofOnly:true,sepoliaContractsPublished:true,creLocalEvidenceAvailable:existsSync(new URL('../evidence/cre-local-simulation.txt',import.meta.url))});
 if(req.method==='GET'&&url.pathname==='/evidence/cre-local-simulation.txt')return send(res,200,readCRELog('cre-local-simulation.txt'),'text/plain; charset=utf-8');
 if(req.method==='GET'&&url.pathname==='/evidence/cre-onchain-settings.txt')return send(res,200,readCRELog('cre-onchain-settings.txt'),'text/plain; charset=utf-8');
 if(req.method==='GET'&&url.pathname==='/evidence/cre-v3-onchain-settings.txt')return send(res,200,readCRELog('cre-v3-onchain-settings.txt'),'text/plain; charset=utf-8');
 if(req.method==='GET'&&/^\/dataset\/[12]$/.test(url.pathname))return send(res,200,load(Number(url.pathname.at(-1))));
 if(req.method==='GET'&&url.pathname==='/dataset/invalid')return send(res,200,JSON.parse(readFileSync(new URL('../data/invalid-schema.json',import.meta.url))));
 if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,Object.values(trees).map(t=>({epoch:t.context.epoch,root:t.root,count:t.addresses.length,context:t.context})));
 if(req.method==='GET'&&url.pathname==='/api/sepolia')return send(res,200,JSON.parse(readFileSync(new URL('../data/sepolia-public.json',import.meta.url),'utf8')));
 if(req.method==='GET'&&url.pathname==='/api/v1/datasets')return send(res,200,Object.values(trees).map(t=>({schema:'listproof-addresses-v1',classification:'synthetic',epoch:t.context.epoch,chainId:t.context.chainId,datasetId:t.context.datasetId,datasetKey:t.context.datasetKey,root:t.root,count:t.addresses.length,contentHash:contentHash(t.context.epoch),provenance:load(t.context.epoch).provenance,addresses:t.addresses,registryPublished:t.context.epoch===1})));
 if(req.method==='GET'&&url.pathname==='/api/v1/registry/status')return send(res,200,await registryStatus());
 if(req.method==='GET'&&url.pathname==='/api/v1/cre/evidence')try{return send(res,200,creEvidence());}catch{return send(res,503,{error:'Saved CRE evidence unavailable or inconsistent',code:'CRE_EVIDENCE'});}
 if(req.method==='POST'&&['/api/verify','/api/v1/verify'].includes(url.pathname)){
  try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw Error('Request too large');}
   const {proof,againstEpoch}=JSON.parse(raw),tree=trees[againstEpoch];if(!tree)throw Error('Unknown epoch');
   const expected={...tree.context,root:tree.root,count:tree.addresses.length};
   return send(res,200,{verified:verifyNonMembership(proof,expected),commitment:{epoch:expected.epoch,root:expected.root,count:tree.addresses.length},verifier:'independent local implementation',contract:'Not checked by this local proof endpoint'});
  }catch(e){return send(res,400,{error:e.message});}
 }
 if(req.method==='POST'&&['/api/proof','/api/v1/screenings'].includes(url.pathname)){
  try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw Error('Request too large');}
   const {address,epoch=1,mode='clean'}=JSON.parse(raw),t=trees[epoch];if(!t||!Number.isSafeInteger(epoch))throw Error('Unknown epoch');if(!['clean','manual','listed','stale','tampered'].includes(mode))throw Error('Unknown scenario');const target=normalize(address);
   if(t.addresses.includes(target))return send(res,200,{status:'listed',epoch,target,root:t.root});
   const proof=nonmember(t,target),current=trees[2];if(mode==='tampered')proof.target=t.addresses[0];
   const expected=mode==='stale'?{...current.context,root:current.root,count:current.addresses.length}:{...t.context,root:t.root,count:t.addresses.length};
   const verified=verifyNonMembership(proof,expected);
   return send(res,200,{status:verified?'verified':'rejected',proof,checkedAgainst:{epoch:expected.epoch,root:expected.root},receipt:{kind:'listproof-local-proof-v1',commitment:{...t.context,root:t.root,count:t.addresses.length,contentHash:contentHash(epoch)},proof,verifiedAgainst:{epoch:expected.epoch,root:expected.root},verified,provenance:load(epoch).provenance,chainStatus:'local proof only; no on-chain verification for this result'},contract:'Not checked by this local proof endpoint'});
  }catch(e){return send(res,400,{error:e.message});}
 }
 send(res,404,{error:'Not found'});
});
const port=Number(process.env.PORT||process.env.LISTPROOF_PORT||4173);
const host=process.env.LISTPROOF_HOST||'127.0.0.1';
server.listen(port,host,()=>console.log(`ListProof demo: http://${host}:${port}`));
