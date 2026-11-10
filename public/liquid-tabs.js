// A spring-driven optical lens. Only the original three buttons are interactive.
export function attachLiquidTabs({bar,onSelect}) {
  const lens=bar.querySelector('.tab-lens'),buttons=[...bar.querySelectorAll('.tab')];
  lens.classList.remove('glass');
  const row=document.createElement('div');row.className='tab-real-row';buttons.forEach(b=>row.append(b));bar.append(row);
  lens.innerHTML='<span class="lens-surface"></span><span class="lens-optics" aria-hidden="true"></span><span class="lens-rim"></span>';
  const optics=lens.querySelector('.lens-optics'),copies=[];
  for(const color of ['main','pink','blue','yellow','purple']){
    const plane=document.createElement('span');plane.className='lens-plane lens-'+color;
    const track=document.createElement('span');track.className='lens-copy-track';plane.append(track);optics.append(plane);copies.push({color,plane,track});
  }
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const values={x:0,w:125,h:52,surface:1,milk:0,icon:1,hold:0,stretch:0};
  const velocity=Object.fromEntries(Object.keys(values).map(k=>[k,0]));
  let targets={...values},frame=0,previous=0,pointer=null,sequence=null,visible=false,disposed=false,signature='',suppressed=0;
  let width=353,ratio=1,rowWidth=330,rowLeft=11.5,centers=[66.5,176.5,286.5];
  const selected=()=>Math.max(0,buttons.findIndex(b=>b.getAttribute('aria-current')==='page'));
  const nearest=x=>centers.reduce((best,c,i)=>Math.abs(c-x)<Math.abs(centers[best]-x)?i:best,0);
  const measure=()=>{width=bar.clientWidth;ratio=width/353;rowWidth=330*ratio;rowLeft=(width-rowWidth)/2;centers=[0,1,2].map(i=>rowLeft+(i+.5)*rowWidth/3);row.style.width=rowWidth+'px';row.style.left=rowLeft+'px'};
  const copyLabels=()=>{
    const next=buttons.map(b=>b.innerHTML).join('|');if(next===signature)return;signature=next;
    for(const {track} of copies){track.innerHTML=buttons.map(b=>`<span class="lens-tab">${b.innerHTML.replace(/\sid="[^"]*"/g,'')}</span>`).join('');track.style.width=rowWidth+'px'}
  };
  const rest=()=>({x:centers[selected()],w:125*ratio,h:52,surface:1,milk:0,icon:1,hold:0,stretch:0});
  const setState=state=>{bar.dataset.lensPhase=state};
  const paint=()=>{
    const speed=Math.abs(velocity.x),shrink=Math.min(.26,speed/2600),held=pointer?(pointer.engaged||performance.now()-pointer.started>=80):sequence?.kind==='release';
    const w=Math.max(1,values.w*(1-shrink));
    const h=held?Math.max(1,values.h*(1+shrink*.25)):clamp(values.h*(1+shrink*.25),1,56/(1+Math.max(0,values.hold)*.03));
    const x=held?values.x:clamp(values.x,3+w/2,width-3-w/2),y=31;
    lens.style.width=w+'px';lens.style.height=h+'px';lens.style.transform=`translate3d(${x-w/2}px,${y-h/2}px,0)`;
    const dark=document.documentElement.dataset.theme!=='light',rgb=dark?'54,58,67':'236,236,239';
    lens.querySelector('.lens-surface').style.cssText=`background:rgba(${rgb},${clamp(values.surface,0,1)});backdrop-filter:blur(${Math.max(0,values.milk)*10}px);-webkit-backdrop-filter:blur(${Math.max(0,values.milk)*10}px)`;
    lens.style.setProperty('--lens-edge',String(clamp(1-values.surface,0,1)));
    const k=clamp((h-56)/20,0,1),active=nearest(x);
    for(const {color,plane,track} of copies){
      const scale={main:1,pink:1.022+.026*k,blue:.982-.02*k,yellow:1.011+.013*k,purple:.991-.01*k}[color];
      const opacity={main:1,pink:.4,blue:.4,yellow:.28*k,purple:.28*k}[color];
      plane.style.opacity=String(opacity);plane.style.filter=`blur(${Math.max(0,values.milk)*.6+(color==='main'?0:.3+.8*k)}px)`;
      track.style.width=rowWidth+'px';track.style.left=(rowLeft-x+w/2)+'px';track.style.top=(h/2-26)+'px';
      track.style.transformOrigin=`${x-rowLeft}px 26px`;track.style.transform=`scale(${values.icon*scale})`;
      [...track.children].forEach((child,i)=>child.classList.toggle('active',i===active));
    }
    const mask=`radial-gradient(ellipse ${w/2}px ${h/2}px at ${x-rowLeft}px 26px,transparent 98%,#000 100%)`;
    row.style.maskImage=mask;row.style.webkitMaskImage=mask;
    const stretch=clamp(values.stretch,-12,12);
    bar.style.setProperty('--bar-scale-x',String(1+values.hold*.035+Math.abs(stretch)/width));
    bar.style.setProperty('--bar-scale-y',String(1+values.hold*.03));
    bar.style.setProperty('--bar-lift',(-values.hold*8)+'px');bar.style.setProperty('--bar-shift',(stretch/2)+'px');
  };
  const stage=time=>{
    if(pointer){
      const elapsed=time-pointer.started;
      if(pointer.dragging||elapsed>=170){
        pointer.engaged=true;bar.classList.add('is-engaged');const fast=pointer.dragging&&Math.abs(velocity.x)>240;
        targets={...targets,w:(fast?164:152)*ratio,h:fast?58:76,surface:0,milk:0,icon:fast?1.1:1.2,hold:1};setState(fast?'travel':'glass');
      }else if(elapsed>=80){targets={...targets,w:138*ratio,h:60,surface:.72,milk:1,icon:1.06,hold:.12};setState('milky')}
      return true;
    }
    if(!sequence)return false;
    const elapsed=time-sequence.started;
    if(sequence.kind==='release'){
      if(elapsed<110){targets={...targets,w:152*ratio,h:76,surface:0,milk:0,icon:1.2,hold:1};setState('glass')}
      else if(elapsed<260){targets={...targets,w:138*ratio,h:60,surface:.72,milk:1,icon:1.06,hold:0};setState('milky')}
      else{targets=rest();sequence=null;setState('rest')}
    }else{
      const milkAt=sequence.same?240:330,restAt=sequence.same?380:470;
      if(elapsed<150){targets={...targets,w:142*ratio,h:50,surface:0,milk:0,icon:1,hold:0};setState('travel')}
      else if(elapsed<milkAt){targets={...targets,w:128*ratio,h:56,surface:0,milk:0,icon:1.1,hold:0};setState('glass')}
      else if(elapsed<restAt){targets={...targets,w:138*ratio,h:56,surface:.72,milk:1,icon:1.06,hold:0};setState('milky')}
      else{targets=rest();sequence=null;setState('rest')}
    }
    return !!sequence;
  };
  const tick=time=>{
    frame=0;if(disposed||bar.hidden)return;
    if(reduced.matches){sequence=null;targets=rest();Object.assign(values,targets);Object.keys(velocity).forEach(k=>velocity[k]=0);paint();bar.dataset.lensState='idle';return}
    const staged=stage(time),dt=Math.min((time-(previous||time-16.67))/1000,1/30);previous=time;
    for(let i=0;i<4;i++)for(const key of Object.keys(values)){
      const stiffness=key==='x'?520:340,damping=2*Math.sqrt(stiffness)*(key==='x'?.78:.62),step=dt/4;
      velocity[key]+=((targets[key]-values[key])*stiffness-velocity[key]*damping)*step;values[key]+=velocity[key]*step;
    }
    if(!pointer&&sequence?.kind!=='release'&&targets.h<=56&&values.h>56){values.h=56;velocity.h=Math.min(0,velocity.h)}
    paint();
    if(staged||Object.keys(values).some(k=>Math.abs(targets[k]-values[k])>.015||Math.abs(velocity[k])>.04))frame=requestAnimationFrame(tick);
    else{Object.assign(values,targets);Object.keys(velocity).forEach(k=>velocity[k]=0);previous=0;paint();bar.dataset.lensState=pointer?'pressed':'idle'}
  };
  const animate=()=>{if(!disposed&&!bar.hidden&&!frame){previous=0;frame=requestAnimationFrame(tick)}};
  const releaseCapture=gesture=>{try{if(gesture?.button.hasPointerCapture(gesture.id))gesture.button.releasePointerCapture(gesture.id)}catch{}};
  const cancel=()=>{const gesture=pointer;pointer=null;releaseCapture(gesture);sequence=null;targets=rest();bar.classList.remove('is-engaged');bar.dataset.lensState='settling';setState('rest');animate()};
  const sync=({instant=false}={})=>{
    if(disposed)return;if(bar.hidden){cancel();visible=false;cancelAnimationFrame(frame);frame=0;return}
    measure();copyLabels();if(!pointer)targets.x=centers[selected()];
    if(!visible||instant||reduced.matches){sequence=null;targets=rest();Object.assign(values,targets);Object.keys(velocity).forEach(k=>velocity[k]=0);paint();bar.dataset.lensState='idle';setState('rest')}else animate();visible=true;
  };
  const local=event=>{const r=bar.getBoundingClientRect();return (event.clientX-r.left)/r.width*width};
  const down=event=>{
    const button=event.target.closest('.tab');if(!button||!buttons.includes(button)||!event.isPrimary||event.button!==0||pointer)return;
    measure();pointer={id:event.pointerId,button,startX:event.clientX,startY:event.clientY,started:performance.now(),engaged:false,dragging:false};sequence=null;targets.x=centers[buttons.indexOf(button)];targets.stretch=0;
    bar.dataset.lensState='pressed';try{button.setPointerCapture(event.pointerId)}catch{}animate();
  };
  const move=event=>{
    if(!pointer||pointer.id!==event.pointerId)return;
    const dx=event.clientX-pointer.startX,dy=event.clientY-pointer.startY;
    if(!pointer.engaged&&Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.3){cancel();return}
    if(Math.abs(dx)>6){pointer.dragging=true;pointer.engaged=true}
    if(pointer.engaged){if(event.cancelable)event.preventDefault();const x=local(event),bound=clamp(x,centers[0],centers[2]),extra=x-bound;targets.x=bound+extra*.35;targets.stretch=clamp(extra*.35,-12,12);bar.dataset.lensState='dragging';animate()}
  };
  const select=(index,kind,same=false)=>{onSelect(buttons[index].id);targets={...targets,x:centers[index],stretch:0};sequence=reduced.matches?null:{kind,started:performance.now(),same};if(reduced.matches){targets=rest();Object.assign(values,targets);paint();bar.dataset.lensState='idle'}else{bar.dataset.lensState='settling';animate()}};
  const up=event=>{
    if(!pointer||pointer.id!==event.pointerId)return;
    const gesture=pointer,index=gesture.engaged?nearest(local(event)):buttons.indexOf(gesture.button),same=index===selected();pointer=null;releaseCapture(gesture);suppressed=performance.now()+600;bar.classList.remove('is-engaged');select(index,gesture.engaged?'release':'tap',same);
  };
  const click=event=>{
    const button=event.target.closest('.tab');if(!button||!buttons.includes(button))return;
    event.preventDefault();event.stopImmediatePropagation();if(event.detail>0&&performance.now()<suppressed)return;
    const index=buttons.indexOf(button),same=index===selected();
    if(event.detail===0){cancel();onSelect(button.id);sync({instant:true})}else select(index,'tap',same);
  };
  const lost=event=>{if(pointer?.id===event.pointerId)cancel()};
  const visibility=()=>{if(document.hidden)cancel()};const resize=()=>sync({instant:true});
  bar.addEventListener('pointerdown',down);bar.addEventListener('pointermove',move);bar.addEventListener('pointerup',up);bar.addEventListener('pointercancel',cancel);bar.addEventListener('lostpointercapture',lost);bar.addEventListener('click',click,true);
  document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',resize);
  const observer=new ResizeObserver(resize);observer.observe(bar);sync({instant:true});
  return {sync,destroy(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();bar.removeEventListener('pointerdown',down);bar.removeEventListener('pointermove',move);bar.removeEventListener('pointerup',up);bar.removeEventListener('pointercancel',cancel);bar.removeEventListener('lostpointercapture',lost);bar.removeEventListener('click',click,true);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',resize)}};
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
