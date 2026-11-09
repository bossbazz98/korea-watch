// Device-local snapshots keep saved stories readable after they leave the live feed.
export function createReadingList(storage, key = 'kw.readingList') {
  let entries = [];
  try {
    const stored = JSON.parse(storage.getItem(key) || '[]');
    if (Array.isArray(stored)) entries = stored.filter(entry => entry && typeof entry.id === 'string' && entry.article && typeof entry.article === 'object' && entry.article.id === entry.id).slice(0, 150);
  } catch { /* A damaged local list must never prevent the news feed from loading. */ }
  const commit = next => {
    storage.setItem(key, JSON.stringify(next)); // Keep the current list if storage is full.
    entries = next;
  };
  return {
    all: () => entries.map(entry => ({ ...entry })),
    has: id => entries.some(entry => entry.id === String(id)),
    get: id => entries.find(entry => entry.id === String(id))?.article,
    save(article) {
      const id = String(article.id);
      const copy = JSON.parse(JSON.stringify({ ...article, id }));
      commit([{ id, savedAt: Date.now(), article: copy }, ...entries.filter(entry => entry.id !== id)].slice(0, 150));
    },
    remove(id) { commit(entries.filter(entry => entry.id !== String(id))); }
  };
}
