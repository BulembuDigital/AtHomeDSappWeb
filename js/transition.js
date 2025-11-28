// transitions.js — soft page transitions + skeleton helpers + link hijack
(function () {
  // Mount fade overlay once
  const fade = document.createElement('div');
  fade.className = 'ui-fade';
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(fade);
    // Mark the page as ready (animate in)
    document.querySelectorAll('.soft-page').forEach(n => {
      requestAnimationFrame(() => n.classList.add('is-ready'));
    });
  });

  // Intercept internal links with data-softnav (no hash/external)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-softnav]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || /^https?:\/\//i.test(href)) return;
    e.preventDefault();
    globalThis.Progress?.start();
    fade.classList.add('show');
    setTimeout(() => { location.href = href; }, 140);
  });

  // Expose tiny API for manual fades (when routing via JS)
  globalThis.SoftNav = {
    to(href) {
      globalThis.Progress?.start();
      fade.classList.add('show');
      setTimeout(() => { location.href = href; }, 140);
    },
    fadeIn() { fade.classList.remove('show'); },
    fadeOut() { fade.classList.add('show'); },
  };

  // Skeleton helpers (DOM factories)
  globalThis.Skeleton = {
    card() { return h('div', 'skeleton skeleton-card'); },
    list(rows = 3) {
      const wrap = h('div', 'skeleton-card skel-stack');
      for (let i = 0; i < rows; i++) {
        const row = h('div', 'skel-stack');
        row.append(h('div', 'skeleton sk-row lg'), h('div', 'skeleton sk-row sm'), h('div', 'skeleton sk-row sm'));
        wrap.append(row);
      }
      return wrap;
    },
    media() {
      const wrap = h('div', 'skeleton-card skel-stack');
      wrap.append(h('div', 'skeleton sk-media'), h('div', 'skeleton sk-row lg'), h('div', 'skeleton sk-row'));
      return wrap;
    },
    avatarLine() {
      const wrap = h('div', 'skeleton-card skel-inline');
      wrap.append(h('div', 'skeleton sk-avatar'), h('div', 'skeleton sk-row lg'), h('div', 'skeleton sk-row sm'));
      return wrap;
    }
  };

  function h(tag, cls) { const n = document.createElement(tag); if (cls) n.className = cls; return n; }
})();
