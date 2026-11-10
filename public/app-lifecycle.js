// Use wall-clock time so suspended timers cannot hide a long absence.
export function watchAppResume({onReturn,onOpen,storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)},now=Date.now,document:doc=document,window:win=window,timeout=10*60*1000}) {
  let background=0,visible=!doc.hidden;try{background=Number(storage.getItem('kw.backgroundAt'))||0}catch{}
  const hide=()=>{if(!visible)return;visible=false;background=now();try{storage.setItem('kw.backgroundAt',String(background))}catch{}};
  const open=()=>{
    if(doc.hidden||visible)return;visible=true;
    const elapsed=background?now()-background:0;background=0;
    try{storage.removeItem('kw.backgroundAt')}catch{}
    if(elapsed>timeout)onReturn();onOpen();
  };
  const change=()=>doc.hidden?hide():open();
  doc.addEventListener('visibilitychange',change);win.addEventListener('pagehide',hide);win.addEventListener('pageshow',open);
  if(visible){visible=false;open()}
  return()=>{doc.removeEventListener('visibilitychange',change);win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',open)};
}
