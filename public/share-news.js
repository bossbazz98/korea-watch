const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const httpUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const input = document.createElement('textarea'); input.value = text; input.style.cssText = 'position:fixed;left:-9999px'; document.body.append(input); input.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {} input.remove(); return ok;
  }
}
function wrap(ctx, text, width, maxLines) {
  const graphemes = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(String(text))].map(x => x.segment) : Array.from(String(text));
  const lines = []; let line = '';
  for (let i = 0; i < graphemes.length; i++) {
    const c = graphemes[i];
    if (ctx.measureText(line + c).width > width && line) {
      lines.push(line.trim()); line = '';
      if (lines.length === maxLines) { let last=lines.at(-1); while (ctx.measureText(last+'…').width>width) last=last.slice(0,-1); lines[lines.length-1]=last+'…'; return lines; }
    }
    line += c;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}
async function loadImage(url) {
  if (!url) return null;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 3000);
  let blobUrl;
  try {
    const response = await fetch(url,{mode:'cors',credentials:'omit',signal:controller.signal,referrerPolicy:'no-referrer'});
    if (!response.ok) return null;
    blobUrl = URL.createObjectURL(await response.blob());
    return await new Promise(resolve => { const img = new Image(); img.onload=()=>resolve(img); img.onerror=()=>resolve(null); img.src=blobUrl; });
  } catch { return null; } finally { clearTimeout(timer); if (blobUrl) URL.revokeObjectURL(blobUrl); }
}
export async function makeSummaryImage({title,summary,category,source,image}) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width=600; canvas.height=900;
  const ctx=canvas.getContext('2d'); if (!ctx) throw Error('Canvas unavailable');
  ctx.fillStyle='#16181C';ctx.fillRect(0,0,600,900);
  const photo=await loadImage(httpUrl(image));
  if (photo) {const scale=Math.max(600/photo.width,310/photo.height),w=photo.width*scale,h=photo.height*scale;ctx.save();ctx.beginPath();ctx.rect(0,0,600,310);ctx.clip();ctx.drawImage(photo,(600-w)/2,(310-h)/2,w,h);ctx.restore();}
  else {ctx.fillStyle='#22252B';ctx.fillRect(0,0,600,310);ctx.fillStyle='#9A9FA8';ctx.font='700 42px "IBM Plex Sans Thai", sans-serif';ctx.fillText('KOREA WATCH',36,175);}
  ctx.fillStyle='#9A9FA8';ctx.font='400 18px Sarabun, sans-serif';ctx.fillText(category,36,352);
  ctx.fillStyle='#E8E9EC';ctx.font='700 32px "IBM Plex Sans Thai", sans-serif';const titles=wrap(ctx,title,528,4);let y=410;for(const line of titles){ctx.fillText(line,36,y);y+=51;}
  y+=20;ctx.fillStyle='#B7BCC5';ctx.font='400 23px Sarabun, sans-serif';for(const line of wrap(ctx,summary,528,3)){ctx.fillText(line,36,y);y+=39;}
  ctx.fillStyle='#2E3138';ctx.fillRect(36,797,528,1);
  const brand=await loadImage(new URL('/icons/icon-192.png',location.origin).href);if(brand)ctx.drawImage(brand,36,820,44,44);
  ctx.fillStyle='#E8E9EC';ctx.font='700 19px "IBM Plex Sans Thai", sans-serif';ctx.fillText('KOREA WATCH',94,846);
  ctx.fillStyle='#9A9FA8';ctx.font='400 13px Sarabun, sans-serif';ctx.fillText(wrap(ctx,source||'',320,1)[0]||'',94,869);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Image unavailable')),'image/png'));
}
export function openShareMenu({article,title,summary,category,icon,t,toast,onClose}) {
  document.getElementById('share-layer')?.remove();
  const url = new URL(location.pathname,location.origin);url.searchParams.set('id',String(article.id));
  const href=url.href, image=httpUrl(article.image), layer=document.createElement('div');
  layer.id='share-layer';layer.className='share-overlay';layer.innerHTML=`<section class="share-sheet glass" role="dialog" aria-modal="true" aria-labelledby="share-heading"><div class="grabber"></div><div class="sheet-heading"><h2 id="share-heading">${t('share')}</h2><button class="icon-button glass" data-share="close" aria-label="${t('close')}">${icon('close')}</button></div><div class="share-preview">${image?`<img src="${escape(image)}" alt="" referrerpolicy="no-referrer">`:'<img src="/icons/icon-192.png" alt="">'}<div><span class="chip">${escape(category)}</span><h3>${escape(title)}</h3><small>${escape(article.source||'')}</small></div></div><div class="share-apps">${[['line','LINE'],['facebook','Facebook'],['kakao','KakaoTalk']].map(([key,label])=>`<button class="share-app" data-share="${key}"><span class="social-mark ${key}">${key==='facebook'?'<svg viewBox="0 0 24 24"><path fill="currentColor" stroke="none" d="M14 23V13h3l.5-4H14V6.5c0-1 .3-1.5 1.8-1.5H18V1.3C17 .9 15.9.8 14.7.8c-3.2 0-5 2-5 5.2v3H7v4h2.7v10z"/></svg>':`<svg viewBox="0 0 48 48"><path d="M39 22c0 8-7 13-16 13l-8 5 1-7C10 30 7 27 7 22c0-8 7-13 16-13s16 5 16 13Z"/><text x="23" y="25" text-anchor="middle" fill="currentColor" stroke="none" style="font:bold ${key==='line'?'8':'6'}px sans-serif">${key==='line'?'LINE':'TALK'}</text></svg>`}</span><span>${label}</span></button>`).join('')}</div><button class="share-row" data-share="copy">${icon('link')}${t('copy')}${icon('chevron','chevron')}</button><button class="share-row" data-share="image">${icon('image')}${t('shareImage')}${icon('chevron','chevron')}</button><input class="share-link" readonly aria-label="${t('copy')}" value="${escape(href)}" hidden></section>`;
  document.body.append(layer); let disposed=false,objectUrl=null;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const close=()=>{if(disposed)return;disposed=true;document.removeEventListener('keydown',keys,true);if(objectUrl)URL.revokeObjectURL(objectUrl);layer.classList.add('closing');setTimeout(()=>{layer.remove();onClose?.();},reduced?120:430)};
  const keys=e=>{if(e.key==='Escape'){e.stopImmediatePropagation();close()}if(e.key==='Tab'){const nodes=[...layer.querySelectorAll('button:enabled,input:not([hidden])')].filter(el=>el.offsetParent!==null);if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus()}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus()}}};document.addEventListener('keydown',keys,true);
  const copy=async()=>{const ok=await copyText(href);if(ok){toast(t('copied'));close()}else{const field=layer.querySelector('.share-link');field.hidden=false;field.focus();field.select();toast(t('copyFailed'))}return ok};
  layer.addEventListener('click',async e=>{if(e.target===layer){close();return}const button=e.target.closest('[data-share]');if(!button)return;const action=button.dataset.share;
    try {
      if(action==='close'){close();return}
      if(action==='copy'){await copy();return}
      if(action==='line'){window.open('https://line.me/R/msg/text/?'+encodeURIComponent(title+'\n'+href),'_blank','noopener,noreferrer');return}
      if(action==='facebook'){window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(href),'_blank','noopener,noreferrer');return}
      if(action==='kakao'){if(navigator.share)await navigator.share({title,text:title,url:href});else if(await copy())toast(t('copyKakao'));return}
      if(action==='image'){
        button.disabled=true;const original=button.innerHTML;button.textContent=t('preparingImage');
        try {const blob=await makeSummaryImage({title,summary,category,source:article.source,image});if(disposed)return;objectUrl=URL.createObjectURL(blob);const file=new File([blob],'korea-watch-news.png',{type:'image/png'});const native=typeof navigator.canShare==='function'&&navigator.canShare({files:[file]});layer.innerHTML=`<section class="summary-preview" role="dialog" aria-modal="true" aria-labelledby="summary-preview-title"><div class="sheet-heading"><h2 id="summary-preview-title">${t('sharePreview')}</h2><button class="icon-button glass" data-share="close" aria-label="${t('close')}">${icon('close')}</button></div><img class="summary-result" src="${objectUrl}" alt="${escape(title)}"><button class="summary-share glass" data-share="send-image">${native?t('shareThis'):t('downloadImage')}</button></section>`;layer.querySelector('[data-share=close]').focus();layer.querySelector('[data-share=send-image]').onclick=async()=>{try{if(native)await navigator.share({files:[file],title});else{const a=document.createElement('a');a.href=objectUrl;a.download=file.name;a.click()}}catch(error){if(error.name!=='AbortError')toast(t('shareFailed'))}};
        }finally{if(button.isConnected){button.disabled=false;button.innerHTML=original}}
      }
    }catch(error){if(error.name!=='AbortError')toast(t('shareFailed'))}
  });
  let start=0;const sheet=layer.querySelector('.share-sheet');sheet.addEventListener('touchstart',e=>{start=e.touches[0].clientY},{passive:true});sheet.addEventListener('touchend',e=>{if(e.changedTouches[0].clientY-start>65&&sheet.scrollTop===0)close()},{passive:true});
  layer.querySelector('[data-share=close]').focus();return close;
}
