// Published history: one Firestore document per KST day (feedDays/YYYY-MM-DD[_n]).
// Private translation backlog: a few chunk documents (pending/cN), never one doc per item,
// so a worker run costs tens of reads/writes instead of hundreds (Spark: 50k reads, 20k writes/day).
const DAY = 86400000, KEEP_DAYS = 30, PENDING_DAYS = 7, DOC_BYTES = 800000;
const visible = i => !i.categoryReview && (i.translated === true || (i.categories || []).includes('korwar'));
const kstDate = value => new Date(new Date(value).getTime()+9*3600000).toISOString().slice(0,10);
const bytes = value => Buffer.byteLength(JSON.stringify(value));
function prepare(items) {
  const ordered = [...new Map(items.map(i=>[i.id,i])).values()].sort((a,b)=>String(b.publishedAt).localeCompare(String(a.publishedAt)));
  return {published:ordered.filter(visible),pending:ordered.filter(i=>!visible(i))};
}
function dayDocuments(items, metadata = {}) {
  const docs = new Map();
  for (const item of prepare(items).published) {
    const date=kstDate(item.publishedAt); let part=1, key=date;
    while (docs.has(key) && bytes({...docs.get(key),items:[...docs.get(key).items,item]})>DOC_BYTES) key=date+'_'+(++part);
    const doc=docs.get(key)||{date,part,items:[],updatedAt:metadata.updatedAt||new Date().toISOString()};
    doc.items.push(item);
    if(bytes(doc)>DOC_BYTES)throw Error('Item exceeds feed day document capacity: '+item.id);
    docs.set(key,doc);
  }
  return docs;
}
// Newest first, packed into as few documents as possible. Stable order keeps older chunks unchanged.
function pendingChunks(items) {
  const chunks=[];let current=[];
  for(const item of items){
    if(bytes({items:[item]})>DOC_BYTES)continue; // a single oversized record cannot be stored
    if(current.length&&bytes({items:[...current,item]})>DOC_BYTES){chunks.push(current);current=[]}
    current.push(item);
  }
  if(current.length)chunks.push(current);
  return new Map(chunks.map((list,n)=>['c'+n,{items:list}]));
}
// Last state read from / written to Firestore during this process, per database.
const cache = new WeakMap();
async function snapshot(db, collection) { return (await db.collection(collection).get()).docs.map(d=>({id:d.id||d.ref?.path?.split('/').at(-1),data:()=>d.data()})); }
async function state(db) {
  if(cache.has(db))return cache.get(db);
  const [days,pending]=await Promise.all([snapshot(db,'feedDays'),snapshot(db,'pending')]);
  const value={days:new Map(days.map(d=>[d.id,d.data()])),pending:new Map(pending.map(d=>[d.id,d.data()]))};
  cache.set(db,value);return value;
}
// Older per-item pending/{id} documents are still read, then replaced by chunks.
const pendingItems = docs => [...docs.values()].flatMap(v=>Array.isArray(v?.items)?v.items:v?.id?[v]:[]);
async function write(db, writes) {
  for(let start=0;start<writes.length;start+=400) {
    const batch=typeof db.batch==='function'?db.batch():null;
    for(const [path,value] of writes.slice(start,start+400)) {
      const ref=db.doc(path);
      if(batch){if(value===null)batch.delete(ref);else batch.set(ref,value)}
      else if(value===null){if(ref.delete)await ref.delete()}else await ref.set(value);
    }
    if(batch)await batch.commit();
  }
}
// Called once at the start of each worker run: always re-reads, later saves reuse the result.
async function load(db) {
  cache.delete(db);
  const {days,pending}=await state(db);
  // Callers mutate the returned records; the cache must keep what is actually stored.
  return structuredClone([...new Map([...[...days.values()].flatMap(d=>d.items||[]),...pendingItems(pending)].map(i=>[i.id,i])).values()]);
}
async function migrate(db) {
  const marker=await db.doc('meta/feedDaysMigration').get();
  if(marker.exists)return;
  const [feed,pending]=await Promise.all([db.doc('meta/feed').get(),db.doc('meta/pending').get()]);
  const existing=await load(db);
  // Existing records win on retries, including completed translations.
  const items=[...new Map([...(pending.exists?pending.data().items||[]:[]),...(feed.exists?feed.data().items||[]:[]),...existing].map(i=>[i.id,i])).values()];
  const metadata=feed.exists?{...feed.data()}:{};delete metadata.items;
  await persist(db,items,{...metadata,updatedAt:metadata.updatedAt||new Date().toISOString()},null,null,[],{expire:false});
  await db.doc('meta/feedDaysMigration').set({completedAt:new Date().toISOString()});
  // The legacy backlog is no longer a writer or a reader's source of truth.
  await db.doc('meta/pending').set({items:[],migrated:true});
}
async function persist(db, items, metadata, seen, quota, events = [], {expire=true,now=Date.now()}={}) {
  const fresh=i=>{const t=Date.parse(i.publishedAt);return !expire||!Number.isFinite(t)||t>=now-(visible(i)?KEEP_DAYS:PENDING_DAYS)*DAY};
  const {published,pending}=prepare(items.filter(fresh));
  const writes=[];
  const desired=dayDocuments(published,metadata);
  // Minimal offline adapters predate collections; keep their legacy views usable.
  if(typeof db.collection==='function') {
    const current=await state(db);
    // Cache a deep copy: live items keep changing after a save within the same run.
    const same=(a,b)=>JSON.stringify(a?.items)===JSON.stringify(b?.items), copy=v=>structuredClone(v);
    for(const [id,value] of desired) if(!same(current.days.get(id),value)){writes.push(['feedDays/'+id,value]);current.days.set(id,copy(value))}
    for(const id of [...current.days.keys()])if(!desired.has(id)){writes.push(['feedDays/'+id,null]);current.days.delete(id)}
    const chunks=pendingChunks(pending);
    for(const [id,value] of chunks) if(!same(current.pending.get(id),value)){writes.push(['pending/'+id,value]);current.pending.set(id,copy(value))}
    for(const id of [...current.pending.keys()])if(!chunks.has(id)){writes.push(['pending/'+id,null]);current.pending.delete(id)}
  } else writes.push(['meta/pending',{items:pending,...metadata}]);
  const latest=[];for(const item of published.slice(0,60)){if(bytes({items:[...latest,item],...metadata})>700000)break;latest.push(item)}
  writes.push(['meta/feed',{items:latest,...metadata}]);
  if(seen)writes.push(['meta/seen',{ids:seen}]);
  for(const event of events)writes.push(['notificationEvents/'+event.news.id,event]);
  if(quota)writes.push(['meta/quota',quota]);
  try{await write(db,writes)}catch(error){cache.delete(db);throw error}
  return [...published,...pending];
}
// Test helper: find one private record wherever it is stored.
const pendingItem = (data, id) => pendingItems(new Map([...data].filter(([p])=>p.startsWith('pending/')))).find(i=>i.id===id);
module.exports={prepare,persist,visible,dayDocuments,kstDate,load,migrate,pendingChunks,pendingItem,KEEP_DAYS,PENDING_DAYS};
