// Tests inspecting the internal queue must read both public and private documents.
exports.allItems = data => [...(data.get('meta/feed')?.items || []), ...(data.get('meta/pending')?.items || [])];
