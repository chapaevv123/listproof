import {createHash} from 'node:crypto';
import {build} from './core.mjs';

const hash=bytes=>'0x'+createHash('sha256').update(bytes).digest('hex');
export function auditDataset(bytes,config){
 const contentHash=hash(bytes);
 if(contentHash!==config.expectedContentHash)throw Error('content hash mismatch');
 const data=JSON.parse(Buffer.from(bytes).toString('utf8'));
 if(data.schema!=='listproof-addresses-v1')throw Error('schema mismatch');
 if(data.chainId!==config.chainId||data.datasetId!==config.datasetId||data.epoch!==config.expectedEpoch)throw Error('version or dataset mismatch');
 const tree=build(data);
 if(tree.root!==config.expectedRoot)throw Error('root mismatch');
 return {chainId:data.chainId,datasetId:data.datasetId,epoch:data.epoch,root:tree.root,count:tree.addresses.length,contentHash,provenance:data.provenance};
}
export async function fetchAndAudit(config,fetcher=fetch){
 const response=await fetcher(config.datasetUrl);
 if(!response.ok)throw Error(`dataset HTTP ${response.status}`);
 return auditDataset(Buffer.from(await response.arrayBuffer()),config);
}
