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
    refresh(articles) {
      const live = new Map(articles.map(article => [String(article.id), article]));
      const next = entries.map(entry => {
        const article = live.get(entry.id);
        if (!article) return entry;
        const copy = { ...entry.article, ...article };
        // A later enrichment may omit an edition that was already saved. Keep it
        // until its replacement is available, and preserve the original save date.
        for (const field of ['title', 'summary', 'body', 'tips']) {
          copy[field] = { ...entry.article[field] };
          for (const [language, value] of Object.entries(article[field] || {})) {
            if ((typeof value === 'string' && value.trim()) || (Array.isArray(value) && value.length)) copy[field][language] = value;
          }
        }
        return { ...entry, article: copy };
      });
      if (JSON.stringify(next) !== JSON.stringify(entries)) commit(JSON.parse(JSON.stringify(next)));
    },
    remove(id) { commit(entries.filter(entry => entry.id !== String(id))); }
  };
}
