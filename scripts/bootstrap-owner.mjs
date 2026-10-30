import {openPlatformDb} from '../src/platform-db.mjs';
import {bootstrapOwner} from '../src/platform-auth.mjs';
const db=await openPlatformDb();
try{
 const result=await bootstrapOwner(db,{email:process.env.LISTPROOF_OWNER_EMAIL,password:process.env.LISTPROOF_OWNER_PASSWORD,orgSlug:process.env.LISTPROOF_ORG_SLUG||'listproof',orgName:process.env.LISTPROOF_ORG_NAME||'ListProof Workspace'});
 console.log(JSON.stringify({created:true,email:result.email,orgSlug:result.orgSlug}));
}finally{await db.close();}
