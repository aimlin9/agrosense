/* AgroSense website — navigation, motion and interactive widgets.
   Progressive: every page is fully usable without this file. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (!hasGsap || reduce) root.classList.remove('js-motion');

  /* ---------- Navigation ---------- */
  var nav = document.getElementById('nav');
  var lastY = window.scrollY;
  function onScroll() {
    var y = window.scrollY;
    if (nav) {
      nav.classList.toggle('solid', y > 12 || document.body.classList.contains('locked'));
      var goingDown = y > lastY && y > 320;
      nav.classList.toggle('hide', goingDown && !nav.classList.contains('drawer-open') && !document.querySelector('.nav-menu li.open'));
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Dropdowns: hover on pointer devices, click/keyboard everywhere
  document.querySelectorAll('.nav-menu li.has-menu').forEach(function (li) {
    var btn = li.querySelector('button');
    var timer;
    function open() { clearTimeout(timer); closeAll(li); li.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    function close() { li.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); li.classList.contains('open') ? close() : open(); });
    li.addEventListener('mouseenter', function () { if (window.matchMedia('(hover: hover)').matches) open(); });
    li.addEventListener('mouseleave', function () { timer = setTimeout(close, 140); });
    li.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); btn.focus(); } });
  });
  function closeAll(except) {
    document.querySelectorAll('.nav-menu li.open').forEach(function (o) {
      if (o !== except) { o.classList.remove('open'); var b = o.querySelector('button'); if (b) b.setAttribute('aria-expanded', 'false'); }
    });
  }
  document.addEventListener('click', function () { closeAll(); });

  // Mobile drawer
  var toggle = document.getElementById('menu-toggle');
  var drawer = document.getElementById('drawer');
  if (toggle && drawer) {
    toggle.addEventListener('click', function () {
      var open = !drawer.classList.contains('open');
      drawer.classList.toggle('open', open);
      nav.classList.toggle('drawer-open', open);
      document.body.classList.toggle('locked', open);
      toggle.setAttribute('aria-expanded', String(open));
      onScroll();
    });
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        drawer.classList.remove('open'); nav.classList.remove('drawer-open'); document.body.classList.remove('locked');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- Count-up numbers (works with or without GSAP) ---------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = (el.getAttribute('data-count').split('.')[1] || '').length;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduce) { el.textContent = prefix + target.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix; return; }
    var start = performance.now(), dur = 1600;
    function frame(t) {
      var p = Math.min(1, (t - start) / dur);
      var eased = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + (target * eased).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  } else counters.forEach(countUp);

  /* ---------- Pinned showcase (scroll-synced phone) ---------- */
  document.querySelectorAll('[data-showcase]').forEach(function (sc) {
    var steps = sc.querySelectorAll('.showcase-step');
    var imgs = sc.querySelectorAll('.showcase-phone img');
    var dots = sc.querySelectorAll('.showcase-progress i');
    function activate(i) {
      steps.forEach(function (s, j) { s.classList.toggle('active', j === i); });
      imgs.forEach(function (im, j) { im.classList.toggle('on', j === i); });
      dots.forEach(function (d, j) { d.classList.toggle('on', j === i); });
    }
    activate(0);
    if (!('IntersectionObserver' in window)) return;
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) activate(Array.prototype.indexOf.call(steps, e.target)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { sio.observe(s); });
  });

  /* ---------- Table of contents highlight ---------- */
  var toc = document.querySelector('.toc');
  if (toc && 'IntersectionObserver' in window) {
    var links = toc.querySelectorAll('a');
    var tio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) links.forEach(function (l) { l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    document.querySelectorAll('.prose h2[id]').forEach(function (h) { tio.observe(h); });
  }

  /* ---------- Crop guide filter & search ---------- */
  var guide = document.querySelector('[data-guide]');
  if (guide) {
    var items = guide.querySelectorAll('[data-guide-item]');
    var input = document.getElementById('guide-search');
    var chips = document.querySelectorAll('[data-crop-filter]');
    var empty = document.getElementById('guide-empty');
    var count = document.getElementById('guide-count');
    var crop = 'all';
    function apply() {
      var q = (input && input.value || '').trim().toLowerCase();
      var shown = 0;
      items.forEach(function (it) {
        var ok = (crop === 'all' || it.getAttribute('data-crop') === crop) && (!q || it.getAttribute('data-text').indexOf(q) !== -1);
        it.hidden = !ok;
        if (ok) shown++;
      });
      if (empty) empty.hidden = shown !== 0;
      if (count) count.textContent = shown + (shown === 1 ? ' condition' : ' conditions');
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        crop = c.getAttribute('data-crop-filter');
        chips.forEach(function (o) { o.setAttribute('aria-pressed', String(o === c)); });
        apply();
      });
    });
    if (input) input.addEventListener('input', apply);
    var hash = decodeURIComponent(location.hash.slice(1));
    if (hash) chips.forEach(function (c) { if (c.getAttribute('data-crop-filter') === hash) c.click(); });
    apply();
  }

  /* ---------- Help centre search ---------- */
  var helpSearch = document.getElementById('help-search');
  if (helpSearch) {
    var qa = document.querySelectorAll('.faq details');
    var groups = document.querySelectorAll('[data-help-group]');
    var none = document.getElementById('help-empty');
    helpSearch.addEventListener('input', function () {
      var q = helpSearch.value.trim().toLowerCase();
      var any = 0;
      qa.forEach(function (d) {
        var ok = !q || d.textContent.toLowerCase().indexOf(q) !== -1;
        d.hidden = !ok; if (ok) any++;
        if (q && ok) d.open = true; if (!q) d.open = false;
      });
      groups.forEach(function (g) { g.hidden = !g.querySelector('details:not([hidden])'); });
      if (none) none.hidden = any !== 0;
    });
  }

  /* ---------- Forms (static site: compose an email) ---------- */
  document.querySelectorAll('form[data-mailto]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll('[required]').forEach(function (f) {
        var field = f.closest('.field');
        var valid = f.type === 'email' ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value.trim()) : !!f.value.trim();
        if (field) field.classList.toggle('invalid', !valid);
        if (!valid) ok = false;
      });
      if (!ok) { var first = form.querySelector('.invalid input, .invalid select, .invalid textarea'); if (first) first.focus(); return; }
      var data = new FormData(form);
      var subject = form.getAttribute('data-subject') || 'AgroSense enquiry';
      if (data.get('topic')) subject += ' — ' + data.get('topic');
      var body = [];
      data.forEach(function (v, k) { if (v && k !== 'topic') body.push(k.charAt(0).toUpperCase() + k.slice(1) + ': ' + v); });
      window.location.href = 'mailto:' + form.getAttribute('data-mailto') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body.join('\n'));
      var success = form.parentElement.querySelector('.form-success');
      if (success) success.style.display = 'block';
    });
  });

  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- GSAP motion ---------- */
  if (!hasGsap || reduce) return;
  var gsap = window.gsap, ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);
  window.__motion = true;
  gsap.defaults({ ease: 'power3.out', duration: 0.9 });

  // Headline word-by-word rise
  document.querySelectorAll('[data-split]').forEach(function (el) {
    var html = el.innerHTML;
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    var out = '';
    tmp.childNodes.forEach(function (node) {
      var words = node.nodeType === 3 ? node.textContent.split(/(\s+)/) : null;
      if (words) {
        words.forEach(function (w) { out += /^\s+$/.test(w) || !w ? w : '<span class="split-line"><span>' + w + '</span></span>'; });
      } else {
        out += '<span class="split-line"><span>' + node.outerHTML + '</span></span>';
      }
    });
    el.innerHTML = out;
    gsap.to(el.querySelectorAll('.split-line > span'), {
      y: 0, duration: 1.1, ease: 'power4.out', stagger: 0.06, delay: el.closest('.hero, .page-hero') ? 0.15 : 0,
      scrollTrigger: el.closest('.hero, .page-hero') ? null : { trigger: el, start: 'top 85%' },
    });
  });

  // Reveal on scroll, batched for natural stagger
  ST.batch('[data-reveal]', {
    start: 'top 88%',
    onEnter: function (batch) {
      gsap.to(batch, { opacity: 1, y: 0, scale: 1, stagger: 0.09, duration: 1, overwrite: true });
    },
  });

  // Hero stage: entrance, floating, pointer parallax
  var stage = document.querySelector('.stage');
  if (stage) {
    var phones = stage.querySelectorAll('.phone');
    var floats = stage.querySelectorAll('.chip-float');
    gsap.from(phones, { y: 80, opacity: 0, rotate: function (i) { return i ? -12 : 6; }, duration: 1.4, ease: 'expo.out', stagger: 0.15, delay: 0.25 });
    gsap.from(floats, { y: 24, opacity: 0, scale: 0.92, duration: 1, stagger: 0.18, delay: 0.9, ease: 'back.out(1.6)' });
    floats.forEach(function (f, i) { gsap.to(f, { y: i % 2 ? 10 : -10, duration: 3 + i, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2 }); });
    gsap.to(stage.querySelector('.p1'), { yPercent: -10, ease: 'none', scrollTrigger: { trigger: stage, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to(stage.querySelector('.p2'), { yPercent: 8, ease: 'none', scrollTrigger: { trigger: stage, start: 'top top', end: 'bottom top', scrub: true } });
    if (window.matchMedia('(hover: hover)').matches) {
      stage.addEventListener('mousemove', function (e) {
        var r = stage.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(phones, { rotationY: x * 10, rotationX: -y * 8, duration: 0.8, ease: 'power2.out' });
        gsap.to(floats, { x: x * 24, duration: 0.8, ease: 'power2.out' });
      });
      stage.addEventListener('mouseleave', function () { gsap.to(phones, { rotationY: 0, rotationX: 0, duration: 1 }); gsap.to(floats, { x: 0, duration: 1 }); });
    }
  }

  // Parallax backgrounds and media
  document.querySelectorAll('.photo-band .bg').forEach(function (bg) {
    gsap.fromTo(bg, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: bg.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  document.querySelectorAll('[data-parallax]').forEach(function (el) {
    var amt = parseFloat(el.getAttribute('data-parallax')) || 40;
    gsap.fromTo(el, { y: amt }, { y: -amt, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  // Screens in feature rows rise into their frames
  document.querySelectorAll('.split-media .frame img.screen, .bento-shot img').forEach(function (img) {
    gsap.from(img, { y: 90, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: img, start: 'top 92%' } });
  });

  // Timeline progress line
  document.querySelectorAll('.timeline').forEach(function (tl) {
    var fill = tl.querySelector('.tl-fill');
    if (fill) gsap.to(fill, { height: 'calc(100% - 16px)', ease: 'none', scrollTrigger: { trigger: tl, start: 'top 70%', end: 'bottom 70%', scrub: true } });
  });

  // Reading progress on long pages
  var bar = document.querySelector('.progress-bar');
  if (bar) gsap.to(bar, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // Magnetic buttons
  if (window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-magnetic]').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.22, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.4, ease: 'power3.out' });
      });
      b.addEventListener('mouseleave', function () { gsap.to(b, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, .4)' }); });
    });
  }

  // Hover tilt on cards
  if (window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-tilt]').forEach(function (c) {
      c.addEventListener('mousemove', function (e) {
        var r = c.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        gsap.to(c, { rotationY: x * 6, rotationX: -y * 6, transformPerspective: 900, duration: 0.5, ease: 'power2.out' });
      });
      c.addEventListener('mouseleave', function () { gsap.to(c, { rotationY: 0, rotationX: 0, duration: 0.8 }); });
    });
  }

  window.addEventListener('load', function () { ST.refresh(); });
})();
