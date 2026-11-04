const { CAT_KEYS } = require('../feeds');
const isKorwar = item => (item.categories || []).includes('korwar');
// Round-robin categories rotate across five-minute runs; emergency/reader work keeps a bounded lead.
function balancedQueue(items, limit, { now = Date.now(), priorityIds = new Set(), categoryKeys = CAT_KEYS } = {}) {
  const pool = [...items].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const selected = [], ids = new Set();
  const take = item => { if (!item || selected.length >= limit || ids.has(item.id)) return; ids.add(item.id); selected.push(item); };
  pool.filter(item => priorityIds.has(item.id)).slice(0, Math.min(2, limit)).forEach(take);
  pool.filter(item => item.emergency && !isKorwar(item)).slice(0, Math.min(2, Math.max(0, limit - selected.length))).forEach(take);
  const shift = Math.floor(now / 300000) % Math.max(1, categoryKeys.length);
  const order = [...categoryKeys.slice(shift), ...categoryKeys.slice(0, shift)];
  while (selected.length < limit) {
    const before = selected.length;
    for (const key of order) take(pool.find(item => !ids.has(item.id) && (item.categories || []).includes(key)));
    if (selected.length === before) break;
  }
  for (const item of pool) take(item);
  return selected;
}
function retainItems(items, maxItems = 250, now = Date.now()) {
  const ordered = [...items].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const ready = ordered.filter(item => item.translated);
  const koreanPending = ordered.filter(item => !item.translated && isKorwar(item)).slice(0, Math.min(20, Math.ceil(maxItems / 4)));
  const otherPending = ordered.filter(item => !item.translated && !isKorwar(item));
  const reserve = Math.min(50, koreanPending.length + otherPending.length, maxItems);
  const published = ready.slice(0, maxItems - reserve);
  const remaining = maxItems - published.length;
  const pending = balancedQueue(otherPending, Math.max(0, remaining - koreanPending.length), { now });
  return [...published, ...koreanPending.slice(0, remaining), ...pending].slice(0, maxItems);
}
module.exports = { balancedQueue, retainItems };
