// Ring feedback lives in document flow; only the feed moves below the fixed header.
export function attachPullRefresh({element,space,canStart,isBusy,refresh,threshold=80,language=()=> 'th',onReady=()=>{},onComplete=()=>{}}) {
  const ring=element.querySelector('.pull-ring'),message=element.querySelector('.pull-message');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const copy={th:{pulling:'ดึงเพื่อรีเฟรช',ready:'ปล่อยเพื่อรีเฟรช',loading:'กำลังอัปเดตข่าว…',finished:'อัปเดตข่าวแล้ว',error:'อัปเดตไม่สำเร็จ ลองดึงอีกครั้ง'},en:{pulling:'Pull to refresh',ready:'Release to refresh',loading:'Updating news…',finished:'News updated',error:'Update failed. Pull to try again'},ko:{pulling:'당겨서 새로고침',ready:'놓으면 새로고침',loading:'뉴스 업데이트 중…',finished:'업데이트됨',error:'업데이트하지 못했습니다. 다시 당겨 주세요'}};
  let start=null,phase='idle',timer=null,disposed=false;
  const setPhase=next=>{if(phase===next&&element.dataset.phase===next)return;const previous=phase;phase=next;element.dataset.phase=next;message.textContent=(copy[language()]||copy.th)[next]||'';ring.setAttribute('aria-label',message.textContent||(copy[language()]||copy.th).pulling);if(next==='ready'&&previous!=='ready')onReady()};
  const height=pixels=>space.style.height=`${pixels}px`;
  const progress=value=>{element.style.setProperty('--pull-progress',String(value));ring.setAttribute('aria-valuenow',String(Math.round(value*100)))};
  const close=()=>{start=null;element.hidden=true;space.hidden=true;setPhase('idle');height(0);space.classList.remove('is-dragging');document.documentElement.classList.remove('pull-active')};
  const collapse=()=>{if(space.hidden){clearTimeout(timer);close();return}start=null;space.classList.remove('is-dragging');height(0);phase='collapsing';clearTimeout(timer);timer=setTimeout(close,reduced.matches?120:430)};
  const finish=result=>{
    if(disposed)return;if(result?.busy){collapse();return}
    progress(1);onComplete(result);
    if(result?.ok===true){setPhase('finished');collapse()}
    else{setPhase('error');height(64);timer=setTimeout(collapse,1200)}
  };
  const begin=event=>{
    if(phase!=='idle'||isBusy()||event.touches.length!==1||!canStart())return;
    if(!event.target.closest?.('#home-page')||event.target.closest('input,select,textarea,[contenteditable="true"]'))return;
    const touch=event.touches[0];start={x:touch.clientX,y:touch.clientY,vertical:false};
  };
  const cancel=()=>{if(start||phase==='pulling'||phase==='ready'){start=null;collapse()}};
  const move=event=>{
    if(!start)return;if(event.touches.length!==1||!canStart()||isBusy()){cancel();return}
    const touch=event.touches[0],dy=touch.clientY-start.y,dx=Math.abs(touch.clientX-start.x);
    if(!start.vertical){if(dx>8&&dx>Math.abs(dy)){cancel();return}if(dy<-8){cancel();return}if(dy<8||dy<dx*1.3)return;start.vertical=true}
    if(event.cancelable)event.preventDefault();document.documentElement.classList.add('pull-active');
    element.hidden=false;space.hidden=false;space.classList.add('is-dragging');
    const pull=Math.min(108,Math.max(0,dy*.55));height(pull);progress(Math.min(1,pull/threshold));setPhase(pull>=threshold?'ready':'pulling');
  };
  const end=event=>{
    if(!start)return;if(event.touches.length||phase!=='ready'||!canStart()||isBusy()){cancel();return}
    start=null;space.classList.remove('is-dragging');setPhase('loading');height(56);ring.removeAttribute('aria-valuenow');
    try{Promise.resolve(refresh()).then(finish,()=>finish({ok:false}))}catch{finish({ok:false})}
  };
  document.addEventListener('touchstart',begin,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',end,{passive:true});document.addEventListener('touchcancel',cancel,{passive:true});document.addEventListener('visibilitychange',cancel);addEventListener('resize',cancel);close();
  return()=>{disposed=true;clearTimeout(timer);document.removeEventListener('touchstart',begin);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',cancel);document.removeEventListener('visibilitychange',cancel);removeEventListener('resize',cancel);close()};
}
