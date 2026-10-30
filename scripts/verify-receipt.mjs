import {readFileSync} from 'node:fs';
import {verifyNonMembership} from '../src/verify.mjs';

const [file,...args]=process.argv.slice(2);
const option=name=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined};
const trustedRoot=option('--root'),trustedEpoch=option('--epoch');
if(!file||!/^0x[0-9a-f]{64}$/.test(trustedRoot||'')||!/^\d+$/.test(trustedEpoch||'')){
 console.error('Usage: node scripts/verify-receipt.mjs receipt.json --root 0x<64 lowercase hex> --epoch <integer>');process.exit(2);
}
try{
 const receipt=JSON.parse(readFileSync(file,'utf8'));
 if(receipt.kind!=='listproof-local-proof-v1')throw Error('receipt kind');
 const c=receipt.commitment;
 const trusted={chainId:c.chainId,datasetId:c.datasetId,epoch:Number(trustedEpoch),root:trustedRoot};
 const valid=receipt.proof?.root===c.root&&c.root===trustedRoot&&c.epoch===trusted.epoch&&verifyNonMembership(receipt.proof,trusted);
 console.log(JSON.stringify({verified:valid,root:trustedRoot,epoch:trusted.epoch,target:receipt.proof?.target}));
 if(!valid)process.exitCode=1;
}catch(error){console.error(`Verification failed: ${error.message}`);process.exitCode=1;}
