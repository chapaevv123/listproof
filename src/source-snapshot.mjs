import {createHash} from 'node:crypto';

const officialHosts=new Set(['sanctionslistservice.ofac.treas.gov','sanctionslist.ofac.treas.gov','ofac.treasury.gov']);
const sha256=bytes=>'0x'+createHash('sha256').update(bytes).digest('hex');

// This validates a transport snapshot only. Extraction and legal scope require a
// separately reviewed parser, so callers must keep the dataset unverified.
export function prepareOfficialSourceSnapshot({sourceUrl,bytes,expectedSha256,retrievedAt}){
 const url=new URL(sourceUrl);
 if(url.protocol!=='https:'||!officialHosts.has(url.hostname)||url.username||url.password||url.search)throw Error('Unsupported official source URL');
 if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>20*1024*1024)throw Error('Source bytes required (20 MB maximum)');
 if(!/^0x[0-9a-f]{64}$/.test(expectedSha256))throw Error('Pinned SHA-256 required');
 if(!Number.isFinite(Date.parse(retrievedAt))||new Date(retrievedAt).toISOString()!==retrievedAt)throw Error('UTC retrieval timestamp required');
 const contentHash=sha256(bytes);
 if(contentHash!==expectedSha256)throw Error('Official source content hash mismatch');
 return Object.freeze({sourceUrl:url.toString(),contentHash,byteCount:bytes.length,retrievedAt,classification:'imported-unverified',readyForPublication:false,parserStatus:'not-implemented'});
}
