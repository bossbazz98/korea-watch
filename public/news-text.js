// Shared language checks for publication and display. Korean source titles stay in the source section.
(() => {
  const textOf = value => typeof value === 'string' ? value.trim() : '';
  const koreanRatio = text => (text.match(/[\uac00-\ud7a3]/g) || []).length / Math.max(1, (text.match(/\p{L}/gu) || []).length);
  const isThai = value => { const text = textOf(value); return /[\u0e01-\u0e2e]/.test(text) && koreanRatio(text) <= 0.2; };
  const isEnglish = value => { const text = textOf(value); return /[a-z]/i.test(text) && koreanRatio(text) <= 0.2 && !/[\u0e01-\u0e2e]/.test(text); };
  const valid = (value, language) => language === 'en' ? isEnglish(value) : isThai(value);
  const pick = (value, language) => {
    const candidate = typeof value === 'string' ? value : value?.[language];
    return valid(candidate, language) ? candidate.trim() : '';
  };
  const body = (value, language) => {
    const selected = value && !Array.isArray(value) && typeof value === 'object' ? value[language] : value;
    const paragraphs = Array.isArray(selected) ? selected : typeof selected === 'string' ? selected.split(/\n\n+/) : [];
    return paragraphs.filter(paragraph => valid(paragraph, language));
  };
  const completeThai = item => {
    const paragraphs = Array.isArray(item.body?.th) ? item.body.th : typeof item.body?.th === 'string' ? [item.body.th] : [];
    return isThai(item.title?.th) && isThai(item.summary?.th) && paragraphs.length > 0 && paragraphs.every(isThai);
  };
  const api = { isThai, isEnglish, pick, body, completeThai };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.KW_NEWS_TEXT = api;
})();
