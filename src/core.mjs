import { createHash } from 'node:crypto';

export const SCHEME = 'evm20-lowercase-sha256-v1';
const H = b => createHash('sha256').update(b).digest();
const word = n => { const x=BigInt(n); if(x<0n || x>=1n<<256n) throw Error('uint256'); return Buffer.from(x.toString(16).padStart(64,'0'),'hex'); };
const hex = b => '0x'+b.toString('hex');
const bytes32 = h => { if(!/^0x[0-9a-fA-F]{64}$/.test(h)) throw Error('bytes32'); return Buffer.from(h.slice(2),'hex'); };
export const normalize = a => { if(typeof a!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(a)) throw Error('Invalid EVM address'); return a.toLowerCase(); };
export const datasetKey = s => hex(H(Buffer.from(s,'utf8')));
export function context(data) {
 if(data.schema!=='listproof-addresses-v1'||!Number.isSafeInteger(data.epoch)||data.epoch<1||!/^\d+$/.test(data.chainId)||!data.datasetId) throw Error('Dataset schema');
 return {chainId:data.chainId,datasetId:data.datasetId,datasetKey:datasetKey(data.datasetId),epoch:data.epoch,scheme:SCHEME};
}
export function leaf(c,a) { return hex(H(Buffer.concat([Buffer.from([0]),word(c.chainId),bytes32(c.datasetKey),word(c.epoch),Buffer.from(normalize(a).slice(2),'hex')]))); }
export function parent(a,b) { return hex(H(Buffer.concat([Buffer.from([1]),bytes32(a),bytes32(b)]))); }
export function build(data) {
 const c=context(data); const addresses=data.addresses.map(normalize).sort();
 if(!addresses.length||addresses.some((a,i)=>i>0&&a===addresses[i-1])) throw Error('Empty or duplicate dataset');
 const levels=[addresses.map(a=>leaf(c,a))];
 while(levels.at(-1).length>1){const prev=levels.at(-1), next=[]; for(let i=0;i<prev.length;i+=2) next.push(i+1<prev.length?parent(prev[i],prev[i+1]):prev[i]); levels.push(next);}
 return {context:c,addresses,levels,root:levels.at(-1)[0]};
}
export function member(tree,index){
 if(!Number.isInteger(index)||index<0||index>=tree.addresses.length) throw Error('Index');
 let i=index; const siblings=[]; for(const level of tree.levels.slice(0,-1)){const other=i^1;if(other<level.length)siblings.push(level[other]);i=Math.floor(i/2);}
 return {address:tree.addresses[index],index,siblings};
}
export function nonmember(tree,address){
 const target=normalize(address);let lo=0,hi=tree.addresses.length;while(lo<hi){const mid=(lo+hi)>>1;if(tree.addresses[mid]<target)lo=mid+1;else hi=mid;}
 if(tree.addresses[lo]===target) throw Error('Address is listed');
 return {context:tree.context,root:tree.root,count:tree.addresses.length,target,left:lo?member(tree,lo-1):null,right:lo<tree.addresses.length?member(tree,lo):null};
}
