const DAY = 86400000, KEEP_DAYS = 30;
const visible = i => !i.categoryReview && (i.translated === true || (i.categories || []).includes('korwar'));
const kstDate = value => new Date(new Date(value).getTime()+9*3600000).toISOString().slice(0,10);
function prepare(items) {
  const ordered = [...new Map(items.map(i=>[i.id,i])).values()].sort((a,b)=>String(b.publishedAt).localeCompare(String(a.publishedAt)));
  return {published:ordered.filter(visible),pending:ordered.filter(i=>!visible(i))};
}
function dayDocuments(items, metadata = {}) {
  const docs = new Map();
  for (const item of prepare(items).published) {
    const date=kstDate(item.publishedAt); let part=1, key=date;
    while (docs.has(key) && Buffer.byteLength(JSON.stringify({...docs.get(key),items:[...docs.get(key).items,item]}))>800000) key=date+'_'+(++part);
    const doc=docs.get(key)||{date,part,items:[],updatedAt:metadata.updatedAt||new Date().toISOString()};
    doc.items.push(item);
    if(Buffer.byteLength(JSON.stringify(doc))>800000)throw Error('Item exceeds feed day document capacity: '+item.id);
    docs.set(key,doc);
  }
  return docs;
}
async function snapshot(db, collection) { return (await db.collection(collection).get()).docs.map(d=>({id:d.id||d.ref?.path?.split('/').at(-1),data:()=>d.data()})); }
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
async function load(db) {
  const [days,pending]=await Promise.all([snapshot(db,'feedDays'),snapshot(db,'pending')]);
  return [...new Map([...days.flatMap(d=>d.data().items||[]),...pending.map(d=>d.data())].map(i=>[i.id,i])).values()];
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
  const retained=items.filter(i=>!expire||!Number.isFinite(Date.parse(i.publishedAt))||Date.parse(i.publishedAt)>=now-KEEP_DAYS*DAY);
  const {published,pending}=prepare(retained);
  const writes=[];
  const desired=dayDocuments(published,metadata);
  // Minimal offline adapters predate collections; keep their legacy views usable.
  if(typeof db.collection==='function') {
    const [oldDays,oldPending]=await Promise.all([snapshot(db,'feedDays'),snapshot(db,'pending')]);
    const old=new Map(oldDays.map(d=>[d.id,d.data()]));
    for(const [id,value] of desired) if(JSON.stringify(old.get(id)?.items)!==JSON.stringify(value.items))writes.push(['feedDays/'+id,value]);
    for(const d of oldDays)if(!desired.has(d.id))writes.push(['feedDays/'+d.id,null]);
    const prior=new Map(oldPending.map(d=>[d.id,d.data()]));
    for(const item of pending)if(JSON.stringify(prior.get(item.id))!==JSON.stringify(item))writes.push(['pending/'+item.id,item]);
    const ids=new Set(pending.map(i=>i.id));for(const d of oldPending)if(!ids.has(d.id))writes.push(['pending/'+d.id,null]);
  } else writes.push(['meta/pending',{items:pending,...metadata}]);
  const latest=[];for(const item of published.slice(0,60)){if(Buffer.byteLength(JSON.stringify({items:[...latest,item],...metadata}))>700000)break;latest.push(item)}
  writes.push(['meta/feed',{items:latest,...metadata}]);
  if(seen)writes.push(['meta/seen',{ids:seen}]);
  for(const event of events)writes.push(['notificationEvents/'+event.news.id,event]);
  if(quota)writes.push(['meta/quota',quota]);
  await write(db,writes);return [...published,...pending];
}
module.exports={prepare,persist,visible,dayDocuments,kstDate,load,migrate};
