import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const base='http://127.0.0.1:4173';
const response=await fetch(base+'/api/proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:'0x0000000000000000000000000000000000000006',epoch:1,mode:'clean'})});
if(!response.ok)throw Error(`proof HTTP ${response.status}`);
const generated=await response.json();if(generated.status!=='verified'||!generated.receipt)throw Error('proof result');
const independentResponse=await fetch(base+'/api/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proof:generated.proof,againstEpoch:1})});
if(!independentResponse.ok)throw Error(`verify HTTP ${independentResponse.status}`);
const independently=await independentResponse.json();if(!independently.verified)throw Error('independent verification');
const receipt={...generated.receipt,independentVerification:independently};
const dir=new URL('../evidence/',import.meta.url);mkdirSync(dir,{recursive:true});
const path=fileURLToPath(new URL('local-receipt-epoch1.json',dir));writeFileSync(path,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({path,root:receipt.commitment.root,verified:true,chainStatus:receipt.chainStatus}));
