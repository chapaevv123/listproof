import {readFileSync} from 'node:fs';
import {fetchAndAudit} from '../src/adapter.mjs';
const config=JSON.parse(readFileSync(new URL('../cre/listproof/config.local.json',import.meta.url)));
try{console.log(JSON.stringify(await fetchAndAudit(config),null,2))}catch(e){console.error(`Preflight failed: ${e.message}`);process.exitCode=1}
