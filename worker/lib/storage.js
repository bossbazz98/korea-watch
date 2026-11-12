const { retainItems } = require('./scheduler');
// Publish only reader-visible items; retain the translation backlog privately.
const visible = i => !i.categoryReview && (i.translated === true || (i.categories || []).includes('korwar'));
function prepare(items, maxBytes = 800000, maxItems = 250) {
  const ordered = retainItems(items, maxItems);
  const fit = list => { while (list.length && Buffer.byteLength(JSON.stringify(list)) > maxBytes) list.pop(); return list; };
  return { published: fit(ordered.filter(visible)), pending: fit(ordered.filter(i => !visible(i))) };
}
async function persist(db, items, metadata, seen, quota, events = []) {
  const {published, pending} = prepare(items);
  const writes = [['meta/feed',{items:published,...metadata}],['meta/pending',{items:pending,...metadata}]];
  if (seen) writes.push(['meta/seen',{ids:seen}]);
  for (const event of events) writes.push(['notificationEvents/'+event.news.id,event]);
  if (quota) writes.push(['meta/quota',quota]);
  if (typeof db.batch === 'function') {
    const batch = db.batch(); for (const [path,value] of writes) batch.set(db.doc(path),value); await batch.commit();
  } else {
    // Minimal in-memory adapters used by the offline suites. Production Admin SDK uses a batch.
    for (const [path,value] of writes) await db.doc(path).set(value);
  }
  return [...published,...pending];
}
module.exports={prepare,persist,visible};
