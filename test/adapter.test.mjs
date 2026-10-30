import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {auditDataset,fetchAndAudit} from '../src/adapter.mjs';
const config=JSON.parse(readFileSync(new URL('../cre/listproof/config.local.json',import.meta.url)));
const data=JSON.parse(readFileSync(new URL('../data/epoch-1.json',import.meta.url)));
const bytes=x=>Buffer.from(JSON.stringify(x));
const digest=b=>'0x'+createHash('sha256').update(b).digest('hex');
test('pinned adapter report and failure conditions',async()=>{
 const report=auditDataset(bytes(data),config);assert.equal(report.root,config.expectedRoot);assert.equal(report.contentHash,config.expectedContentHash);
 assert.throws(()=>auditDataset(bytes({...data,addresses:[...data.addresses,'0x000000000000000000000000000000000000000a']}),config),/content hash/);
 const invalid={...data,schema:'wrong'},badBytes=bytes(invalid);assert.throws(()=>auditDataset(badBytes,{...config,expectedContentHash:digest(badBytes)}),/schema/);
 const stale={...data,epoch:2},staleBytes=bytes(stale);assert.throws(()=>auditDataset(staleBytes,{...config,expectedContentHash:digest(staleBytes)}),/version/);
 assert.throws(()=>auditDataset(bytes(data),{...config,expectedRoot:'0x'+'00'.repeat(32)}),/root/);
 await assert.rejects(fetchAndAudit(config,async()=>{throw Error('network unavailable')}),/network unavailable/);
 await assert.rejects(fetchAndAudit(config,async()=>({ok:false,status:503})),/dataset HTTP 503/);
});
