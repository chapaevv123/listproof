import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

test('production staging refuses missing durable database configuration',async()=>{
 const env={...process.env,NODE_ENV:'production',LISTPROOF_REQUIRE_DATABASE:'1'};
 delete env.DATABASE_URL;delete env.LISTPROOF_DB_PATH;
 const child=spawn(process.execPath,['scripts/server.mjs'],{env,stdio:['ignore','pipe','pipe']});
 let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>output+=chunk.toString());
 const code=await new Promise(resolve=>child.once('exit',resolve));
 assert.notEqual(code,0);assert.match(output,/LISTPROOF_REQUIRE_DATABASE/);
});
