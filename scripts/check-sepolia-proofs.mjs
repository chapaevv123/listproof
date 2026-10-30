import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {build,nonmember} from '../src/core.mjs';
import {epochOneCommitment,REGISTRY,GATE,PUBLISHER,matchesRuntimeBytecode} from '../src/publication.mjs';

const require=createRequire(new URL('../deploy-ui/package.json',import.meta.url));
const ethers=require('ethers');
const rpcUrl=process.env.LISTPROOF_SEPOLIA_RPC_URL||'https://ethereum-sepolia-rpc.publicnode.com';
if(!rpcUrl.startsWith('https://'))throw Error('HTTPS Sepolia RPC required');
const provider=new ethers.JsonRpcProvider(rpcUrl);
const commitment=epochOneCommitment();
const published=JSON.parse(readFileSync(new URL('../evidence/sepolia-root-publication.json',import.meta.url),'utf8'));
const deployed=JSON.parse(readFileSync(new URL('../evidence/sepolia-deployments.json',import.meta.url),'utf8'));
const artifact=JSON.parse(readFileSync(new URL('../out/ListProof.sol/ListProofGate.json',import.meta.url),'utf8'));
const registryArtifact=JSON.parse(readFileSync(new URL('../out/ListProof.sol/ListProofRegistry.json',import.meta.url),'utf8'));
const iface=new ethers.Interface(artifact.abi);
const dataset=JSON.parse(readFileSync(new URL('../data/epoch-1.json',import.meta.url),'utf8'));
const tree=build(dataset);
const a=n=>'0x'+n.toString(16).padStart(40,'0');
const toStruct=p=>({epoch:BigInt(p.context.epoch),root:p.root,count:BigInt(p.count),target:p.target,hasLeft:!!p.left,left:p.left?{account:p.left.address,index:BigInt(p.left.index),siblings:p.left.siblings}:{account:ethers.ZeroAddress,index:0n,siblings:[]},hasRight:!!p.right,right:p.right?{account:p.right.address,index:BigInt(p.right.index),siblings:p.right.siblings}:{account:ethers.ZeroAddress,index:0n,siblings:[]}});
const hexBlock=n=>'0x'+n.toString(16);
const read=async(address,contractIface,name,args,block)=>contractIface.decodeFunctionResult(name,await provider.send('eth_call',[{to:address,data:contractIface.encodeFunctionData(name,args)},block]))[0];
const revertReason=error=>{
 const raw=error?.data||error?.info?.error?.data||error?.error?.data;
 if(typeof raw==='string'&&raw.startsWith('0x')){
  try{const decoded=new ethers.Interface(['error Error(string)']).parseError(raw);if(decoded?.name==='Error')return decoded.args[0];}catch{}
 }
 const message=String(error?.shortMessage||error?.message||error);
 return /\bproof\b/i.test(message)?'proof':message.slice(0,220);
};
async function main(){
 if((await provider.getNetwork()).chainId!==11155111n)throw Error('Wrong RPC chain');
 if(deployed.registry?.address.toLowerCase()!==REGISTRY.toLowerCase()||deployed.gate?.address.toLowerCase()!==GATE.toLowerCase())throw Error('Deployment evidence addresses differ');
 if(published.contractAddress.toLowerCase()!==REGISTRY.toLowerCase()||published.root!==commitment.root||published.contentHash!==commitment.contentHash||published.datasetId!==commitment.datasetKey||published.epoch!==1)throw Error('Root publication evidence differs from canonical fixture');
 const block=await provider.getBlockNumber(),tag=hexBlock(block),blockHash=(await provider.getBlock(block))?.hash;
 if(!blockHash)throw Error('Sepolia block hash unavailable');
 const regIface=new ethers.Interface(registryArtifact.abi);
 const [registryCode,gateCode,epoch,root,hash,count,datasetId,publisher,gateRegistry,nonce,balance]=await Promise.all([
  provider.send('eth_getCode',[REGISTRY,tag]),provider.send('eth_getCode',[GATE,tag]),
  read(REGISTRY,regIface,'epoch',[],tag),read(REGISTRY,regIface,'root',[],tag),read(REGISTRY,regIface,'contentHash',[],tag),read(REGISTRY,regIface,'count',[],tag),
  read(REGISTRY,regIface,'datasetId',[],tag),read(REGISTRY,regIface,'publisher',[],tag),read(GATE,iface,'registry',[],tag),
  read(GATE,iface,'nonces',[PUBLISHER],tag),read(GATE,iface,'balanceOf',[PUBLISHER],tag)
 ]);
 if(!matchesRuntimeBytecode(registryCode,registryArtifact,commitment.datasetKey)||!matchesRuntimeBytecode(gateCode,artifact,'0x'+REGISTRY.slice(2).padStart(64,'0')))throw Error('Runtime bytecode mismatch');
 if(epoch!==1n||root.toLowerCase()!==commitment.root.toLowerCase()||hash.toLowerCase()!==commitment.contentHash.toLowerCase()||count!==BigInt(commitment.count)||datasetId.toLowerCase()!==commitment.datasetKey.toLowerCase()||publisher.toLowerCase()!==PUBLISHER.toLowerCase()||gateRegistry.toLowerCase()!==REGISTRY.toLowerCase())throw Error('On-chain Registry/Gate state differs from pinned evidence');
 if(balance<1n)throw Error('Publisher lacks test-ledger balance for eth_call scenarios');
 const clean=toStruct(nonmember(tree,a(6)));
 const low=toStruct(nonmember(tree,a(1)));
 const high=toStruct(nonmember(tree,a(10)));
 const listed={...clean,target:a(5)};
 const tampered={...clean,left:{...clean.left,siblings:[ethers.ZeroHash,...clean.left.siblings.slice(1)]}};
 const stale={...clean,epoch:0n};
 const scenarios=[['valid-middle',a(6),clean,true],['listed-rejected',a(5),listed,false],['tampered-rejected',a(6),tampered,false],['stale-epoch-rejected',a(6),stale,false],['lower-boundary',a(1),low,true],['upper-boundary',a(10),high,true]];
 const results=[];
 for(const [name,to,proof,expectSuccess] of scenarios){
  const data=iface.encodeFunctionData('transfer',[to,1n,nonce,proof]);
  let success=false,returnData=null,reason=null;
  try{returnData=await provider.send('eth_call',[{from:PUBLISHER,to:GATE,data,value:'0x0'},tag]);success=true;}
  catch(error){reason=revertReason(error);}
  const passed=expectSuccess?success&&returnData==='0x':!success&&reason==='proof';
  results.push({name,expected:expectSuccess?'success':'revert: proof',passed,returnData,reason,callData:data});
 }
 if((await provider.getBlock(block))?.hash!==blockHash)throw Error('Sepolia block reorganized during proof checks');
 const evidence={schema:'listproof-sepolia-proof-calls-v1',chainId:11155111,blockNumber:block,blockHash,verifiedAt:new Date().toISOString(),registry:REGISTRY,gate:GATE,from:PUBLISHER,nonce:nonce.toString(),publisherBalance:balance.toString(),commitment:{epoch:1,root:commitment.root,contentHash:commitment.contentHash,count:commitment.count,datasetId:commitment.datasetKey},method:'eth_call at fixed Sepolia block; no transaction sent',results};
 console.log(JSON.stringify({blockNumber:block,results:results.map(({name,expected,passed,reason})=>({name,expected,passed,reason}))},null,2));
 if(results.some(x=>!x.passed))throw Error('One or more on-chain proof scenarios failed; no success evidence saved');
 const target=new URL('../evidence/sepolia-proof-calls.json',import.meta.url);
 if(existsSync(target))throw Error('Evidence file already exists; preserve it before another capture');
 writeFileSync(target,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
 console.log(`Verified evidence saved: ${target.pathname}`);
}
main().catch(error=>{console.error(`Sepolia proof check failed: ${error.message||error.code||error.cause?.code||error.cause?.message||error.name||'unknown RPC error'}`);process.exitCode=1;});
