import {createHash} from 'node:crypto';
const digest=x=>'0x'+createHash('sha256').update(x).digest('hex');
const b32=x=>Buffer.from(x.slice(2),'hex');
const u256=x=>Buffer.from(BigInt(x).toString(16).padStart(64,'0'),'hex');
const normalize=a=>{if(typeof a!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(a))throw Error('address');return a.toLowerCase()};
const datasetKey=s=>digest(Buffer.from(s,'utf8'));
const leaf=(c,a)=>digest(Buffer.concat([Buffer.from([0]),u256(c.chainId),b32(c.datasetKey),u256(c.epoch),Buffer.from(a.slice(2),'hex')]));
const parent=(a,b)=>digest(Buffer.concat([Buffer.from([1]),b32(a),b32(b)]));
const SCHEME='evm20-lowercase-sha256-v1';
const validHash = x => typeof x==='string' && /^0x[0-9a-f]{64}$/.test(x);
export function verifyMembership(c,root,count,p){
 try {
  if(!p||!Number.isSafeInteger(count)||count<1||!Number.isSafeInteger(p.index)||p.index<0||p.index>=count||!Array.isArray(p.siblings)||!validHash(root))return false;
  let hash=leaf(c,normalize(p.address)),i=p.index,n=count,k=0;
  while(n>1){const other=i^1;if(other<n){const sibling=p.siblings[k++];if(!validHash(sibling))return false;hash=i%2?parent(sibling,hash):parent(hash,sibling);}i=Math.floor(i/2);n=Math.ceil(n/2);}
  return k===p.siblings.length&&hash===root;
 }catch{return false;}
}
export function verifyNonMembership(proof,expected){
 try {
  const {context:c,root,count,target,left,right}=proof;
  if(c.scheme!==SCHEME||c.chainId!==expected.chainId||c.datasetId!==expected.datasetId||c.datasetKey!==datasetKey(c.datasetId)||c.epoch!==expected.epoch||root!==expected.root||!validHash(root)||!Number.isSafeInteger(count)||count<1||(expected.count!==undefined&&count!==expected.count)||normalize(target)!==target)return false;
  if(!left&&!right)return false;
  if(left&&(!verifyMembership(c,root,count,left)||!(normalize(left.address)<target)))return false;
  if(right&&(!verifyMembership(c,root,count,right)||!(target<normalize(right.address))))return false;
  if(left&&right)return left.index+1===right.index;
  if(left)return left.index===count-1;
  return right.index===0;
 }catch{return false;}
}
