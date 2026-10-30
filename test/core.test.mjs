import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build,normalize,nonmember,member,leaf} from '../src/core.mjs';
import {verifyMembership,verifyNonMembership} from '../src/verify.mjs';
const data=JSON.parse(readFileSync(new URL('../data/epoch-1.json',import.meta.url)));
const data2=JSON.parse(readFileSync(new URL('../data/epoch-2.json',import.meta.url)));
const addr=n=>'0x'+n.toString(16).padStart(40,'0');
const t=build(data), expected={...t.context,root:t.root,count:t.addresses.length};
test('normalization and duplicate rejection',()=>{
 assert.equal(normalize('0x'+'AB'.repeat(20)),'0x'+'ab'.repeat(20));
 assert.throws(()=>normalize('0x12'));
 assert.throws(()=>build({...data,addresses:[addr(2),addr(2).toUpperCase().replace('0X','0x')]}));
});
test('membership, order and roots',()=>{
 for(let i=0;i<t.addresses.length;i++) assert.equal(verifyMembership(t.context,t.root,t.addresses.length,member(t,i)),true);
 const p=member(t,1);p.siblings[0]='0x'+'00'.repeat(32);assert.equal(verifyMembership(t.context,t.root,t.addresses.length,p),false);
 assert.notEqual(leaf(t.context,addr(2)),leaf({...t.context,epoch:2},addr(2)));
});
test('non-membership boundary and middle',()=>{
 for(const n of [1,3,6,8,10]) assert.equal(verifyNonMembership(nonmember(t,addr(n)),expected),true);
 assert.throws(()=>nonmember(t,addr(5)));
});
test('forgery, stale epoch, root and neighbor substitution',()=>{
 const p=nonmember(t,addr(6));
 assert.equal(verifyNonMembership({...p,target:addr(5)},expected),false);
 assert.equal(verifyNonMembership({...p,right:p.left},expected),false);
 assert.equal(verifyNonMembership({...p,root:'0x'+'00'.repeat(32)},expected),false);
 assert.equal(verifyNonMembership(p,{...expected,epoch:2}),false);
 assert.equal(verifyNonMembership(p,{...expected,datasetId:'other'}),false);
 assert.equal(verifyNonMembership(p,{...expected,chainId:'1'}),false);
 assert.equal(verifyNonMembership({...p,count:p.count+1},expected),false);
 const t2=build(data2); assert.equal(verifyNonMembership(p,{...t2.context,root:t2.root}),false);
});
test('randomized sorted sets and absent targets',()=>{
 let seed=123456; const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)%1000);
 for(let round=0;round<80;round++){
  const values=[...new Set(Array.from({length:1+rnd()%20},()=>rnd()))].sort((a,b)=>a-b);
  const tree=build({...data,addresses:values.map(addr)});const e={...tree.context,root:tree.root};
  for(const v of values) assert.equal(verifyMembership(tree.context,tree.root,values.length,member(tree,values.indexOf(v))),true);
  for(let j=0;j<20;j++){const v=rnd();if(!values.includes(v))assert.equal(verifyNonMembership(nonmember(tree,addr(v)),e),true);}
 }
});
