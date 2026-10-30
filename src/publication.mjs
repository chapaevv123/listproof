import {readFileSync} from 'node:fs';
import {auditDataset} from './adapter.mjs';
import {datasetKey} from './core.mjs';

export const REGISTRY='0x1607Af4E1DA1C06362871443d2e95C367B984Efa';
export const GATE='0xf88F9870fe6e135d5bD56852750c8af8a466A9A3';
export const PUBLISHER='0x765fb7e6a0BdDDc29f57eeCE34AEda0Fb318805d';
export const ZERO='0x'+'00'.repeat(32);

export function epochOneCommitment(){
 const data=JSON.parse(readFileSync(new URL('../data/epoch-1.json',import.meta.url),'utf8'));
 const canonical=Buffer.from(JSON.stringify(data),'utf8');
 const pinned=JSON.parse(readFileSync(new URL('../cre/listproof/config.local.json',import.meta.url),'utf8'));
 const audited=auditDataset(canonical,pinned);
 if(audited.epoch!==1||audited.chainId!=='11155111'||audited.datasetId!=='listproof-synthetic-demo'||audited.count!==3)throw Error('Unexpected epoch-1 fixture');
 return {...audited,datasetKey:datasetKey(audited.datasetId),canonicalBytes:canonical.length};
}

export function assertPublishable(state,commitment=epochOneCommitment()){
 if(state.chainId!==11155111)throw Error('Wrong chain');
 if(state.registryAddress?.toLowerCase()!==REGISTRY.toLowerCase()||state.gateAddress?.toLowerCase()!==GATE.toLowerCase())throw Error('Deployment address mismatch');
 if(!state.registryCodeMatches||!state.gateCodeMatches)throw Error('Deployed bytecode mismatch');
 if(state.publisher?.toLowerCase()!==PUBLISHER.toLowerCase())throw Error('Unexpected publisher');
 if(state.datasetId?.toLowerCase()!==commitment.datasetKey.toLowerCase())throw Error('Dataset ID mismatch');
 if(state.gateRegistry?.toLowerCase()!==REGISTRY.toLowerCase())throw Error('Gate references another registry');
 if(BigInt(state.epoch)!==0n)throw Error('Epoch 1 already published or registry advanced');
 if(state.root?.toLowerCase()!==ZERO||state.contentHash?.toLowerCase()!==ZERO||BigInt(state.count)!==0n)throw Error('Unexpected initial registry state');
 return true;
}

export function matchesRuntimeBytecode(actualHex,artifact,immutableWord){
 const expectedHex=artifact?.deployedBytecode?.object;
 if(typeof actualHex!=='string'||typeof expectedHex!=='string'||!/^0x[0-9a-fA-F]*$/.test(actualHex)||!/^0x[0-9a-fA-F]*$/.test(expectedHex))return false;
 const actual=Buffer.from(actualHex.slice(2),'hex'),expected=Buffer.from(expectedHex.slice(2),'hex');
 if(actual.length!==expected.length||!/^0x[0-9a-fA-F]{64}$/.test(immutableWord))return false;
 const word=Buffer.from(immutableWord.slice(2),'hex');
 const references=Object.values(artifact.deployedBytecode.immutableReferences||{}).flat();
 if(!references.length)return false;
 for(const ref of references){if(ref.length!==32||ref.start<0||ref.start+ref.length>expected.length)return false;word.copy(expected,ref.start);}
 return actual.equals(expected);
}
