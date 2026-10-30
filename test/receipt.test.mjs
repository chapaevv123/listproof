import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync,mkdtempSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {build,nonmember} from '../src/core.mjs';
test('portable receipt verifier requires trusted root and epoch',()=>{
 const tree=build(JSON.parse(readFileSync(new URL('../data/epoch-1.json',import.meta.url))));
 const receipt={kind:'listproof-local-proof-v1',commitment:{...tree.context,root:tree.root,count:tree.addresses.length},proof:nonmember(tree,'0x0000000000000000000000000000000000000006')};
 const dir=mkdtempSync(join(tmpdir(),'listproof-')),file=join(dir,'receipt.json');writeFileSync(file,JSON.stringify(receipt));
 const run=(root,epoch)=>spawnSync(process.execPath,['scripts/verify-receipt.mjs',file,'--root',root,'--epoch',String(epoch)],{encoding:'utf8'});
 try{assert.equal(run(tree.root,1).status,0);assert.equal(run(tree.root,2).status,1);assert.equal(run('0x'+'00'.repeat(32),1).status,1)}
 finally{unlinkSync(file);rmdirSync(dir)}
});
