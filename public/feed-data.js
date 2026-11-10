import './categories.js';
import './news-text.js';
import './news-policy.js?v=20261111-interactions';
import './category-policy.js?v=20261111-interactions';

const list = value => Array.isArray(value) ? value : [];
const objects = value => list(value).filter(item => item && typeof item === 'object');
export function timestamp(value) {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === 'object') {
    const seconds = value.seconds ?? value._seconds;
    if (Number.isFinite(seconds)) return seconds * 1000 + (value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6;
  }
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
export function normalizeFeed(value) {
  if (!Array.isArray(value)) throw Error('Invalid feed items');
  const items = [], errors = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || !raw.id) { errors.push({id:null,reason:'invalid-record'}); continue; }
    try {
      const publishedAt = timestamp(raw.publishedAt);
      const item = {...raw,
        categories:list(raw.categories).filter(c => typeof c === 'string'),
        links:objects(raw.links), alts:objects(raw.alts),
        publishers:list(raw.publishers).filter(url => typeof url === 'string'),
        publishedAt:publishedAt ? new Date(publishedAt).toISOString() : raw.publishedAt,
        translated:raw.translated === true && globalThis.KW_NEWS_TEXT.completeThai(raw)};
      item.categories = globalThis.KW_CATEGORY_POLICY.classify(item,item.categories);
      items.push(globalThis.KW_NEWS_POLICY.apply(item));
    } catch (error) { errors.push({id:String(raw.id),reason:String(error.message).slice(0,160)}); }
  }
  return {items,errors};
}
