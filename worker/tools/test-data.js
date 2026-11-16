// Tests inspecting the internal queue must read both public and private documents.
exports.allItems = data => [...new Map([...data].filter(([p])=>p.startsWith('feedDays/')||p.startsWith('pending/')||p==='meta/feed'||p==='meta/pending').flatMap(([p,v])=>p.startsWith('pending/')?[v]:v.items||[]).map(i=>[i.id,i])).values()];
// Distinct translated fixture titles without copying the Korean input into Thai fields.
exports.thaiTitle = (headline, prefix = 'ข่าว') => prefix + ' ' + require('crypto').createHash('sha256').update(String(headline)).digest('hex').slice(0, 24);
