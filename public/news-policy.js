// Shared, deterministic policy: AI urgency cannot authorize an alert.
(() => {
  const VERSION = 'selected-publishers-v3';
  // The 24 requested newsrooms. Sister brands are not implicitly permitted.
  // group identifies independent newsrooms when checking trending coverage.
  const PUBLISHERS = [
    {name:'Yonhap News Agency',domains:['yna.co.kr']},
    {name:'Newsis',domains:['newsis.com']},
    {name:'News1',domains:['news1.kr']},
    {name:'KBS',domains:['kbs.co.kr']},
    {name:'MBC',domains:['imbc.com']},
    {name:'SBS',domains:['sbs.co.kr']},
    {name:'JTBC',domains:['jtbc.co.kr','jtbc.com']},
    {name:'YTN',domains:['ytn.co.kr']},
    {name:'Arirang TV',domains:['arirang.com','arirang.co.kr']},
    {name:'Chosun Ilbo',domains:['chosun.com']},
    {name:'JoongAng Ilbo',domains:['joongang.co.kr']},
    {name:'Dong-A Ilbo',domains:['donga.com']},
    {name:'Hankyoreh',domains:['hani.co.kr']},
    {name:'Kyunghyang Shinmun',domains:['khan.co.kr']},
    {name:'Hankook Ilbo',domains:['hankookilbo.com']},
    {name:'Maeil Business',domains:['mk.co.kr']},
    {name:'Korea Economic Daily',domains:['hankyung.com']},
    {name:'Seoul Economic Daily',domains:['sedaily.com']},
    {name:'The Korea Herald',domains:['koreaherald.com']},
    {name:'The Korea Times',domains:['koreatimes.co.kr']},
    {name:'Korea JoongAng Daily',domains:['koreajoongangdaily.joins.com','koreajoongangdaily.com'],group:'joongang.co.kr'},
    {name:'Newstapa',domains:['newstapa.org']},
    {name:'NK News',domains:['nknews.org']},
    {name:'Daily NK',domains:['dailynk.com']}
  ];
  const publishers = PUBLISHERS.flatMap(p=>p.domains);
  function isKoreanPublisher(url) {
    try {
      const u = new URL(url);
      return /^https?:$/.test(u.protocol) && publishers.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
    } catch { return false; }
  }
  function publisherKey(url) {
    if (!isKoreanPublisher(url)) return null;
    const host = new URL(url).hostname;
    const publisher=PUBLISHERS.find(p=>p.domains.some(d=>host===d||host.endsWith('.'+d)));
    return publisher.group || publisher.domains[0];
  }
  function trusted(item) {
    // Google News is a relay, not the publisher; preserve its RSS source URL.
    if(!item || !isKoreanPublisher(item.publisherUrl || item.sourceUrl || item.link))return false;
    const actual=item.sourceUrl || item.link;
    if(!actual)return true;
    try {return isKoreanPublisher(actual) || new URL(actual).hostname==='news.google.com';}catch{return false;}
  }
  function incident(item) {
    if (!item || !trusted(item)) return null;
    // Use the original headline only. Snippets often contain unrelated headlines,
    // background incidents and speculation; translated text is not evidence.
    const text = String(item.titleKo || '').replace(/\s+/g, ' ').trim();
    // The same five incidents can be reported by the selected English desks.
    if(/\b(?:North Korean?|South Korean?|Seoul)\b/i.test(text)){
      if(/\b(?:drills?|simulation|plans?|prepar\w*|threat\w*|warn\w*|could|may|might|would|denies|denied|not|never|anniversary|last year|years ago|unconfirmed|rumou?r|false|condemn\w*|hack\w*|cyber)\b/i.test(text))return null;
      if(/\bNorth Korea(?:n (?:military|army|forces))?\s*[,–:-]?\s*(?:has\s+)?(?:successfully\s+)?(?:launch(?:es|ed)?|fires?|fired|tests?|tested)\b.{0,45}\b(?:missiles?|rockets?)\b/i.test(text))return 'north-launch';
      if(/\bSouth Korean\b.{0,25}\b(?:soldier|troops?|marine)\b.{0,30}\b(?:steps?|stepped|treads?|trod)\b.{0,25}\b(?:anti[- ]?personnel|lethal)\s+(?:land)?mine\b/i.test(text))return 'soldier-mine';
      if(/\bmissile\b.{0,35}\b(?:falls?|fell|lands?|landed|crashes?|crashed)\b.{0,25}\b(?:near|off|waters of)\b.{0,25}\b(?:South Korea|Seoul)\b/i.test(text))return 'missile-near-south';
      if(/\bNorth Korea\b.{0,25}\b(?:attacks?|attacked|shells?|shelled|invades?|invaded|bombs?|bombed)\b.{0,25}\bSouth Korea\b/i.test(text))return 'north-attacks-south';
      if(/\bSouth Korea\b.{0,20}\b(?:attacked|bombed|shelled|hit by (?:a )?(?:missile|airstrike))\b/i.test(text))return 'south-attacked';
    }
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
  const api = { VERSION, PUBLISHERS, isKoreanPublisher, publisherKey, trusted, incident, apply, canNotify, matches };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.KW_NEWS_POLICY = api;
})();
