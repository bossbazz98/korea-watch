const {pick,languages} = require('../../public/news-text');
const COPY = {
  th:{critical:'🔴 ด่วนมาก',high:'🟠 สำคัญ',normal:'ข่าวทั่วไป',pending:'กำลังแปลหัวข้อข่าว',test:'ทดสอบแจ้งเตือน',testBody:'ระบบส่งแจ้งเตือนถึงเครื่องนี้ได้แล้ว ข่าวด่วนจะเด้งแบบนี้'},
  en:{critical:'🔴 Urgent',high:'🟠 Important',normal:'News',pending:'Headline translation is pending',test:'Test notification',testBody:'Notifications can reach this device. News alerts will appear here.'},
  ko:{critical:'🔴 긴급',high:'🟠 중요',normal:'일반 뉴스',pending:'기사 제목 번역 준비 중',test:'알림 테스트',testBody:'이 기기로 알림을 보낼 수 있습니다. 뉴스 알림이 여기에 표시됩니다.'}
};
const languageOf = sub => languages.includes(sub?.lang) ? sub.lang : 'th';
function groups(subscribers) {
  return languages.map(lang=>({lang,subs:subscribers.filter(sub=>languageOf(sub)===lang)})).filter(group=>group.subs.length);
}
function notification(news,lang,{test=false}={}) {
  const copy=COPY[lang];
  if(test)return {title:'KOREA WATCH',body:copy.test+'\n'+copy.testBody};
  const tag=copy[news.level]||copy.normal;
  const headline=pick(news.title,lang)||(lang==='ko'?pick(news.titleKo,'ko'):'')||copy.pending;
  return {title:'KOREA WATCH',body:tag+'\n'+headline};
}
module.exports={languageOf,groups,notification};
