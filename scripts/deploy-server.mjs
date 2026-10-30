import {createServer} from 'node:http';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {epochOneCommitment,assertPublishable,matchesRuntimeBytecode,REGISTRY,GATE,PUBLISHER} from '../src/publication.mjs';

const HOST='127.0.0.1';
const PORT=4183;
const ACCOUNT='0x765fb7e6a0BdDDc29f57eeCE34AEda0Fb318805d';
const DATASET_ID='0x'+createHash('sha256').update('listproof-synthetic-demo','utf8').digest('hex');
const RPC=process.env.LISTPROOF_SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com';
const evidenceUrl=new URL('../evidence/sepolia-deployments.json',import.meta.url);
const publicationUrl=new URL('../evidence/sepolia-root-publication.json',import.meta.url);
const artifactPath=name=>new URL(`../out/ListProof.sol/${name}.json`,import.meta.url);
const source=readFileSync(new URL('../contracts/ListProof.sol',import.meta.url),'utf8');
const deployRequire=createRequire(new URL('../deploy-ui/package.json',import.meta.url));
const deployScript=readFileSync(new URL('../script/DeploySynthetic.s.sol',import.meta.url),'utf8');
const scriptId=deployScript.match(/bytes32 constant ID\s*=\s*(0x[0-9a-fA-F]{64})/i)?.[1];
if(scriptId?.toLowerCase()!==DATASET_ID)throw Error('DeploySynthetic dataset ID differs from SHA-256 dataset ID');
if(!/^https:\/\//.test(RPC))throw Error('Sepolia RPC must use HTTPS');

const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
const file=(res,body,type)=>{res.writeHead(200,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; connect-src 'self' https:; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(body);};
const validHash=x=>typeof x==='string'&&/^0x[0-9a-fA-F]{64}$/.test(x);
const loadEvidence=()=>existsSync(evidenceUrl)?JSON.parse(readFileSync(evidenceUrl,'utf8')):{schema:'listproof-sepolia-deployments-v1',chainId:11155111};
async function ethersModule(){try{return deployRequire('ethers');}catch{throw Object.assign(Error('ethers 6.15.0 is not installed; run npm.cmd install in the deploy-ui directory from ordinary PowerShell'),{status:503});}}
function loadArtifact(name,ethers){
 if(!['ListProofRegistry','ListProofGate'].includes(name))throw Object.assign(Error('Unknown contract'),{status:404});
 const a=JSON.parse(readFileSync(artifactPath(name),'utf8'));
 const m=typeof a.metadata==='string'?JSON.parse(a.metadata):a.metadata;
 if(m?.compiler?.version!=='0.8.24+commit.e11b9ed9'||m.settings?.optimizer?.enabled!==true||m.settings?.optimizer?.runs!==200||m.settings?.viaIR!==true)throw Error(`${name} compiler settings mismatch`);
 if(m.sources?.['contracts/ListProof.sol']?.keccak256?.toLowerCase()!==ethers.keccak256(ethers.toUtf8Bytes(source)).toLowerCase())throw Error(`${name} artifact is stale`);
 const bytecode=a.bytecode?.object;
 if(typeof bytecode!=='string'||!/^0x[0-9a-fA-F]+$/.test(bytecode)||bytecode.length<100)throw Error(`${name} bytecode unavailable`);
 return {name,abi:a.abi,bytecode,compiler:m.compiler.version,optimizerRuns:200,viaIR:true,sourceHash:m.sources['contracts/ListProof.sol'].keccak256};
}
async function rpc(method,params=[]){
 const response=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`Sepolia RPC HTTP ${response.status}`);
 const result=await response.json();if(result.error)throw Error(`Sepolia RPC ${result.error.message}`);return result.result;
}
async function verifyOnChain(name,hash,registryAddress){
 const ethers=await ethersModule();const artifact=loadArtifact(name,ethers);
 if(!validHash(hash))throw Object.assign(Error('Invalid transaction hash'),{status:400});
 if(await rpc('eth_chainId')!=='0xaa36a7')throw Error('RPC is not Ethereum Sepolia');
 const [tx,receipt]=await Promise.all([rpc('eth_getTransactionByHash',[hash]),rpc('eth_getTransactionReceipt',[hash])]);
 if(!tx||!receipt)throw Object.assign(Error('Transaction is not mined yet'),{status:409});
 if(tx.hash?.toLowerCase()!==hash.toLowerCase()||receipt.transactionHash?.toLowerCase()!==hash.toLowerCase())throw Error('RPC returned a different transaction');
 if(receipt.status!=='0x1'||tx.to!==null||receipt.to!==null)throw Error('Not a successful contract creation');
 if(tx.from?.toLowerCase()!==ACCOUNT.toLowerCase()||receipt.from?.toLowerCase()!==ACCOUNT.toLowerCase())throw Error('Transaction was not sent by the required Pulse wallet');
 if(BigInt(tx.value||'0x0')!==0n)throw Error('Deployment sent nonzero ETH value');
 const contractAddress=ethers.getAddress(receipt.contractAddress);
 const args=name==='ListProofRegistry'?[DATASET_ID,ACCOUNT]:[registryAddress];
 if(name==='ListProofGate'&&!ethers.isAddress(registryAddress))throw Error('Verified registry address required');
 const expectedInput=(artifact.bytecode+new ethers.Interface(artifact.abi).encodeDeploy(args).slice(2)).toLowerCase();
 if(tx.input?.toLowerCase()!==expectedInput)throw Error('Creation bytecode or constructor arguments differ from pinned artifact');
 const code=await rpc('eth_getCode',[contractAddress,'latest']);if(!code||code==='0x')throw Error('No deployed bytecode at receipt address');
 const iface=new ethers.Interface(artifact.abi);
 const read=async method=>iface.decodeFunctionResult(method,await rpc('eth_call',[{to:contractAddress,data:iface.encodeFunctionData(method)},'latest']))[0];
 if(name==='ListProofRegistry'){
  if((await read('datasetId')).toLowerCase()!==DATASET_ID||ethers.getAddress(await read('publisher'))!==ethers.getAddress(ACCOUNT))throw Error('Registry state does not match constructor arguments');
 }else if(ethers.getAddress(await read('registry'))!==ethers.getAddress(registryAddress))throw Error('Gate points to another registry');
 return {contract:name,address:contractAddress,transactionHash:receipt.transactionHash,blockNumber:Number(BigInt(receipt.blockNumber)),gasUsed:BigInt(receipt.gasUsed).toString(),from:ethers.getAddress(tx.from),constructorArguments:args,compiler:artifact.compiler,optimizerRuns:200,viaIR:true,explorerTx:`https://sepolia.etherscan.io/tx/${receipt.transactionHash}`,explorerAddress:`https://sepolia.etherscan.io/address/${contractAddress}`,verifiedAt:new Date().toISOString(),verification:'Sepolia RPC receipt, sender, exact creation input, deployed code and contract state'};
}
async function readPublicationState(){
 const ethers=await ethersModule();
 const saved=loadEvidence();
 if(saved.chainId!==11155111||saved.registry?.address?.toLowerCase()!==REGISTRY.toLowerCase()||saved.gate?.address?.toLowerCase()!==GATE.toLowerCase())throw Error('Confirmed deployment evidence is missing or points to another contract');
 await verifyOnChain('ListProofRegistry',saved.registry.transactionHash);
 await verifyOnChain('ListProofGate',saved.gate.transactionHash,REGISTRY);
 if(await rpc('eth_chainId')!=='0xaa36a7')throw Error('RPC is not Ethereum Sepolia');
 const block=await rpc('eth_blockNumber');
 const [registryCode,gateCode]=await Promise.all([rpc('eth_getCode',[REGISTRY,block]),rpc('eth_getCode',[GATE,block])]);
 const registryArtifact=JSON.parse(readFileSync(artifactPath('ListProofRegistry'),'utf8'));
 const gateArtifact=JSON.parse(readFileSync(artifactPath('ListProofGate'),'utf8'));
 loadArtifact('ListProofRegistry',ethers);loadArtifact('ListProofGate',ethers);
 const registryCodeMatches=matchesRuntimeBytecode(registryCode,registryArtifact,DATASET_ID);
 const gateCodeMatches=matchesRuntimeBytecode(gateCode,gateArtifact,'0x'+REGISTRY.slice(2).padStart(64,'0'));
 const registryInterface=new ethers.Interface(registryArtifact.abi),gateInterface=new ethers.Interface(gateArtifact.abi);
 const read=async(address,iface,name)=>iface.decodeFunctionResult(name,await rpc('eth_call',[{to:address,data:iface.encodeFunctionData(name)},block]))[0];
 const [publisher,datasetId,epoch,root,contentHash,count,gateRegistry]=await Promise.all([
  read(REGISTRY,registryInterface,'publisher'),read(REGISTRY,registryInterface,'datasetId'),read(REGISTRY,registryInterface,'epoch'),
  read(REGISTRY,registryInterface,'root'),read(REGISTRY,registryInterface,'contentHash'),read(REGISTRY,registryInterface,'count'),
  read(GATE,gateInterface,'registry')
 ]);
 return {chainId:11155111,blockNumber:Number(BigInt(block)),registryAddress:REGISTRY,gateAddress:GATE,registryCodeMatches,gateCodeMatches,publisher,datasetId,epoch:epoch.toString(),root,contentHash,count:count.toString(),gateRegistry};
}
async function verifyPublication(hash){
 const ethers=await ethersModule();if(!validHash(hash))throw Object.assign(Error('Invalid transaction hash'),{status:400});
 const commitment=epochOneCommitment();
 if(await rpc('eth_chainId')!=='0xaa36a7')throw Error('RPC is not Ethereum Sepolia');
 const [tx,receipt]=await Promise.all([rpc('eth_getTransactionByHash',[hash]),rpc('eth_getTransactionReceipt',[hash])]);
 if(!tx||!receipt)throw Object.assign(Error('Publication transaction is not mined'),{status:409});
 if(tx.hash?.toLowerCase()!==hash.toLowerCase()||receipt.transactionHash?.toLowerCase()!==hash.toLowerCase()||receipt.status!=='0x1')throw Error('Publication receipt is unsuccessful or inconsistent');
 if(tx.to?.toLowerCase()!==REGISTRY.toLowerCase()||receipt.to?.toLowerCase()!==REGISTRY.toLowerCase()||tx.from?.toLowerCase()!==PUBLISHER.toLowerCase()||receipt.from?.toLowerCase()!==PUBLISHER.toLowerCase())throw Error('Publication sender or registry mismatch');
 if(BigInt(tx.value||'0x0')!==0n)throw Error('Publication sent nonzero ETH value');
 const artifact=loadArtifact('ListProofRegistry',ethers),iface=new ethers.Interface(artifact.abi);
 const expected=iface.encodeFunctionData('publish',[1n,commitment.root,commitment.contentHash,BigInt(commitment.count)]);
 if(tx.input?.toLowerCase()!==expected.toLowerCase())throw Error('Publication calldata differs from canonical epoch-1 commitment');
 const event=(receipt.logs||[]).filter(log=>log.address?.toLowerCase()===REGISTRY.toLowerCase()).map(log=>{try{return iface.parseLog(log)}catch{return null}}).find(log=>log?.name==='RootUpdated');
 if(!event||event.args.epoch!==1n||event.args.root.toLowerCase()!==commitment.root.toLowerCase()||event.args.contentHash.toLowerCase()!==commitment.contentHash.toLowerCase()||event.args.count!==BigInt(commitment.count))throw Error('RootUpdated event missing or mismatched');
 const state=await readPublicationState();
 if(state.epoch!=='1'||state.root.toLowerCase()!==commitment.root.toLowerCase()||state.contentHash.toLowerCase()!==commitment.contentHash.toLowerCase()||state.count!==String(commitment.count)||state.datasetId.toLowerCase()!==commitment.datasetKey.toLowerCase()||state.publisher.toLowerCase()!==PUBLISHER.toLowerCase()||!state.registryCodeMatches||!state.gateCodeMatches||state.gateRegistry.toLowerCase()!==REGISTRY.toLowerCase())throw Error('Post-publication registry or gate state mismatch');
 return {schema:'listproof-sepolia-root-publication-v1',chainId:11155111,contractAddress:REGISTRY,transactionHash:receipt.transactionHash,blockNumber:Number(BigInt(receipt.blockNumber)),gasUsed:BigInt(receipt.gasUsed).toString(),publisher:PUBLISHER,epoch:1,root:commitment.root,contentHash:commitment.contentHash,count:commitment.count,datasetId:commitment.datasetKey,explorerTx:`https://sepolia.etherscan.io/tx/${receipt.transactionHash}`,verifiedAt:new Date().toISOString(),verification:'Sepolia receipt, exact calldata, RootUpdated event, runtime bytecode, registry and Gate state',postState:state};
}
async function readBody(req){let body='';for await(const part of req){body+=part;if(body.length>2000)throw Object.assign(Error('Request too large'),{status:413});}return JSON.parse(body);}

const server=createServer(async(req,res)=>{
 try{
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))throw Object.assign(Error('Local access only'),{status:403});
  const url=new URL(req.url,`http://${HOST}:${PORT}`);
  if(req.method==='GET'&&url.pathname==='/')return file(res,readFileSync(new URL('../web/deploy.html',import.meta.url)),'text/html; charset=utf-8');
  if(req.method==='GET'&&url.pathname==='/deploy.js')return file(res,readFileSync(new URL('../web/deploy.js',import.meta.url)),'text/javascript; charset=utf-8');
  if(req.method==='GET'&&url.pathname==='/ethers.js'){
   if(!existsSync(new URL('../deploy-ui/node_modules/ethers/dist/ethers.umd.min.js',import.meta.url)))throw Object.assign(Error('Install ethers in deploy-ui first'),{status:503});
   return file(res,readFileSync(new URL('../deploy-ui/node_modules/ethers/dist/ethers.umd.min.js',import.meta.url)),'text/javascript; charset=utf-8');
  }
  if(req.method==='GET'&&url.pathname==='/api/config')return json(res,200,{account:ACCOUNT,chainId:11155111,datasetId:DATASET_ID,rpc:'Ethereum Sepolia',artifactSettings:'solc 0.8.24; optimizer 200; viaIR'});
  if(req.method==='GET'&&url.pathname==='/api/publication/epoch-1'){
   const commitment=epochOneCommitment(),state=await readPublicationState();
   try{assertPublishable(state,commitment);return json(res,200,{ready:true,commitment,state});}
   catch(error){return json(res,200,{ready:false,reason:error.message,commitment,state});}
  }
  if(req.method==='GET'&&url.pathname.startsWith('/api/artifact/')){const ethers=await ethersModule();return json(res,200,loadArtifact(url.pathname.split('/').at(-1),ethers));}
  if(req.method==='GET'&&url.pathname==='/api/evidence'){
   const saved=loadEvidence();if(!saved.registry)return json(res,200,{registry:null,gate:null});
   const registry=await verifyOnChain('ListProofRegistry',saved.registry.transactionHash);
   const gate=saved.gate?await verifyOnChain('ListProofGate',saved.gate.transactionHash,registry.address):null;
   return json(res,200,{registry,gate});
  }
  if(req.method==='POST'&&url.pathname==='/api/evidence'){
   if(req.headers.origin!==`http://${HOST}:${PORT}`)throw Object.assign(Error('Invalid origin'),{status:403});
   const {contract,transactionHash}=await readBody(req);
   const saved=loadEvidence();
   if(!['ListProofRegistry','ListProofGate'].includes(contract))throw Object.assign(Error('Invalid contract'),{status:400});
   const key=contract==='ListProofRegistry'?'registry':'gate';
   if(saved[key]&&saved[key].transactionHash.toLowerCase()!==transactionHash?.toLowerCase())throw Object.assign(Error('Existing verified deployment differs'),{status:409});
   let registryAddress;
   if(key==='gate'){
    if(!saved.registry)throw Object.assign(Error('Registry must be saved first'),{status:409});
    registryAddress=(await verifyOnChain('ListProofRegistry',saved.registry.transactionHash)).address;
   }
   const verified=await verifyOnChain(contract,transactionHash,registryAddress);
   saved[key]=verified;
   const temp=new URL('../evidence/sepolia-deployments.json.tmp',import.meta.url);
   writeFileSync(temp,JSON.stringify(saved,null,2)+'\n',{flag:'w'});renameSync(temp,evidenceUrl);
   return json(res,200,verified);
  }
  if(req.method==='POST'&&url.pathname==='/api/publication/epoch-1'){
   if(req.headers.origin!==`http://${HOST}:${PORT}`)throw Object.assign(Error('Invalid origin'),{status:403});
   const {transactionHash}=await readBody(req);
   const prior=existsSync(publicationUrl)?JSON.parse(readFileSync(publicationUrl,'utf8')):null;
   if(prior&&prior.transactionHash?.toLowerCase()!==transactionHash?.toLowerCase())throw Object.assign(Error('Different publication evidence already saved'),{status:409});
   const verified=await verifyPublication(transactionHash);
   const temp=new URL('../evidence/sepolia-root-publication.json.tmp',import.meta.url);
   writeFileSync(temp,JSON.stringify(verified,null,2)+'\n',{flag:'w'});renameSync(temp,publicationUrl);
   return json(res,200,verified);
  }
  return json(res,404,{error:'Not found'});
 }catch(error){return json(res,error.status||500,{error:error.message});}
});
if(import.meta.url===`file:///${process.argv[1]?.replaceAll('\\','/')}`)server.listen(PORT,HOST,()=>console.log(`ListProof MetaMask deployment: http://${HOST}:${PORT}`));
export {server,loadArtifact,DATASET_ID,ACCOUNT};
