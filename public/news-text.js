// Shared language checks for publication, translation repair and display.
(() => {
  const textOf = value => typeof value === 'string' ? value.trim() : '';
  const koreanRatio = text => (text.match(/[\uac00-\ud7a3]/g) || []).length / Math.max(1, (text.match(/\p{L}/gu) || []).length);
  const isThai = value => { const text = textOf(value); return /[\u0e01-\u0e2e]/.test(text) && koreanRatio(text) <= 0.2; };
  const isEnglish = value => { const text = textOf(value); return /[a-z]/i.test(text) && koreanRatio(text) <= 0.2 && !/[\u0e01-\u0e2e]/.test(text); };
  const isKorean = value => { const text = textOf(value); return /[\uac00-\ud7a3]/.test(text) && !/[\u0e01-\u0e2e]/.test(text); };
  const languages = ['th', 'en', 'ko'];
  const valid = (value, language) => ({ th:isThai, en:isEnglish, ko:isKorean }[language]?.(value)) === true;
  const pick = (value, language) => {
    const candidate = typeof value === 'string' ? value : value?.[language];
    return valid(candidate, language) ? candidate.trim() : '';
  };
  const body = (value, language) => {
    const selected = value && !Array.isArray(value) && typeof value === 'object' ? value[language] : value;
    const paragraphs = Array.isArray(selected) ? selected : typeof selected === 'string' ? selected.split(/\n\n+/) : [];
    return paragraphs.filter(paragraph => valid(paragraph, language));
  };
  const complete = (item, language) => {
    const value = item.body?.[language];
    const paragraphs = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    return valid(item.title?.[language], language) && valid(item.summary?.[language], language) && paragraphs.length > 0 && paragraphs.every(p => valid(p, language));
  };
  const completeThai = item => complete(item, 'th');
  const missingLanguages = item => languages.filter(language => !complete(item, language));
  const api = { isThai, isEnglish, isKorean, valid, languages, pick, body, complete, completeThai, missingLanguages };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.KW_NEWS_TEXT = api;
})();
