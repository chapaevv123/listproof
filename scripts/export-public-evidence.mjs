import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {epochOneCommitment,REGISTRY,GATE,PUBLISHER} from '../src/publication.mjs';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const deployments=read('../evidence/sepolia-deployments.json');
const publication=read('../evidence/sepolia-root-publication.json');
const commitment=epochOneCommitment();
if(deployments.chainId!==11155111||deployments.registry?.address.toLowerCase()!==REGISTRY.toLowerCase()||deployments.gate?.address.toLowerCase()!==GATE.toLowerCase()||publication.chainId!==11155111||publication.contractAddress.toLowerCase()!==REGISTRY.toLowerCase()||publication.publisher.toLowerCase()!==PUBLISHER.toLowerCase()||publication.root!==commitment.root||publication.contentHash!==commitment.contentHash||publication.datasetId!==commitment.datasetKey||publication.count!==commitment.count||publication.epoch!==1)throw Error('Sepolia evidence differs from canonical fixture');
const proofUrl=new URL('../evidence/sepolia-proof-calls.json',import.meta.url);
let proofCheck={status:'not-run',description:'On-chain eth_call proof scenarios have not been captured'};
if(existsSync(proofUrl)){
 const proof=JSON.parse(readFileSync(proofUrl,'utf8'));
 if(proof.chainId!==11155111||proof.registry.toLowerCase()!==REGISTRY.toLowerCase()||proof.gate.toLowerCase()!==GATE.toLowerCase()||proof.commitment.root!==commitment.root||proof.results?.length!==6||proof.results.some(x=>!x.passed))throw Error('On-chain proof evidence is incomplete or inconsistent');
 proofCheck={status:'verified-read-only',blockNumber:proof.blockNumber,blockHash:proof.blockHash,verifiedAt:proof.verifiedAt,method:proof.method,results:proof.results.map(({name,expected,passed,reason})=>({name,expected,passed,reason}))};
}
const summary={schema:'listproof-public-evidence-v1',chainId:11155111,dataset:'synthetic',datasetId:commitment.datasetKey,epoch:1,root:commitment.root,contentHash:commitment.contentHash,count:commitment.count,registry:{address:REGISTRY,deployTx:deployments.registry.transactionHash,explorer:`https://sepolia.etherscan.io/address/${REGISTRY}`},gate:{address:GATE,deployTx:deployments.gate.transactionHash,explorer:`https://sepolia.etherscan.io/address/${GATE}`},rootPublication:{transactionHash:publication.transactionHash,blockNumber:publication.blockNumber,explorerTx:publication.explorerTx,verification:publication.verification},proofCheck,cre:{status:'local-simulation-only',logPath:'/evidence/cre-local-simulation.txt',onchainReceiverUpdate:false},limitation:'Synthetic dataset non-membership only; not sanctions compliance or legal clearance'};
writeFileSync(new URL('../data/sepolia-public.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({publication:summary.rootPublication.transactionHash,proofCheck:proofCheck.status},null,2));
