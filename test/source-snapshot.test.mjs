import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareOfficialSourceSnapshot} from '../src/source-snapshot.mjs';

const bytes=Buffer.from('synthetic test bytes');
const expectedSha256='0x'+createHash('sha256').update(bytes).digest('hex');
const input={sourceUrl:'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/sdn.csv',bytes,expectedSha256,retrievedAt:'2026-10-30T00:00:00.000Z'};
test('official-source transport snapshot is pinned and never auto-classified verified',()=>{
 const result=prepareOfficialSourceSnapshot(input);
 assert.equal(result.contentHash,expectedSha256);
 assert.equal(result.classification,'imported-unverified');
 assert.equal(result.readyForPublication,false);
 for(const change of [{expectedSha256:'0x'+'0'.repeat(64)},{sourceUrl:'https://evil.example/sdn.csv'},{sourceUrl:'http://ofac.treasury.gov/sdn.csv'},{sourceUrl:'https://ofac.treasury.gov/sdn.csv?token=secret'},{bytes:Buffer.alloc(0)}])assert.throws(()=>prepareOfficialSourceSnapshot({...input,...change}));
});
