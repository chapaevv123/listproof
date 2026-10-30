export const CASE_STATUSES=Object.freeze(['Open','Under Review','Evidence Verified','Evidence Rejected','Closed']);
export const STORAGE_KEY='listproof:cases:v1';
const addressPattern=/^0x[0-9a-f]{40}$/;
const hashPattern=/^0x[0-9a-f]{64}$/;

export class CaseStore {
  constructor(storage,now=()=>new Date().toISOString(),id=()=>crypto.randomUUID()){
    this.storage=storage;this.now=now;this.id=id;
  }
  load(){
    const raw=this.storage.getItem(STORAGE_KEY);
    if(!raw)return [];
    const value=JSON.parse(raw);
    if(!Array.isArray(value)||value.some(x=>!x||typeof x.id!=='string'||!Array.isArray(x.events)))throw Error('Case workspace data is invalid');
    return value;
  }
  write(cases){this.storage.setItem(STORAGE_KEY,JSON.stringify(cases));}
  list(){return this.load().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  get(id){return this.load().find(x=>x.id===id)||null;}
  create(input){
    if(!addressPattern.test(input.address)||!hashPattern.test(input.root)||!Number.isSafeInteger(input.epoch)||input.epoch<1||typeof input.datasetId!=='string'||!input.datasetId)throw Error('Invalid case evidence');
    if(!['not-present','listed','invalid-proof','stale-proof'].includes(input.result))throw Error('Invalid screening result');
    const cases=this.load(),at=this.now(),id='LP-'+this.id().slice(0,12).toUpperCase();
    const item={id,address:input.address,datasetId:input.datasetId,datasetClassification:'synthetic',chainId:11155111,epoch:input.epoch,root:input.root,result:input.result,status:'Open',createdAt:at,updatedAt:at,receipt:input.receipt||null,initialVerification:input.verification||null,latestVerification:input.verification||null,notes:[],events:[{id:this.id(),at,type:'CASE_CREATED',detail:'Screening saved in this browser'}]};
    cases.push(item);this.write(cases);return item;
  }
  mutate(id,change){
    const cases=this.load(),item=cases.find(x=>x.id===id);if(!item)throw Error('Case not found');
    const at=this.now();change(item,at);item.updatedAt=at;this.write(cases);return item;
  }
  status(id,next){
    if(!CASE_STATUSES.includes(next))throw Error('Invalid case status');
    return this.mutate(id,(item,at)=>{if(next==='Evidence Verified'&&!item.latestVerification?.verified)throw Error('Reverify a valid proof before marking evidence verified');if(item.status===next)return;const previous=item.status;item.status=next;item.events.push({id:this.id(),at,type:'STATUS_CHANGED',detail:previous+' → '+next});});
  }
  note(id,text){
    const value=String(text||'').trim();if(!value||value.length>2000)throw Error('Note must be 1–2000 characters');
    return this.mutate(id,(item,at)=>{item.notes.push({id:this.id(),at,text:value});item.events.push({id:this.id(),at,type:'NOTE_ADDED',detail:'Analyst note added'});});
  }
  reverification(id,result){
    if(typeof result?.verified!=='boolean'||!Number.isSafeInteger(result?.epoch)||!hashPattern.test(result?.root))throw Error('Invalid verification result');
    return this.mutate(id,(item,at)=>{item.latestVerification={...result,at};item.events.push({id:this.id(),at,type:'EVIDENCE_REVERIFIED',detail:result.verified?'Proof verified against selected commitment':'Proof rejected against selected commitment'});});
  }
}
