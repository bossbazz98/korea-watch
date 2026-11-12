// Discovery and publication are separate: a keyword cannot overrule the editor.
// Country/topic evidence always comes from the original source, never a translation.
(() => {
  const labels = typeof module !== 'undefined' ? require('./categories') : globalThis.KW_CATEGORIES;
  const news = typeof module !== 'undefined' ? require('./news-policy') : globalThis.KW_NEWS_POLICY;
  const VERSION = 2, keys = Object.keys(labels);
  const array = value => Array.isArray(value) ? value : [];
  const objects = value => array(value).filter(item => item && typeof item === 'object');
  const patterns = {
    war:/전쟁|전투|공습|교전|휴전|폭격|포격|침공|무력\s*충돌|군사\s*충돌|내전|무장\s*분쟁|\bwars?\b|\bbattles?\b|\bfighting\b|warfare|air\s*strikes?|ceasefire|invasion|armed conflict|armed clashes|shelling/i,
    disease:/감염병|전염병|바이러스|확진|독감|인플루엔자|코로나|백신|엠폭스|결핵|홍역|팬데믹|전염|infectious|virus|vaccine|outbreak|pandemic|influenza|measles|tuberculosis|mpox/i,
    tech:/\bAI\b|인공지능|반도체|첨단\s*기술|신기술|기술\s*혁신|양자|로봇|자율주행|생성형|대규모\s*언어|artificial intelligence|semiconductors?|robotics?|quantum|new technolog|technological innovation/i,
    crypto:/암호화폐|가상\s*자산|가상\s*화폐|코인\s*(?:출시|발행|거래|상장)|비트코인|이더리움|알트코인|스테이블코인|밈코인|블록체인|\bcrypto\b|cryptocurrenc|bitcoin|ethereum|stablecoin|memecoin|blockchain/i,
    foreign:/외국인|이주\s*노동자|이주민|고용허가제|E[‐‑–-]?9\b|비전문취업|인종\s*차별|foreign(?:\s+\w+){0,2}\s+(?:workers?|residents?|nationals?)|migrant|immigrant|racism|racial discrimination/i,
    wage:/최저임금|최저시급|임금|급여|시급|minimum wage|salary|\bwages?\b|unpaid pay/i,
    fx:/원화|원[·ㆍ\s/-]?달러|달러[·ㆍ\s/-]?원|원[·ㆍ\s/-]?엔|원[·ㆍ\s/-]?바트|\bKRW\b|Korean won|\bwon\b.{0,24}(?:dollar|exchange|rises?|falls?|weak|strong)/i,
    oil:/유가|원유|휘발유|경유|기름값|석유|에너지|재생에너지|태양광|풍력|수소|천연가스|액화가스|연료|전력|원자력|OPEC|energy|crude oil|oil prices?|fuel|renewable|solar power|wind power|natural gas/i,
    thai:/태국|주한\s*태국|태국대사관|\bThai\b|Thailand/i,
    president:/대통령|대통령실|청와대|국무총리|정부|president|government|prime minister/i
  };
  const south=/한국|대한민국|남한|남측|우리나라|서울|인천|부산|경기도|South Korea|Seoul|Busan/i;
  const foreignCountry=/북한|북측|캄보디아|태국|일본|중국|미국|러시아|우크라이나|이스라엘|이란|영국|프랑스|독일|베트남|트럼프|바이든|푸틴|시진핑|North Korea|Cambodia|Thailand|Japan|China|United States|\bU\.S\.|Trump|Russia|Ukraine/i;
  const domesticInstitution=/고용허가제|고용노동부|최저임금위원회|근로기준법|비전문취업|E[‐‑–-]?9\b|대통령실|청와대|employment permit system|South Korean/i;
  const local = text => south.test(text) || ((domesticInstitution.test(text)||/\d[\d만천백십,.]*\s*원/.test(text)) && !foreignCountry.test(text));
  const foreignSubject=/미국|일본|중국|북한|캄보디아|태국|러시아|베트남|영국|프랑스|독일|\bUS\b|\bU\.S\.|Japan|China|North Korea|Cambodia|Thailand|Russia|Vietnam|Britain/i;
  const koreanGovernment=/한국\s*(?:여야\s*)?(?:대통령|정부|국무총리)|대한민국\s*(?:대통령|정부)|South Korean?\s+(?:president|government|prime minister)/i;
  function koreanConflict(text) {
    const peninsula=/북한|북측|北(?=[ ,·…의은는가군]|미사일|발사)|김정은|김여정|남북|대북|한반도|합참|합동참모본부|군사분계선|비무장지대|DMZ|휴전선|연평도|백령도|한미연합|North Korea|inter-Korean|Korean Peninsula/i;
    const security=/미사일|로켓|방사포|정찰위성|사이버|해킹|핵|군사|포병|사격|포격|교전|전쟁|공습|훈련|긴장|도발|회담|제재|위협|침범|대피|경고사격|충돌|공격|지뢰|missile|rocket|nuclear|military|attack|conflict|drill|tension|security/i;
    const overseas=/우크라이나|가자|이스라엘|이란|Ukraine|Gaza|Israel|Iran/i.test(text);
    return peninsula.test(text) && security.test(text) && (!overseas || /한반도|남북|남한|남측|DMZ|South Korea|Korean Peninsula/i.test(text));
  }
  function publisherKeys(input) {
    return [...new Set([input.publisherUrl || input.sourceUrl || input.link,
      ...array(input.publishers), ...objects(input.links).map(l => l.publisherUrl || l.url),
      ...objects(input.alts).map(l => l.publisherUrl || l.link)].map(news.publisherKey).filter(Boolean))];
  }
  function sourceParts(input) {
    // Only the lead can support a category absent from the headline.
    const lead = value => String(value || '').split(/관련기사|추천기사|함께 읽|Related (?:stories|articles)|Read more/i)[0]
      .split(/\n+|(?<=[.!?。])\s+/).slice(0,2).join(' ').slice(0,600);
    const saved=input.categoryEvidence;
    return [...new Set([String(input.titleKo || '').trim(),lead(input.snippet || input.snippetKo),lead(input.article),
      ...(saved?.version===VERSION ? Object.values(saved.matches || {}).filter(v=>typeof v==='string') : [])].filter(Boolean))];
  }
  function assess(input, proposed = [], {discover = false} = {}) {
    const parts=sourceParts(input), headline=String(input.titleKo || '');
    const matches={}, reasons={};
    const trusted=news.trusted(input), incident=!!news.incident(input);
    for(const [key,re] of Object.entries(patterns)) {
      const match=parts.find(text=>{
        if(!re.test(text))return false;
        if(['foreign','wage','president'].includes(key)&&!local(text))return false;
        if(key==='president' && !koreanGovernment.test(text) && !( /대통령실|청와대/.test(text)&&!foreignSubject.test(text)))return false;
        if(['foreign','wage'].includes(key) && foreignSubject.test(text) && !/(?:한국|대한민국|남한|서울|인천|부산).{0,18}(?:외국인|이주|임금|시급|급여)|(?:South Korea|Seoul).{0,25}(?:migrant|foreign|wage)|(?:migrant|foreign|wage).{0,25}(?:South Korea|Seoul)|고용허가제/i.test(text))return false;
        if(key==='thai'&&!south.test(text)&&!/주한|South Korea.{0,30}Thai|Thai.{0,30}South Korea/i.test(text))return false;
        if(key==='war' && (koreanConflict(text)||/AI\s*전쟁|반도체\s*전쟁|가격\s*전쟁|무역\s*전쟁|관세\s*전쟁|선거\s*전쟁|암과의\s*전쟁|trade war|price war|war on cancer/i.test(text)))return false;
        if(key==='war' && /준비|대비|훈련|가능성|우려|prepar|readiness|could|risk of|drills?/i.test(text) && !/공습|교전|폭격|침공|휴전|airstrike|shelling|ceasefire|invasion|armed clashes/i.test(text))return false;
        if(key==='war' && /영화|드라마|게임|소설|movie|film|video game|novel/i.test(text))return false;
        if(key==='disease' && /컴퓨터|악성코드|랜섬웨어|멀웨어|computer|malware|ransomware/i.test(text) && !/감염병|전염병|환자|infectious|patients/i.test(text))return false;
        if(key==='oil' && /에너지\s*(?:드링크|음료)|energy drink/i.test(text) && !/석유|원유|전력|fuel|oil/i.test(text))return false;
        return true;
      });
      if(match)matches[key]=match;
    }
    // A background paragraph cannot move a foreign headline into the Peninsula.
    if(koreanConflict(headline)||incident)matches.korwar=headline;
    if(publisherKeys(input).length>=3)matches.hot=headline;
    const selected=new Set(array(proposed));
    const categories=keys.filter(key=>trusted&&matches[key]&&(discover||selected.has(key)||key==='hot'||(key==='korwar'&&incident)));
    for(const key of keys)if(!categories.includes(key))reasons[key]=!trusted?'publisher-not-allowed':!matches[key]?'source-scope-not-proven':'not-selected-by-editor';
    return {version:VERSION,categories,matches:Object.fromEntries(categories.map(key=>[key,matches[key]])),reasons};
  }
  const classify = (input, proposed) => assess(input,proposed).categories;
  const discover = input => assess(input,[],{discover:true}).categories;
  function evidenceOf(input, categories=keys) {
    const {matches}=assess(input,categories);
    return {version:VERSION,matches};
  }
  function migratePreferences(list) {
    const aliases = { law:'foreign', korea:'hot' };
    return [...new Set(array(list).map(key=>aliases[key]||key).filter(key=>keys.includes(key)))];
  }
  const api = {VERSION,classify,discover,assess,koreanConflict,publisherKeys,evidenceOf,migratePreferences};
  if(typeof module!=='undefined')module.exports=api;
  else globalThis.KW_CATEGORY_POLICY=api;
})();
