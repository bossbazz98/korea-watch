// Reveal a capsule in the document flow; the sticky header never moves.
export function attachPullRefresh({ element, space, canStart, isBusy, refresh, threshold = 64, language = () => 'th' }) {
  const ring = element.querySelector('.pull-ring'), message = element.querySelector('.pull-message');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const copy = {
    th:{pulling:'ดึงเพื่อรีเฟรช',ready:'ปล่อยเพื่อรีเฟรช',loading:'กำลังอัปเดตข่าว…',updated:'อัปเดตข่าวแล้ว',unchanged:'ยังไม่มีข่าวใหม่',error:'อัปเดตไม่สำเร็จ ลองดึงอีกครั้ง'},
    en:{pulling:'Pull to refresh',ready:'Release to refresh',loading:'Updating news…',updated:'News updated',unchanged:'No new stories',error:'Update failed. Pull to try again'}
  };
  let start = null, phase = 'idle', timer = null, disposed = false;
  const setPhase = next => {
    if (phase === next && element.dataset.phase === next) return;
    phase = next; element.dataset.phase = next;
    message.textContent = (copy[language()] || copy.th)[next] || '';
    ring.setAttribute('aria-label',message.textContent || (copy[language()] || copy.th).pulling);
  };
  const height = pixels => { space.style.height = `${pixels}px`; };
  const progress = value => {
    element.style.setProperty('--pull-progress', String(value));
    ring.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  };
  const close = () => {
    start = null; element.hidden = true; space.hidden = true; setPhase('idle'); height(0);
    space.classList.remove('is-dragging'); document.documentElement.classList.remove('pull-active');
  };
  const collapse = () => {
    if (space.hidden) { clearTimeout(timer); close(); return; }
    start = null; phase = 'collapsing'; space.classList.remove('is-dragging'); height(0);
    clearTimeout(timer); timer = setTimeout(close, reduced.matches ? 0 : 220);
  };
  const finish = result => {
    if (disposed) return;
    if (result?.busy) { collapse(); return; }
    setPhase(result?.ok === true ? result.changed ? 'updated' : 'unchanged' : 'error');
    progress(1); height(56);
    timer = setTimeout(collapse, 1000); // Feedback only; never delays the request or news display.
  };
  const begin = event => {
    if (phase !== 'idle' || isBusy() || event.touches.length !== 1 || !canStart()) return;
    if (!event.target.closest?.('main') || event.target.closest('input,select,textarea,[contenteditable="true"],.sheet,.alert')) return;
    const t = event.touches[0]; start = {x:t.clientX,y:t.clientY};
  };
  const cancel = () => {
    if (start || phase === 'pulling' || phase === 'ready') { start = null; collapse(); }
  };
  const move = event => {
    if (!start) return;
    if (event.touches.length !== 1 || !canStart() || isBusy()) { cancel(); return; }
    const t = event.touches[0], dy = t.clientY - start.y, dx = Math.abs(t.clientX - start.x);
    if (dx > 8 && dx > Math.abs(dy)) { cancel(); return; }
    if (dy <= 0) { if (phase !== 'idle') cancel(); return; }
    if (dy < 6 || dx > dy) return;
    if (event.cancelable) event.preventDefault();
    document.documentElement.classList.add('pull-active');
    element.hidden = false; space.hidden = false; space.classList.add('is-dragging');
    // Feed motion follows the finger with resistance, then softens beyond the threshold.
    height(Math.min(104, dy <= threshold ? dy * .85 : threshold * .85 + Math.sqrt(dy - threshold) * 3));
    progress(Math.min(1,dy / threshold)); setPhase(dy >= threshold ? 'ready' : 'pulling');
  };
  const end = event => {
    if (!start) return;
    if (event.touches.length || phase !== 'ready' || !canStart() || isBusy()) { cancel(); return; }
    start = null; space.classList.remove('is-dragging'); setPhase('loading'); height(56);
    ring.removeAttribute('aria-valuenow');
    // Start the existing loader on release, without waiting for an animation or timer.
    try { Promise.resolve(refresh()).then(finish, () => finish({ok:false})); }
    catch { finish({ok:false}); }
  };
  document.addEventListener('touchstart',begin,{passive:true});
  document.addEventListener('touchmove',move,{passive:false});
  document.addEventListener('touchend',end,{passive:true});
  document.addEventListener('touchcancel',cancel,{passive:true});
  document.addEventListener('visibilitychange',cancel); addEventListener('resize',cancel);
  close();
  return () => {
    disposed = true; clearTimeout(timer);
    document.removeEventListener('touchstart',begin); document.removeEventListener('touchmove',move);
    document.removeEventListener('touchend',end); document.removeEventListener('touchcancel',cancel);
    document.removeEventListener('visibilitychange',cancel); removeEventListener('resize',cancel); close();
  };
}
