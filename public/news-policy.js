// Shared, deterministic policy: AI urgency cannot authorize an alert.
(() => {
  const VERSION = 'selected-levels-v2';
  const publishers = ['yna.co.kr', 'yonhapnewstv.co.kr', 'kbs.co.kr', 'imbc.com', 'sbs.co.kr', 'ytn.co.kr', 'jtbc.co.kr', 'jtbc.com', 'donga.com', 'khan.co.kr', 'hani.co.kr', 'chosun.com', 'joongang.co.kr', 'hankookilbo.com', 'seoul.co.kr', 'segye.com', 'kmib.co.kr', 'munhwa.com', 'newsis.com', 'news1.kr', 'nocutnews.co.kr', 'mbn.co.kr', 'tvchosun.com', 'ichannela.com', 'mk.co.kr', 'hankyung.com', 'sedaily.com', 'edaily.co.kr', 'mt.co.kr', 'fnnews.com', 'asiae.co.kr', 'ohmynews.com', 'pressian.com', 'busan.com', 'imaeil.com', 'koreaherald.com', 'koreatimes.co.kr'];
  function isKoreanPublisher(url) {
    try {
      const u = new URL(url);
      return /^https?:$/.test(u.protocol) && publishers.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
    } catch { return false; }
  }
  function publisherKey(url) {
    if (!isKoreanPublisher(url)) return null;
    const host = new URL(url).hostname;
    return publishers.find(d => host === d || host.endsWith('.' + d));
  }
  function trusted(item) {
    // Google News is a relay, not the publisher; preserve its RSS source URL.
    return isKoreanPublisher(item.publisherUrl || item.sourceUrl || item.link);
  }
  function incident(item) {
    if (!item || !trusted(item)) return null;
    // Use the original headline only. Snippets often contain unrelated headlines,
    // background incidents and speculation; translated text is not evidence.
    const text = String(item.titleKo || '').replace(/\s+/g, ' ').trim();
    if (!text || /(?:훈련|모의|가상|시뮬레이션|가정|시나리오|가능성|우려|전망|예정|계획|대비|억제|경고|위협|가짜|오보|사실무근|아니다|아닌|않았|안 했다|부인|과거|회고|주년|당시|지난해|작년|재작년|년 전|준비|징후|규탄|논평|성명|촉구|할 경우|한다면|시에는|시 대응|시 보복|땐|안 했|안했|않아|취소|중단|발사설|않겠|않는|안 한다|안한다|하겠다|할 것|할 수|사이버|해킹|비판|비난|소송)/.test(text)) return null;
    const north = /북한|북측|북한군|北(?=[ ,·…의은는가군]|미사일|발사)/.test(text);
    const south = /한국|남한|남측|우리나라|대한민국|서울|연평도|백령도/.test(text);
    if (north && /(?:미사일|로켓|방사포|발사체)/.test(text) && /(?:발사(?!체)|시험|실험|쐈|쏜|쏘아|쏴)/.test(text) && !/(?:한국|남한|미국|미군|러시아|중국).{0,12}(?:미사일|로켓).{0,12}(?:발사|시험)/.test(text)) return 'north-launch';
    if (/(?:국군|한국\s*군|남한군|우리 군|우리군|육군|해병대)/.test(text) && /(?:대인지뢰|살상.{0,4}지뢰|목함지뢰)/.test(text) && /(?:밟|밟아|밟고)/.test(text) && (!north || /한국군|국군|우리 군|우리군/.test(text))) return 'soldier-mine';
    if (south && /미사일|로켓/.test(text) && /추락|낙하|떨어|낙탄|착탄/.test(text) && /인근|근처|주변|해상|영해|영토|앞바다|해안|서울|연평도|백령도/.test(text)) return 'missile-near-south';
    if (south && /피격|공격받|공격 받|공습받|공습 받|폭격당|폭격 당|포격당|포격 당/.test(text)) return 'south-attacked';
    if (north && south && /(?:북한(?:군)?|북측|北).{0,20}(?:한국|남한|남측|대한민국|서울|연평도|백령도).{0,12}(?:공격|포격|폭격|침공|침략|총격|포탄.{0,6}발사)/.test(text) && !/(?:한국|남한|한국군|우리 군|우리군).{0,8}(?:북한|북측).{0,8}(?:공격|포격|폭격)/.test(text)) return 'north-attacks-south';
    return null;
  }
  function apply(item) {
    const reason = incident(item);
    return { ...item, level: reason ? 'critical' : item.level === 'critical' ? 'high' : item.level,
      emergency: !!reason, categories: reason ? [...new Set([...(Array.isArray(item.categories)?item.categories:[]), 'korwar'])] : item.categories };
  }
  function canNotify(item) {
    return !!item && ( !!incident(item) || (trusted(item) && item.translated === true && !!item.titleKo && ['normal','high'].includes(apply(item).level)) );
  }
  function matches(preferences,item) {
    if (!preferences?.enabled || !canNotify(item)) return false;
    const n=apply(item), selected=Array.isArray(preferences.cats)?preferences.cats:[];
    if (!(Array.isArray(n.categories)?n.categories:[]).some(c=>selected.includes(c))) return false;
    return n.level==='critical' || preferences.level==='all' || (preferences.level==='high' && n.level==='high');
  }
  const api = { VERSION, isKoreanPublisher, publisherKey, trusted, incident, apply, canNotify, matches };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.KW_NEWS_POLICY = api;
})();
