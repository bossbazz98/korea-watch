// Use original source evidence for category boundaries; never infer Korea from RSS hints.
(() => {
  const labels = typeof module !== 'undefined' ? require('./categories') : globalThis.KW_CATEGORIES;
  const news = typeof module !== 'undefined' ? require('./news-policy') : globalThis.KW_NEWS_POLICY;
  const keys = Object.keys(labels);
  const patterns = {
    war: /전쟁|공습|교전|휴전|폭격|포격|침공|무력\s*충돌|군사\s*충돌|전투(?!\s*준비)|내전|무장\s*분쟁|warfare|airstrike|ceasefire|invasion/i,
    disease: /감염병|전염병|바이러스|확진|독감|인플루엔자|코로나|백신|엠폭스|결핵|홍역|팬데믹|전염|infectious|virus|vaccine|outbreak/i,
    tech: /\bAI\b|인공지능|반도체|첨단\s*기술|신기술|기술\s*혁신|양자|로봇|자율주행|생성형|대규모\s*언어|artificial intelligence|semiconductor|innovation|technology/i,
    crypto: /암호화폐|가상\s*자산|가상\s*화폐|코인\s*(?:출시|발행|거래|상장)|(?:연예인|유명인|대통령|국가).{0,10}코인|비트코인|이더리움|알트코인|스테이블코인|밈코인|블록체인|토큰|crypto|bitcoin|ethereum|stablecoin|memecoin/i,
    foreign: /외국인|이주\s*노동자|이주민|고용허가제|E[‐‑–-]?9\b|비전문취업|노동법|근로기준법|고용노동부|인종\s*차별|foreign workers|migrant workers|racism/i,
    wage: /임금|급여|시급|minimum wage|salary|\bwages?\b/i,
    fx: /원화|원[·ㆍ\s/-]?달러|달러[·ㆍ\s/-]?원|원[·ㆍ\s/-]?엔|원[·ㆍ\s/-]?바트|\bKRW\b|Korean won/i,
    oil: /유가|원유|휘발유|경유|기름값|석유|에너지|재생에너지|태양광|풍력|수소|천연가스|액화가스|연료|전력|원자력|OPEC|energy|crude oil|fuel|renewable/i,
    thai: /태국|주한\s*태국|태국대사관|결혼\s*이민|결혼\s*비자|F[‐‑–-]?6\b|E[‐‑–-]?9\b|Thai|Thailand/i,
    president: /대통령|대통령실|청와대|국무총리|정부|president|government/i
  };
  const korea = /한국|대한민국|남한|남측|우리나라|서울|인천|부산|경기|고용허가제|고용노동부|근로기준법|E[‐‑–-]?9\b|비전문취업|South Korea|Korean won/i;
  const abroad = /북한|북측|김정은|캄보디아|태국|일본|중국|미국|러시아|우크라이나|이스라엘|이란|영국|프랑스|독일|베트남|인도네시아|트럼프|바이든|푸틴|시진핑|Cambodia|Japan|China|United States|Trump|Russia|Ukraine/i;
  function koreanConflict(text) {
    return /북한|북측|北(?=[ ,·…의은는가군]|미사일|발사|\b)|김정은|김여정|남북|대북|한반도|합참|합동참모본부|군사분계선|비무장지대|DMZ|휴전선|연평도|백령도|한미연합|North Korea|Korean Peninsula/i.test(text)
      && /미사일|로켓|방사포|핵|군사|포격|교전|전쟁|공습|훈련|긴장|도발|회담|제재|위협|침범|대피|경고사격|충돌|공격|지뢰|missile|military|attack|conflict/i.test(text);
  }
  function publisherKeys(input) {
    return [...new Set([input.publisherUrl || input.sourceUrl || input.link,
      ...(input.publishers || []), ...(input.links || []).map(l => l.publisherUrl || l.url),
      ...(input.alts || []).map(l => l.publisherUrl || l.link)].map(news.publisherKey).filter(Boolean))];
  }
  function classify(input, proposed = []) {
    const text = `${input.titleKo || ''} ${input.snippet || input.snippetKo || ''} ${input.article || ''} ${input.categoryEvidence || ''}`.replace(/北京/g, '베이징');
    const result = new Set(proposed.filter(key => keys.includes(key)));
    const sourceKnown = !!(input.publisherUrl || input.sourceUrl || input.link);
    const local = (!sourceKnown || news.trusted(input)) && (korea.test(text) || !abroad.test(text));
    for (const [key, re] of Object.entries(patterns)) if (re.test(text)) result.add(key);
    for (const key of ['foreign','wage','fx','thai','president']) if (sourceKnown && !news.trusted(input)) result.delete(key);
    for (const key of ['foreign','wage','president']) if (!local) result.delete(key);
    if (!patterns.fx.test(text)) result.delete('fx');
    const peninsula = koreanConflict(input.titleKo || text) || !!news.incident(input);
    if (peninsula) result.add('korwar'); else result.delete('korwar');
    if (!patterns.war.test(text) || peninsula || /AI\s*전쟁|인공지능\s*전쟁|반도체\s*전쟁|가격\s*전쟁|무역\s*전쟁|관세\s*전쟁|선거\s*전쟁|암과의\s*전쟁/.test(text)) result.delete('war');
    if (/(?:전쟁|전투).{0,8}(?:준비|대비|훈련|가능성)/.test(text) && !/공습|교전|폭격|침공|휴전/.test(text)) result.delete('war');
    if (/컴퓨터|악성코드|랜섬웨어|멀웨어|computer virus/i.test(text) && !/감염병|전염병|백신|환자/.test(text)) result.delete('disease');
    // Three independent, verified Korean publisher domains reporting the same story.
    // An AI label or a broad Google top-news feed alone is not popularity evidence.
    if (publisherKeys(input).length >= 3) result.add('hot'); else result.delete('hot');
    return keys.filter(key => result.has(key));
  }
  // Keep only short, verbatim source matches, not an entire article. This lets
  // scope checks survive deletion of the private translation snippet/article.
  function evidenceOf(input) {
    const text = `${input.titleKo || ''} ${input.snippet || input.snippetKo || ''} ${input.article || ''} ${input.categoryEvidence || ''}`;
    return [...new Set([korea, abroad, ...Object.values(patterns)].map(re => text.match(re)?.[0]).filter(Boolean))].join(' ').slice(0,512);
  }
  function migratePreferences(list) {
    const aliases = { law: 'foreign', korea: 'hot' };
    return [...new Set((Array.isArray(list) ? list : []).map(key => aliases[key] || key).filter(key => keys.includes(key)))];
  }
  const api = { classify, koreanConflict, publisherKeys, evidenceOf, migratePreferences };
  if (typeof module !== 'undefined') module.exports = api;
  else globalThis.KW_CATEGORY_POLICY = api;
})();
