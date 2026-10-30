import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditDataset} from '../src/adapter.mjs';
import {epochOneCommitment,REGISTRY} from '../src/publication.mjs';
const root=new URL('../',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,root)));
const dataset=name=>Buffer.from(JSON.stringify(read(`data/${name}.json`)));
test('pinned CRE target configurations exercise intended negative conditions locally',()=>{
 const cases=[
  ['bad-hash','epoch-1','content hash'],
  ['bad-root','epoch-1','root mismatch'],
  ['stale','epoch-2','version or dataset'],
  ['invalid-schema','invalid-schema','schema mismatch'],
 ];
 for(const [target,fixture,message] of cases){
  const config=read(`cre/listproof/config.${target}.json`);
  assert.throws(()=>auditDataset(dataset(fixture),config),new RegExp(message),target);
 }
 const unavailable=read('cre/listproof/config.unavailable.json');
 assert.match(unavailable.datasetUrl,/\/dataset\/unavailable$/);
});
test('on-chain CRE audit config matches published epoch-1 commitment',()=>{
 const config=read('cre/listproof/config.onchain.json');
 const commitment=epochOneCommitment();
 assert.equal(config.mode,'audit-current');
 assert.equal(config.registryAddress.toLowerCase(),REGISTRY.toLowerCase());
 assert.equal(config.receiverAddress,'');
 assert.equal(config.expectedRoot,commitment.root);
 assert.equal(config.expectedContentHash,commitment.contentHash);
 assert.equal(config.expectedEpoch,1);
 assert.deepEqual(auditDataset(dataset('epoch-1'),config).root,commitment.root);
 const stale=read('cre/listproof/config.onchain-stale.json');
 assert.equal(stale.mode,'audit-current');assert.equal(stale.expectedEpoch,2);
 assert.equal(stale.registryAddress.toLowerCase(),REGISTRY.toLowerCase());
});
