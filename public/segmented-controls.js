// Keep native buttons/radios; only the decorative capsule moves.
export function attachSlidingSegments(root,{initial=null}={}) {
  const options=[...root.children].filter(el=>el.matches('button,label'));
  const thumb=document.createElement('span');thumb.className='segment-thumb';thumb.setAttribute('aria-hidden','true');root.prepend(thumb);root.classList.add('sliding-segments');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  let frame=0,startFrame=0,until=0,disposed=false,keyboard=false,goal=null,firstResize=true;
  const selection=()=>options.find(el=>el.matches('.selected,[aria-pressed="true"]')||el.querySelector('input:checked'))||options[0];
  const rect=el=>({x:el.offsetLeft,y:el.offsetTop,width:el.offsetWidth,height:el.offsetHeight});
  const current=()=>{const box=thumb.getBoundingClientRect(),outer=root.getBoundingClientRect();return{x:box.left-outer.left-root.clientLeft,y:box.top-outer.top-root.clientTop,width:box.width,height:box.height,instant:keyboard||reduced.matches}};
  const ink=()=>{
    const box=thumb.getBoundingClientRect(),center=box.left+box.width/2;
    const nearest=options.reduce((best,el)=>{const a=best.getBoundingClientRect(),b=el.getBoundingClientRect();return Math.abs(center-b.left-b.width/2)<Math.abs(center-a.left-a.width/2)?el:best},options[0]);
    options.forEach(el=>el.classList.toggle('segment-ink',el===nearest));
  };
  const follow=()=>{frame=0;if(disposed)return;ink();if(performance.now()<until)frame=requestAnimationFrame(follow)};
  const paint=(value,instant)=>{
    root.classList.toggle('segment-no-motion',instant);
    thumb.style.transform=`translate3d(${value.x}px,${value.y}px,0)`;thumb.style.width=value.width+'px';thumb.style.height=value.height+'px';
    if(instant){cancelAnimationFrame(frame);frame=0;thumb.getBoundingClientRect();ink()}
    else{until=performance.now()+320;if(!frame)frame=requestAnimationFrame(follow)}
  };
  const sync=({instant=keyboard||reduced.matches}={})=>{
    if(disposed)return;const next=rect(selection());
    if(!instant&&goal&&Object.keys(next).every(key=>Math.abs(next[key]-goal[key])<.1))return;
    goal=next;paint(next,instant);
  };
  const down=()=>{keyboard=false};
  const key=event=>{if(event.key==='Enter'||event.key===' ')keyboard=true};
  root.addEventListener('pointerdown',down,true);root.addEventListener('keydown',key,true);
  const resize=new ResizeObserver(()=>{if(firstResize){firstResize=false;return}sync({instant:true})});resize.observe(root);
  const motion=()=>sync({instant:true});reduced.addEventListener('change',motion);
  if(initial&&!initial.instant&&!reduced.matches){paint(initial,true);startFrame=requestAnimationFrame(()=>{startFrame=0;sync({instant:false})})}else sync({instant:true});
  return {sync,snapshot:current,destroy(){disposed=true;cancelAnimationFrame(frame);cancelAnimationFrame(startFrame);resize.disconnect();reduced.removeEventListener('change',motion);root.removeEventListener('pointerdown',down,true);root.removeEventListener('keydown',key,true)}};
}
