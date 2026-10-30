import {openPlatformDb} from '../src/platform-db.mjs';

const db=await openPlatformDb({migrate:true});
try{
 const rows=await db.query('SELECT version,applied_at FROM schema_migrations ORDER BY version');
 console.log(JSON.stringify({ok:true,database:db.kind,migrations:rows}));
}finally{await db.close();}
