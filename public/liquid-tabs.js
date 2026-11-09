// One moving lens: pointer tracking and release use separate spring damping.
export function attachLiquidTabs({bar,onSelect,holdMs=200}) {
  const lens=bar.querySelector('.tab-lens'),buttons=[...bar.querySelectorAll('.tab')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,lastTime=0,holdTimer=0,pointer=null,active=null,visible=false,disposed=false;
  let x=0,vx=0,targetX=0,press=0,vPress=0,targetPress=0,width=0,height=0,y=0,minX=0,maxX=0;
  let suppressed=null;
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const activeButton=()=>buttons.find(button=>button.getAttribute('aria-current')==='page')||buttons[0];
  const paint=()=>{
    lens.style.transform=`translate3d(${x}px,${y-press*5}px,0) scale(${1+press*.12},${1+press*.60})`;
    lens.style.width=`${width}px`;lens.style.height=`${height}px`;
  };
  const tick=time=>{
    frame=0;if(disposed||bar.hidden)return;
    if(reduced.matches){x=targetX;vx=0;press=vPress=0;paint();if(!pointer)bar.dataset.lensState='idle';return}
    const dt=Math.min((time-(lastTime||time-16.67))/1000,1/30);lastTime=time;
    const steps=4,step=dt/steps,dragging=pointer?.engaged;
    const stiffness=dragging?360:185,damping=dragging?34:22;
    for(let i=0;i<steps;i++){
      vx+=((targetX-x)*stiffness-vx*damping)*step;x+=vx*step;
      vPress+=((targetPress-press)*240-vPress*28)*step;press+=vPress*step;
      if(x<minX-3){x=minX-3;vx=Math.max(0,vx)}if(x>maxX+3){x=maxX+3;vx=Math.min(0,vx)}
    }
    paint();
    if(Math.abs(targetX-x)>.03||Math.abs(vx)>.05||Math.abs(targetPress-press)>.0005||Math.abs(vPress)>.001)frame=requestAnimationFrame(tick);
    else{x=targetX;press=targetPress;vx=vPress=0;lastTime=0;paint();if(!pointer)bar.dataset.lensState='idle'}
  };
  const animate=()=>{
    if(disposed||bar.hidden)return;
    if(reduced.matches){cancelAnimationFrame(frame);frame=0;x=targetX;vx=0;press=vPress=0;paint();if(!pointer)bar.dataset.lensState='idle';return}
    if(!frame){lastTime=0;frame=requestAnimationFrame(tick)}
  };
  const clearHover=()=>buttons.forEach(button=>button.classList.remove('is-hovered'));
  const nearest=clientX=>buttons.reduce((best,button)=>{
    const a=best.getBoundingClientRect(),b=button.getBoundingClientRect();
    return Math.abs(clientX-(b.left+b.width/2))<Math.abs(clientX-(a.left+a.width/2))?button:best;
  },buttons[0]);
  const track=clientX=>{
    const rect=bar.getBoundingClientRect();targetX=clamp(clientX-rect.left-bar.clientLeft-width/2,minX,maxX);
    const hovered=nearest(clientX);buttons.forEach(button=>button.classList.toggle('is-hovered',button===hovered));animate();
  };
  const releaseCapture=gesture=>{try{if(gesture?.button.hasPointerCapture(gesture.id))gesture.button.releasePointerCapture(gesture.id)}catch{}};
  const cancel=()=>{
    clearTimeout(holdTimer);const gesture=pointer;pointer=null;releaseCapture(gesture);targetPress=0;bar.classList.remove('is-engaged');clearHover();
    targetX=activeButton().offsetLeft;bar.dataset.lensState='settling';animate();
  };
  const measure=()=>{
    const selected=activeButton();width=selected.offsetWidth;height=selected.offsetHeight;y=selected.offsetTop;
    minX=buttons[0].offsetLeft;maxX=buttons.at(-1).offsetLeft;
  };
  const sync=({instant=false}={})=>{
    if(disposed)return;
    if(bar.hidden){cancel();visible=false;cancelAnimationFrame(frame);frame=0;press=vPress=0;return}
    const selected=activeButton();if(pointer&&active!==selected)cancel();measure();
    if(!pointer)targetX=selected.offsetLeft;
    if(!visible||instant){cancelAnimationFrame(frame);frame=0;x=targetX;vx=0;press=vPress=0;paint();if(!pointer)bar.dataset.lensState='idle'}else animate();
    active=selected;visible=true;
  };
  const engage=state=>{
    if(!pointer)return;pointer.engaged=true;targetPress=1;bar.classList.add('is-engaged');bar.dataset.lensState=state;track(pointer.lastX);
  };
  const down=event=>{
    const button=event.target.closest('.tab');if(!button||!buttons.includes(button)||bar.hidden||!event.isPrimary||event.button!==0||pointer)return;
    measure();pointer={id:event.pointerId,button,x:event.clientX,y:event.clientY,lastX:event.clientX,engaged:false};
    bar.dataset.lensState='pressed';holdTimer=setTimeout(()=>engage('held'),holdMs);
    try{button.setPointerCapture(event.pointerId)}catch{}
  };
  const move=event=>{
    if(!pointer||pointer.id!==event.pointerId)return;
    pointer.lastX=event.clientX;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
    if(!pointer.engaged){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.2){cancel();return}
      if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.2){clearTimeout(holdTimer);engage('dragging')}
    }
    if(pointer?.engaged){if(event.cancelable)event.preventDefault();track(event.clientX)}
  };
  const up=event=>{
    if(!pointer||pointer.id!==event.pointerId)return;
    clearTimeout(holdTimer);const gesture=pointer,selection=gesture.engaged?nearest(event.clientX):null;pointer=null;
    releaseCapture(gesture);targetPress=0;bar.classList.remove('is-engaged');clearHover();
    targetX=(selection||activeButton()).offsetLeft;bar.dataset.lensState='settling';animate();
    if(selection){suppressed={x:event.clientX,y:event.clientY,until:performance.now()+500};onSelect(selection.id)}
  };
  const click=event=>{
    if(suppressed&&event.detail>0&&performance.now()<suppressed.until&&Math.abs(event.clientX-suppressed.x)<4&&Math.abs(event.clientY-suppressed.y)<4){suppressed=null;event.preventDefault();event.stopImmediatePropagation()}
  };
  const lost=event=>{if(pointer?.id===event.pointerId)cancel()};
  const visibility=()=>{if(document.hidden)cancel()};
  const resize=()=>sync({instant:true});
  bar.addEventListener('pointerdown',down);bar.addEventListener('pointermove',move);bar.addEventListener('pointerup',up);bar.addEventListener('pointercancel',cancel);bar.addEventListener('lostpointercapture',lost);bar.addEventListener('click',click,true);
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',resize);
  const observer=new ResizeObserver(resize);observer.observe(bar);sync({instant:true});
  return {sync,destroy(){disposed=true;clearTimeout(holdTimer);cancelAnimationFrame(frame);observer.disconnect();bar.removeEventListener('pointerdown',down);bar.removeEventListener('pointermove',move);bar.removeEventListener('pointerup',up);bar.removeEventListener('pointercancel',cancel);bar.removeEventListener('lostpointercapture',lost);bar.removeEventListener('click',click,true);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',resize)}};
}

// Fixed docks already follow normal browser chrome. Lift them only for an
// additional visual-viewport obstruction, without double-counting safe areas.
export function attachDockViewport({isStandalone=()=>false}={}) {
  const viewport=window.visualViewport;let frame=0;
  const update=()=>{
    frame=0;const obstruction=!isStandalone()&&viewport&&Math.abs(viewport.scale-1)<.01?Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop):0;
    document.documentElement.style.setProperty('--dock-obstruction',`${Math.round(obstruction)}px`);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
  window.addEventListener('resize',schedule,{passive:true});viewport?.addEventListener('resize',schedule,{passive:true});viewport?.addEventListener('scroll',schedule,{passive:true});update();
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);viewport?.removeEventListener('resize',schedule);viewport?.removeEventListener('scroll',schedule)};
}
