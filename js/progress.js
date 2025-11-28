// progress.js — a tiny top progress bar (NProgress vibes, no deps)
(function () {
  const el = document.createElement('div');
  el.id = 'top-progress';
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(el);
  });

  let active = false, timer = null;

  function start() {
    clear();
    active = true;
    el.classList.remove('is-done');
    el.classList.add('is-active');
    // gentle ramp
    timer = setTimeout(() => {
      if (active) el.style.width = '70%';
    }, 80);
  }

  function set(pct) {
    clear();
    active = true;
    el.classList.remove('is-done');
    el.classList.add('is-active');
    el.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }

  function done() {
    active = false;
    el.classList.remove('is-active');
    el.classList.add('is-done');
    el.style.width = '100%';
    clear();
    setTimeout(() => { el.style.width = '0%'; el.classList.remove('is-done'); }, 250);
  }

  function clear() { if (timer) { clearTimeout(timer); timer = null; } }

  globalThis.Progress = { start, set, done };
})();
