// Pull the header brand into the centre, arm at full fill, refresh only on release.
export function attachPullRefresh({ element, source, canStart, isBusy, refresh, threshold = 144 }) {
  let start = null, armed = false, refreshing = false, geometry = null;
  const paint = progress => {
    element.hidden = progress === 0 && !refreshing;
    element.style.setProperty('--pull-fill', `${Math.round(progress * 100)}%`);
    element.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
    element.classList.toggle('is-refreshing', refreshing);
    element.classList.toggle('is-armed', armed);
    source.classList.toggle('brand-pulled', !element.hidden);
    if (geometry) {
      const p = progress * progress * (3 - 2 * progress);
      element.style.setProperty('--pull-x', `${geometry.x + (innerWidth / 2 - geometry.x) * p}px`);
      element.style.setProperty('--pull-y', `${geometry.y + (innerHeight / 2 - geometry.y) * p}px`);
      element.style.setProperty('--pull-scale', String(1 + (geometry.scale - 1) * p));
    }
  };
  const measure = () => {
    const image = source.querySelector('.logo'), title = source.querySelector('h1');
    const icon = image.getBoundingClientRect(), heading = title.getBoundingClientRect();
    const style = getComputedStyle(title), gap = Math.max(0, heading.left - icon.right);
    element.style.setProperty('--pull-icon', `${icon.width}px`);
    element.style.setProperty('--pull-font', style.fontSize);
    element.style.setProperty('--pull-gap', `${gap}px`);
    // Measure the real text, not the flex item's remaining header width.
    const range = document.createRange(); range.selectNodeContents(title);
    const text = range.getBoundingClientRect();
    const width = icon.width + gap + text.width;
    const paddedWidth = width + 28;
    geometry = {x:icon.left + width / 2, y:icon.top + icon.height / 2,
      scale:Math.max(1, Math.min(1.8, (innerWidth - 32) / paddedWidth))};
  };
  const reset = () => { start = null; armed = false; if (!refreshing) paint(0); };
  const begin = event => {
    if (refreshing || start || isBusy() || event.touches.length !== 1 || !canStart()) return;
    if (event.target.closest?.('input,select,textarea,[contenteditable="true"],.sheet,.alert')) return;
    measure(); armed = false;
    const t = event.touches[0]; start = {x:t.clientX, y:t.clientY};
  };
  const move = event => {
    if (!start) return;
    if (event.touches.length !== 1 || !canStart() || isBusy()) { reset(); return; }
    const t = event.touches[0], dy = t.clientY - start.y, dx = Math.abs(t.clientX - start.x);
    if (!armed && dx > 14 && dx > Math.abs(dy)) { reset(); return; }
    if (armed) { if (event.cancelable) event.preventDefault(); paint(1); return; }
    if (dy <= 0) { paint(0); return; }
    if (dy < 8 || dx > dy) return;
    if (event.cancelable) event.preventDefault();
    const progress = Math.min(1, dy / threshold);
    armed = progress === 1; paint(progress);
  };
  const end = event => {
    if (!start) return;
    if (event.touches.length > 0) { reset(); return; }
    if (!armed || !canStart() || isBusy()) { reset(); return; }
    start = null; refreshing = true; paint(1);
    Promise.resolve().then(refresh).catch(() => {}).finally(() => { refreshing = false; reset(); });
  };
  const cancel = () => { if (!refreshing) reset(); };
  document.addEventListener('touchstart', begin, {passive:true});
  document.addEventListener('touchmove', move, {passive:false});
  document.addEventListener('touchend', end, {passive:true});
  document.addEventListener('touchcancel', cancel, {passive:true});
  document.addEventListener('visibilitychange', cancel);
  addEventListener('resize', cancel);
  paint(0);
  return () => {
    document.removeEventListener('touchstart', begin); document.removeEventListener('touchmove', move);
    document.removeEventListener('touchend', end); document.removeEventListener('touchcancel', cancel);
    document.removeEventListener('visibilitychange', cancel); removeEventListener('resize', cancel); cancel();
  };
}
