// Tests inspecting the internal queue must read both public and private documents.
exports.allItems = data => [...(data.get('meta/feed')?.items || []), ...(data.get('meta/pending')?.items || [])];
// Distinct translated fixture titles without copying the Korean input into Thai fields.
exports.thaiTitle = (headline, prefix = 'ข่าว') => prefix + ' ' + require('crypto').createHash('sha256').update(String(headline)).digest('hex').slice(0, 24);
