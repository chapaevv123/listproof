import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {epochOneCommitment,assertPublishable,matchesRuntimeBytecode,REGISTRY,GATE,PUBLISHER,ZERO} from '../src/publication.mjs';

const commitment=epochOneCommitment();
const state=()=>({chainId:11155111,registryAddress:REGISTRY,gateAddress:GATE,registryCodeMatches:true,gateCodeMatches:true,publisher:PUBLISHER,datasetId:commitment.datasetKey,gateRegistry:REGISTRY,epoch:'0',root:ZERO,contentHash:ZERO,count:'0'});

test('epoch-1 commitment uses canonical fixture and pinned CRE hash/root',()=>{
 assert.equal(commitment.epoch,1);
 assert.equal(commitment.count,3);
 assert.equal(commitment.root,'0xd5a80d20b41a1049e2a75edbc04761063113ea3002b8f575c4993284b8ab5888');
 assert.equal(commitment.contentHash,'0x847808cb140145db952ee309dc5229106e1923a0499ecd91e07dbe175fb42b57');
 assert.equal(commitment.datasetKey,'0xa911b05f7ffdc54a7c72dfc23ca6f7ccaa8e15eec7af7c2ef1215254db6ff9ed');
});

test('publication preparation rejects already published, wrong dataset/root and unsafe state',()=>{
 assert.equal(assertPublishable(state(),commitment),true);
 assert.throws(()=>assertPublishable({...state(),epoch:'1',root:commitment.root},commitment),/already published/);
 assert.throws(()=>assertPublishable({...state(),datasetId:'0x'+'11'.repeat(32)},commitment),/Dataset ID mismatch/);
 assert.throws(()=>assertPublishable({...state(),root:'0x'+'11'.repeat(32)},commitment),/Unexpected initial registry state/);
 assert.throws(()=>assertPublishable({...state(),contentHash:'0x'+'22'.repeat(32)},commitment),/Unexpected initial registry state/);
 assert.throws(()=>assertPublishable({...state(),registryCodeMatches:false},commitment),/bytecode mismatch/);
 assert.throws(()=>assertPublishable({...state(),publisher:GATE},commitment),/Unexpected publisher/);
 assert.throws(()=>assertPublishable({...state(),gateRegistry:PUBLISHER},commitment),/Gate references/);
 assert.throws(()=>assertPublishable({...state(),chainId:1},commitment),/Wrong chain/);
});

test('runtime bytecode comparison checks immutable values and all other bytes',t=>{
 const path=new URL('../out/ListProof.sol/ListProofRegistry.json',import.meta.url);
 if(!existsSync(path)){t.skip('Run forge build to generate ignored artifacts');return;}
 const artifact=JSON.parse(readFileSync(path,'utf8'));
 const runtime=Buffer.from(artifact.deployedBytecode.object.slice(2),'hex');
 for(const ref of Object.values(artifact.deployedBytecode.immutableReferences).flat())Buffer.from(commitment.datasetKey.slice(2),'hex').copy(runtime,ref.start);
 const hex='0x'+runtime.toString('hex');
 assert.equal(matchesRuntimeBytecode(hex,artifact,commitment.datasetKey),true);
 runtime[1]^=1;
 assert.equal(matchesRuntimeBytecode('0x'+runtime.toString('hex'),artifact,commitment.datasetKey),false);
 assert.equal(matchesRuntimeBytecode(hex,artifact,'0x'+'11'.repeat(32)),false);
 const gate=JSON.parse(readFileSync(new URL('../out/ListProof.sol/ListProofGate.json',import.meta.url),'utf8'));
 const gateRuntime=Buffer.from(gate.deployedBytecode.object.slice(2),'hex');
 const registryWord=Buffer.from(REGISTRY.slice(2).padStart(64,'0'),'hex');
 for(const ref of Object.values(gate.deployedBytecode.immutableReferences).flat())registryWord.copy(gateRuntime,ref.start);
 assert.equal(matchesRuntimeBytecode('0x'+gateRuntime.toString('hex'),gate,'0x'+registryWord.toString('hex')),true);
});
