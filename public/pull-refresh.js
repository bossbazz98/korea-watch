// Own only a downward, one-finger gesture that starts at the top of the page.
export function attachPullRefresh({ element, canStart, isBusy, refresh, threshold = 144 }) {
  let start = null, refreshing = false;
  const paint = progress => {
    element.hidden = progress === 0 && !refreshing;
    element.style.setProperty('--pull-fill', `${Math.round(progress * 100)}%`);
    element.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    element.classList.toggle('is-refreshing', refreshing);
  };
  const cancel = () => { start = null; if (!refreshing) paint(0); };
  const begin = event => {
    cancel();
    if (refreshing || isBusy() || event.touches.length !== 1 || !canStart()) return;
    if (event.target.closest?.('input,select,textarea,[contenteditable="true"],.sheet,.alert')) return;
    const t = event.touches[0]; start = {x:t.clientX, y:t.clientY};
  };
  const move = event => {
    if (!start) return;
    if (event.touches.length !== 1 || !canStart() || isBusy()) { cancel(); return; }
    const t = event.touches[0], dy = t.clientY - start.y, dx = Math.abs(t.clientX - start.x);
    if (dx > 14 && dx > Math.abs(dy)) { cancel(); return; }
    if (dy <= 0) { paint(0); return; }
    if (dy < 8 || dx > dy) return;
    if (event.cancelable) event.preventDefault();
    const progress = Math.min(1, dy / threshold); paint(progress);
    if (progress < 1) return;
    start = null; refreshing = true; paint(1);
    // Paint the filled app mark before starting the request. No release is required.
    requestAnimationFrame(() => {
      Promise.resolve().then(refresh).catch(() => {}).finally(() => { refreshing = false; paint(0); });
    });
  };
  document.addEventListener('touchstart', begin, {passive:true});
  document.addEventListener('touchmove', move, {passive:false});
  document.addEventListener('touchend', cancel, {passive:true});
  document.addEventListener('touchcancel', cancel, {passive:true});
  document.addEventListener('visibilitychange', cancel);
  paint(0);
  return () => {
    document.removeEventListener('touchstart', begin); document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', cancel); document.removeEventListener('touchcancel', cancel);
    document.removeEventListener('visibilitychange', cancel); cancel();
  };
}
