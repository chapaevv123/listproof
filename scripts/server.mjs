import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build,nonmember,normalize} from '../src/core.mjs';
import {verifyNonMembership} from '../src/verify.mjs';
const load=n=>JSON.parse(readFileSync(new URL(`../data/epoch-${n}.json`,import.meta.url)));
const trees={1:build(load(1)),2:build(load(2))};
const readCRELog=name=>{const raw=readFileSync(new URL(`../evidence/${name}`,import.meta.url));return raw[0]===0xff&&raw[1]===0xfe?raw.toString('utf16le').slice(1):raw.toString('utf8').replace(/^\uFEFF/,'');};
const contentHash=n=>'0x'+createHash('sha256').update(JSON.stringify(load(n))).digest('hex');
const send=(res,status,body,type='application/json')=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(type==='application/json'?JSON.stringify(body):body);};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/')return send(res,200,readFileSync(new URL('../web/index.html',import.meta.url),'utf8'),'text/html; charset=utf-8');
 if(req.method==='GET'&&url.pathname==='/app.js')return send(res,200,readFileSync(new URL('../web/app.js',import.meta.url),'utf8'),'text/javascript; charset=utf-8');
 if(req.method==='GET'&&url.pathname==='/api/health')return send(res,200,{ok:true,mode:'synthetic-local',localProofOnly:true,sepoliaContractsPublished:true,creLocalEvidenceAvailable:existsSync(new URL('../evidence/cre-local-simulation.txt',import.meta.url))});
 if(req.method==='GET'&&url.pathname==='/evidence/cre-local-simulation.txt')return send(res,200,readCRELog('cre-local-simulation.txt'),'text/plain; charset=utf-8');
 if(req.method==='GET'&&url.pathname==='/evidence/cre-onchain-settings.txt')return send(res,200,readCRELog('cre-onchain-settings.txt'),'text/plain; charset=utf-8');
 if(req.method==='GET'&&/^\/dataset\/[12]$/.test(url.pathname))return send(res,200,load(Number(url.pathname.at(-1))));
 if(req.method==='GET'&&url.pathname==='/dataset/invalid')return send(res,200,JSON.parse(readFileSync(new URL('../data/invalid-schema.json',import.meta.url))));
 if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,Object.values(trees).map(t=>({epoch:t.context.epoch,root:t.root,count:t.addresses.length,context:t.context})));
 if(req.method==='GET'&&url.pathname==='/api/sepolia')return send(res,200,JSON.parse(readFileSync(new URL('../data/sepolia-public.json',import.meta.url),'utf8')));
 if(req.method==='POST'&&url.pathname==='/api/verify'){
  try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw Error('Request too large');}
   const {proof,againstEpoch}=JSON.parse(raw),tree=trees[againstEpoch];if(!tree)throw Error('Unknown epoch');
   const expected={...tree.context,root:tree.root,count:tree.addresses.length};
   return send(res,200,{verified:verifyNonMembership(proof,expected),commitment:{epoch:expected.epoch,root:expected.root,count:tree.addresses.length},verifier:'independent local implementation',contract:'Not checked by this local proof endpoint'});
  }catch(e){return send(res,400,{error:e.message});}
 }
 if(req.method==='POST'&&url.pathname==='/api/proof'){
  try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw Error('Request too large');}
   const {address,epoch=1,mode='clean'}=JSON.parse(raw),t=trees[epoch];if(!t)throw Error('Unknown epoch');const target=normalize(address);
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
