const { CAT_KEYS } = require('../feeds');
// RSS hints are search queries, not facts. Preserve these narrow topic labels
// only when the original headline/snippet explicitly supports them.
function publicationCategories(input, modelCategories) {
  const categories = new Set(modelCategories.filter(key => CAT_KEYS.includes(key)));
  const text = `${input.titleKo || ''} ${input.snippet || ''}`;
  if (/(?:사재기|생필품|식량|식료품|곡물|쌀값|비축)/.test(text) ||
      /(?:식품|먹거리|라면|쌀|농산물).{0,25}(?:가격|물가|급등|부족|품귀|공급|수급|품절)/.test(text)) categories.add('food');
  if (/(?:외국인\s*(?:노동자|근로자|취업자)|이주\s*노동자|고용허가제|E[‐‑–-]?9\b|비전문취업)/i.test(text)) categories.add('foreign');
  return [...categories];
}
module.exports = { publicationCategories };
