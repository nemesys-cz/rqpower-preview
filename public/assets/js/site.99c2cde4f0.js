window.RQ_STATIC=true;

document.querySelectorAll('.wp-block-navigation').forEach(function(nav){
 var panel=nav.querySelector('.wp-block-navigation__responsive-container');
 var open=nav.querySelector('.wp-block-navigation__responsive-container-open');
 var close=nav.querySelector('.wp-block-navigation__responsive-container-close');
 if(!panel||!open||!close)return;
 function toggle(on){
  panel.classList.toggle('is-menu-open',on);panel.classList.toggle('has-modal-open',on);document.documentElement.classList.toggle('has-modal-open',on);
  open.setAttribute('aria-expanded',String(on));
  /* a real modal dialog while open: role + aria-modal + label, the page behind is inert, focus moves in and is restored on close */
  [].slice.call(document.querySelectorAll('main,footer')).forEach(function(el){if(on)el.setAttribute('inert','');else el.removeAttribute('inert');});
  if(on){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Hlavní navigace');close.focus();}
  else{panel.removeAttribute('role');panel.removeAttribute('aria-modal');panel.removeAttribute('aria-label');open.focus();}
 }
 open.addEventListener('click',function(){toggle(true)});close.addEventListener('click',function(){toggle(false)});
 panel.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){toggle(false)})});
 document.addEventListener('keydown',function(e){if(!panel.classList.contains('is-menu-open'))return;if(e.key==='Escape')toggle(false);if(e.key==='Tab'){var items=[].slice.call(panel.querySelectorAll('button,a')).filter(function(x){return x.offsetParent!==null});var first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
});

/*
 * rqpower Studio – interaction.js
 * Dependency-free progressive enhancement: service tabs, service filter, article filter,
 * deep-link reveal, two-step inquiry form (prefill, validation, summary), on-scroll reveal.
 * Everything is complete and readable without this file. No storage, no network, no timers
 * that delay content. Respects prefers-reduced-motion.
 * v4: only the two text arrows of the form step buttons became decorative .rq-ico spans (CSS-masked Lucide icons).
 * v5: compact inquiry form (visually-hidden step legend instead of a repeated step heading, service + timing and company +
 * location share a row, required/optional marked), active "Reference" navigation state for reference detail pages,
 * opacity-only reveal.
 * v6: a tap on the dim backdrop of the tablet / phone menu drawer closes it through the real close button (native dialog handling
 * and the portable export's handler both run); the demo form's completion text reads the e-mail from the page's shared contacts
 * instead of carrying its own copy.
 */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var isStatic = window.RQ_STATIC === true; // set by the portable export only

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function mk(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) { n.className = cls; }
    if (text) { n.textContent = text; }
    return n;
  }
  function closest(el, sel) { return el && el.closest ? el.closest(sel) : null; }
  function smoothTo(el) {
    if (!el || !el.scrollIntoView) { return; }
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  function replay(el) {
    if (reduced) { return; }
    el.classList.remove('is-in');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('is-in');
  }

  /* Service catalogue shared by the inquiry form (slugs are the public allowlist) */
  var SVC = {
    'analyza': {
      label: 'Analýza spotřeby', submit: 'Odeslat poptávku analýzy',
      help: 'Např. jaký provoz nebo budovu řešíte a proč vás zajímá spotřeba energie. Dřívější měření můžete zmínit.'
    },
    'elektroprojekce': {
      label: 'Elektroprojekční činnost', submit: 'Odeslat poptávku projekce',
      help: 'Např. zda jde o novou halu, přestavbu nebo úpravu rozvodů a jaké podklady už máte.'
    },
    'technologie-vyroby': {
      label: 'Technologie', submit: 'Odeslat poptávku technologií',
      help: 'Např. jakou technologii hledáte (monitoring, záložní zdroj, úložiště) a k čemu má sloužit.'
    },
    'montaze': {
      label: 'Instalace', submit: 'Odeslat poptávku instalace',
      help: 'Např. co se má instalovat, doplnit nebo přesunout a ve kterém provozu.'
    },
    'servis': {
      label: 'Servis', submit: 'Odeslat poptávku servisu',
      help: 'Např. o jakou technologii jde, kde je instalovaná a co chcete řešit.'
    },
    'revize': {
      label: 'Revize', submit: 'Odeslat poptávku revize',
      help: 'Např. jakého zařízení nebo instalace se revize týká a zda jde o výchozí nebo pravidelnou kontrolu.'
    },
    'konzultace': {
      label: 'Nevíme zatím', submit: 'Odeslat dotaz ke konzultaci',
      help: 'Stručně popište provoz a co chcete probrat. Přesnou službu znát nemusíte.'
    }
  };

  /* ------------------------------------------------------------------ *
   * Header: mark current page link (custom nav links get no state from core)
   * ------------------------------------------------------------------ */
  function norm(p) { return (p || '').replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/'; }
  function initNavCurrent() {
    var here = norm(location.pathname);
    var isRef = doc.body.classList.contains('rq-is-reference');
    var isPost = doc.body.classList.contains('single-post') && !isRef;
    $$('.rq-site-header .wp-block-navigation a[href]').forEach(function (a) {
      if (closest(a, '.rq-nav-cta')) { return; }
      var path = norm(a.pathname);
      var match = path === here ||
        (isPost && /(^|\/)clanky(\.html)?$/.test(path)) ||
        (isRef && /(^|\/)reference(\.html)?$/.test(path));
      if (match && path !== '/') { a.setAttribute('aria-current', 'page'); }
    });
  }

  /* ------------------------------------------------------------------ *
   * Home: service selector (tabs). Markup is plain links + stacked panels;
   * JS turns it into an ARIA tab interface.
   * ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ *
   * Tablet / phone menu: a tap on the dim backdrop (the open overlay container itself, never the panel) clicks the real close
   * button, so core's dialog handling on the live site and the export's own handler (inert background, focus return) both run.
   * ------------------------------------------------------------------ */
  function initNavBackdrop() {
    doc.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('wp-block-navigation__responsive-container') || !t.classList.contains('is-menu-open')) { return; }
      var b = t.querySelector('.wp-block-navigation__responsive-container-close');
      if (b) { b.click(); }
    });
  }

  /* The shared contact e-mail as the page renders it (the note under the form); never a copy of its own. */
  function contactEmail() {
    var a = $('.rq-formnote a[href^="mailto:"]') || $('.rq-formcard a[href^="mailto:"]');
    var m = a ? /^mailto:([^?#\s]+)$/i.exec(a.getAttribute('href') || '') : null;
    return m && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m[1]) ? m[1] : '';
  }

  var tabApi = null;
  function initTabs() {
    var sec = $('.rq-selector');
    if (!sec) { return; }
    var nav = $('.rq-tabs', sec);
    var panels = $$('.rq-panel', sec);
    if (!nav || !panels.length) { return; }

    var list = mk('div', 'rq-tabs');
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Kategorie služeb');
    var tabs = [];
    $$('a', nav).forEach(function (a) {
      var id = (a.getAttribute('href') || '').replace(/^[^#]*#/, '');
      var panel = id ? doc.getElementById(id) : null;
      if (!panel) { return; }
      var b = mk('button', 'rq-tab', a.textContent.replace(/\s+/g, ' ').trim());
      b.type = 'button';
      b.id = 'tab-' + id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', id);
      b.setAttribute('aria-selected', 'false');
      b.tabIndex = -1;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', b.id);
      list.appendChild(b);
      tabs.push({ btn: b, panel: panel, id: id });
    });
    if (!tabs.length) { return; }
    nav.parentNode.replaceChild(list, nav);

    function activate(id, focus) {
      var found = false;
      tabs.forEach(function (t) {
        var on = t.id === id;
        found = found || on;
        t.btn.setAttribute('aria-selected', on ? 'true' : 'false');
        t.btn.tabIndex = on ? 0 : -1;
        var wasHidden = t.panel.hidden;
        t.panel.hidden = !on;
        if (on && wasHidden) { replay(t.panel); }
        if (on && focus) { t.btn.focus(); }
      });
      return found;
    }
    tabs.forEach(function (t, i) {
      t.btn.addEventListener('click', function () { activate(t.id, false); });
      t.btn.addEventListener('keydown', function (e) {
        var n = tabs.length, to = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { to = (i + 1) % n; }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { to = (i - 1 + n) % n; }
        else if (e.key === 'Home') { to = 0; }
        else if (e.key === 'End') { to = n - 1; }
        if (to > -1) { e.preventDefault(); activate(tabs[to].id, true); }
      });
    });
    activate(tabs[0].id, false);
    tabApi = {
      activate: activate,
      // keyboard users who followed a quick link land on the selected tab (no scroll jump: the page is already scrolling to the section)
      focusTab: function (id) {
        tabs.forEach(function (t) { if (t.id === id) { t.btn.focus({ preventScroll: true }); } });
      },
      has: function (id) { return tabs.some(function (t) { return t.id === id; }); },
      section: sec
    };
  }

  /* ------------------------------------------------------------------ *
   * Services: category filter (section navigation without JS)
   * ------------------------------------------------------------------ */
  var filterApi = null;
  function initFilter() {
    var box = $('.rq-svcfilter');
    var cards = $$('.rq-svc');
    if (!box || !cards.length) { return; }
    var wrap = mk('div', 'rq-chips');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Filtr služeb podle zaměření');
    var btns = [];
    $$('p', box).forEach(function (p) {
      var m = /rq-f-([a-z]+)/.exec(p.className);
      if (!m) { return; }
      var b = mk('button', 'rq-chip', p.textContent.replace(/\s+/g, ' ').trim());
      b.type = 'button';
      b.setAttribute('data-cat', m[1]);
      b.setAttribute('aria-pressed', 'false');
      wrap.appendChild(b);
      btns.push(b);
    });
    if (!btns.length) { return; }
    var status = mk('p', 'rq-vh');
    status.setAttribute('role', 'status');
    box.parentNode.replaceChild(wrap, box);
    wrap.parentNode.insertBefore(status, wrap.nextSibling);

    function set(cat) {
      var shown = 0;
      cards.forEach(function (c) {
        var ok = cat === 'all' || c.classList.contains('rq-cat-' + cat);
        c.hidden = !ok;
        if (ok) { shown += 1; if (cat !== 'all') { replay(c); } }
      });
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-cat') === cat ? 'true' : 'false'); });
      status.textContent = 'Zobrazeno služeb: ' + shown + '.';
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-cat')); }); });
    set('all');
    status.textContent = '';
    filterApi = { set: set };
  }

  /* ------------------------------------------------------------------ *
   * Articles: topic filter. Cards are always in the DOM; chips only exist when
   * the server found at least two real topics. Links work without JS (?tema=).
   * ------------------------------------------------------------------ */
  function initArticleFilter() {
    var chips = $$('.rq-artfilter [data-topic]');
    var cards = $$('.rq-articles [data-topic]');
    if (!chips.length || !cards.length) { return; }
    var status = mk('p', 'rq-vh');
    status.setAttribute('role', 'status');
    chips[0].parentNode.parentNode.appendChild(status);
    function set(topic, announce) {
      var shown = 0;
      cards.forEach(function (c) {
        var ok = topic === 'all' || c.getAttribute('data-topic') === topic;
        c.hidden = !ok;
        if (ok) { shown += 1; }
      });
      chips.forEach(function (c) {
        var on = c.getAttribute('data-topic') === topic;
        c.classList.toggle('is-active', on);
        if (on) { c.setAttribute('aria-current', 'true'); } else { c.removeAttribute('aria-current'); }
      });
      if (announce) { status.textContent = 'Zobrazeno článků: ' + shown + '.'; }
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function (e) {
        e.preventDefault();
        set(c.getAttribute('data-topic'), true);
      });
    });
    var wanted = null;
    try { wanted = new URLSearchParams(location.search).get('tema'); } catch (err) { wanted = null; }
    var known = chips.some(function (c) { return c.getAttribute('data-topic') === wanted; });
    set(known ? wanted : 'all', false);
  }

  /* ------------------------------------------------------------------ *
   * Deep links: reveal a target hidden by a tab, filter or closed <details>
   * ------------------------------------------------------------------ */
  function revealTarget(id) {
    var el = id ? doc.getElementById(id) : null;
    if (!el) { return false; }
    var inPanel = closest(el, '.rq-panel');
    var changed = false;
    if (inPanel && tabApi) { tabApi.activate(inPanel.id, false); changed = true; }
    var card = closest(el, '.rq-svc');
    if (card && card.hidden && filterApi) { filterApi.set('all'); changed = true; }
    var art = closest(el, '.rq-articles [data-topic]');
    if (art && art.hidden) {
      var allChip = $('.rq-artfilter [data-topic="all"]');
      if (allChip) { allChip.click(); changed = true; }
    }
    var d = closest(el, 'details');
    while (d) {
      if (!d.open) { d.open = true; changed = true; }
      d = d.parentElement ? closest(d.parentElement, 'details') : null;
    }
    if (changed) { smoothTo(inPanel && tabApi ? tabApi.section : el); }
    return changed;
  }
  function currentHashId() {
    var h = location.hash || '';
    if (h.length < 2) { return ''; }
    try { return decodeURIComponent(h.slice(1)); } catch (e) { return h.slice(1); }
  }
  function initDeepLinks() {
    doc.addEventListener('click', function (e) {
      var a = closest(e.target, 'a[href*="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) { return; }
      if (norm(a.pathname) !== norm(location.pathname) || !a.hash || a.hash.length < 2) { return; }
      var id;
      try { id = decodeURIComponent(a.hash.slice(1)); } catch (err) { id = a.hash.slice(1); }
      var target = doc.getElementById(id);
      if (!target) { return; }
      var hiddenTarget = (tabApi && (tabApi.has(id) || closest(target, '.rq-panel'))) ||
        (closest(target, '.rq-svc') && closest(target, '.rq-svc').hidden) ||
        (closest(target, '.rq-articles [data-topic]') && closest(target, '.rq-articles [data-topic]').hidden);
      if (hiddenTarget) {
        e.preventDefault();
        if (window.history && history.pushState) { history.pushState(null, '', a.hash); }
        revealTarget(id);
        if (!closest(target, '.rq-panel') && !(tabApi && tabApi.has(id))) { smoothTo(target); }
        // only a user-activated anchor moves focus (never on page load or hashchange): to the selected tab of that panel
        var panelEl = closest(target, '.rq-panel');
        if (tabApi && panelEl && tabApi.has(panelEl.id)) { tabApi.focusTab(panelEl.id); }
      }
    });
    window.addEventListener('hashchange', function () { revealTarget(currentHashId()); });
    var id = currentHashId();
    if (id) {
      var t = doc.getElementById(id);
      var wasChanged = revealTarget(id);
      if (!wasChanged && t && (closest(t, '.rq-panel') || (tabApi && tabApi.has(id)))) { smoothTo(tabApi ? tabApi.section : t); }
    }
  }

  /* ------------------------------------------------------------------ *
   * Inquiry form (WPForms 68): two short steps on top of the complete form
   * ------------------------------------------------------------------ */
  function initForm() {
    var form = $('form.wpforms-form');
    if (!form || form.getAttribute('data-rq-enhanced')) { return; }
    function ctl(n) {
      return form.querySelector('[name="wpforms[fields][' + n + ']"]') || form.querySelector('[name="wpforms[fields][' + n + '][]"]');
    }
    var f = { svc: ctl(20), firm: ctl(21), loc: ctl(22), when: ctl(23), msg: ctl(2), name: ctl(0), tel: ctl(5), mail: ctl(1), ok: ctl(13) };
    for (var k in f) { if (!f[k] || !closest(f[k], '.wpforms-field')) { return; } }
    function box(el) { return closest(el, '.wpforms-field'); }

    var cont = box(f.svc).parentNode;
    var submitBox = $('.wpforms-submit-container', form);
    var submit = $('.wpforms-submit', form);
    if (!submitBox || !submit) { return; }
    form.setAttribute('data-rq-enhanced', '1');
    form.noValidate = true; // our own Czech validation replaces the native bubbles
    // Portable export: the submit button ships disabled with a visible notice; once this script has taken over, the form
    // works (and still never sends anything: see the isStatic branch of the submit handler).
    if (isStatic) {
      submit.disabled = false;
      submit.removeAttribute('aria-disabled');
      $$('.rq-nojs-note').forEach(function (n) { if (n.parentNode) { n.parentNode.removeChild(n); } });
    }

    /* panels */
    var p1 = mk('div', 'rq-step-panel'); p1.id = 'rq-step-1';
    var p2 = mk('div', 'rq-step-panel'); p2.id = 'rq-step-2';
    // v5: the step name is a visually-hidden legend (read by assistive tech, announced on focus); the single visible
    // indicator is the progress row, so label, heading and field label are no longer repeated on screen.
    var t1 = mk('span', 'rq-vh', 'Krok 1 ze 2: Co potřebujete');
    var t2 = mk('span', 'rq-vh', 'Krok 2 ze 2: Kontakt');
    t1.id = 'rq-step-1-title'; t2.id = 'rq-step-2-title';
    p1.tabIndex = -1; p2.tabIndex = -1;
    p1.setAttribute('role', 'group'); p1.setAttribute('aria-labelledby', t1.id);
    p2.setAttribute('role', 'group'); p2.setAttribute('aria-labelledby', t2.id);
    cont.insertBefore(p1, box(f.svc));
    cont.insertBefore(p2, p1.nextSibling);
    p1.appendChild(t1);
    // service + timing share a row, company + location share a row (WPForms already marks company/location as rq-half)
    box(f.svc).classList.add('rq-half');
    box(f.when).classList.add('rq-half');
    [f.svc, f.when, f.firm, f.loc, f.msg].forEach(function (c) { p1.appendChild(box(c)); });
    p2.appendChild(t2);

    // required / optional: asterisk comes from WPForms, optional fields say so in words
    var reqNote = mk('p', 'rq-reqnote', '* povinné pole; ostatní jsou nepovinná.');
    p1.insertBefore(reqNote, p1.children[1] || null);
    [f.when, f.firm, f.loc, f.msg, f.tel].forEach(function (c) {
      var lab = box(c).querySelector('label.wpforms-field-label') || box(c).querySelector('label');
      if (lab && !lab.querySelector('.rq-opt')) { lab.appendChild(mk('span', 'rq-opt', ' (nepovinné)')); }
    });
    // the service hint shares a half-width column: keep its meaning, shorten it to one line
    var svcDesc = box(f.svc).querySelector('.wpforms-field-description');
    if (svcDesc) { svcDesc.textContent = 'Nevíte? Zvolte „Nevíme zatím“.'; }
    // "Termín (nepovinné)" already says optional: the empty option reads "Vyberte termín" (display only, values and form 68 unchanged)
    for (var oi = 0; oi < f.when.options.length; oi++) {
      if (f.when.options[oi].value === '') { f.when.options[oi].textContent = 'Vyberte termín'; break; }
    }

    var summary = mk('div', 'rq-summary');
    var sumText = mk('p');
    var sumBtn = mk('button', '', 'Změnit');
    sumBtn.type = 'button';
    summary.appendChild(sumText);
    summary.appendChild(sumBtn);
    p2.appendChild(summary);
    [f.name, f.tel, f.mail, f.ok].forEach(function (c) { p2.appendChild(box(c)); });

    var nextBtn = mk('button', 'rq-btn');
    nextBtn.type = 'button';
    nextBtn.appendChild(doc.createTextNode('Pokračovat ke kontaktu '));
    var arrow = mk('span', 'rq-ico rq-ico--arrow-right'); arrow.setAttribute('aria-hidden', 'true');
    nextBtn.appendChild(arrow);
    var act1 = mk('div', 'rq-actions'); act1.appendChild(nextBtn); p1.appendChild(act1);

    var backBtn = mk('button', 'rq-btn rq-btn--ghost');
    backBtn.type = 'button';
    var backIcon = mk('span', 'rq-ico rq-ico--back'); backIcon.setAttribute('aria-hidden', 'true');
    backBtn.appendChild(backIcon);
    backBtn.appendChild(doc.createTextNode('Zpět'));
    var act2 = mk('div', 'rq-actions');
    act2.appendChild(backBtn);
    act2.appendChild(submitBox);
    p2.appendChild(act2);

    /* progress */
    var prog = mk('ol', 'rq-progress');
    prog.setAttribute('aria-label', 'Postup formuláře');
    var pi = [];
    ['Co potřebujete', 'Kontakt'].forEach(function (label, i) { // single visible step indicator
      var li = mk('li');
      li.appendChild(mk('span', 'rq-progress__n', String(i + 1)));
      li.appendChild(doc.createTextNode(label));
      prog.appendChild(li);
      pi.push(li);
    });
    cont.parentNode.insertBefore(prog, cont);

    /* project description helper */
    var descEl = box(f.msg).querySelector('.wpforms-field-description');
    if (!descEl) {
      descEl = mk('div', 'wpforms-field-description');
      descEl.id = (f.msg.id || 'rq-msg') + '-description';
      f.msg.parentNode.appendChild(descEl);
      f.msg.setAttribute('aria-describedby', descEl.id);
    }
    var defaultHelp = descEl.textContent;
    var defaultSubmit = submit.textContent;

    function slugOf() {
      var opt = f.svc.options[f.svc.selectedIndex];
      if (!opt || opt.disabled || !f.svc.value) { return ''; }
      if (SVC[f.svc.value]) { return f.svc.value; }
      var txt = opt.textContent.trim();
      for (var s in SVC) { if (SVC[s].label === txt) { return s; } }
      return '';
    }
    function refresh() {
      var s = slugOf();
      descEl.textContent = s ? SVC[s].help : defaultHelp;
      var label = s ? SVC[s].submit : defaultSubmit;
      submit.textContent = label;
      submit.setAttribute('data-submit-text', label);
      sumText.textContent = '';
      sumText.appendChild(doc.createTextNode('Vybraná služba: '));
      sumText.appendChild(mk('strong', '', s ? SVC[s].label : 'zatím nevybráno'));
    }

    /* validation */
    var phoneOk = function (v) { return /^[0-9+()\s.\/-]+$/.test(v) && v.replace(/\D/g, '').length >= 6; };
    var rules = [
      { step: 1, el: f.svc, test: function () { return slugOf() ? '' : 'Vyberte prosím, které služby se poptávka týká.'; } },
      { step: 2, el: f.name, test: function () { return f.name.value.trim() ? '' : 'Vyplňte prosím své jméno.'; } },
      { step: 2, el: f.tel, test: function () { var v = f.tel.value.trim(); return !v || phoneOk(v) ? '' : 'Zkontrolujte prosím telefon: použijte číslice, mezery, + nebo závorky.'; } },
      { step: 2, el: f.mail, test: function () {
        var v = f.mail.value.trim();
        if (!v) { return 'Vyplňte prosím e-mail.'; }
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Zadejte e-mail ve tvaru jmeno@firma.cz.';
      } },
      { step: 2, el: f.ok, test: function () { return f.ok.checked ? '' : 'Pro odeslání je potřeba souhlas se zpracováním osobních údajů.'; } }
    ];
    var summaries = { 1: null, 2: null };
    function errId(el) { return (el.id || ('rq-f-' + rules.map(function (r) { return r.el; }).indexOf(el))) + '-error'; }
    function clearOne(r) {
      var e = doc.getElementById(errId(r.el));
      if (e && e.parentNode) { e.parentNode.removeChild(e); }
      r.el.removeAttribute('aria-invalid');
      var d = (r.el.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== errId(r.el); });
      if (d.length) { r.el.setAttribute('aria-describedby', d.join(' ')); } else { r.el.removeAttribute('aria-describedby'); }
      r.msg = '';
    }
    function markOne(r, msg) {
      clearOne(r);
      r.msg = msg;
      r.el.setAttribute('aria-invalid', 'true');
      var e = mk('em', 'rq-error', msg);
      e.id = errId(r.el);
      box(r.el).appendChild(e);
      var d = (r.el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      d.push(e.id);
      r.el.setAttribute('aria-describedby', d.join(' '));
    }
    function drawSummary(step) {
      var old = summaries[step];
      if (old && old.parentNode) { old.parentNode.removeChild(old); }
      summaries[step] = null;
      var bad = rules.filter(function (r) { return r.step === step && r.msg; });
      if (!bad.length) { return; }
      var s = mk('div', 'rq-errsum');
      s.setAttribute('role', 'alert');
      s.tabIndex = -1;
      s.appendChild(mk('p', '', 'Před pokračováním prosím opravte:'));
      var ul = mk('ul');
      bad.forEach(function (r) {
        var li = mk('li');
        var a = mk('a', '', r.msg);
        a.href = '#' + (r.el.id || '');
        a.addEventListener('click', function (e) { e.preventDefault(); r.el.focus(); });
        li.appendChild(a);
        ul.appendChild(li);
      });
      s.appendChild(ul);
      var panel = step === 1 ? p1 : p2;
      panel.insertBefore(s, panel.children[1] || null);
      summaries[step] = s;
    }
    function validate(step, focus) {
      var firstBad = null;
      rules.forEach(function (r) {
        if (r.step !== step) { return; }
        var msg = r.test();
        if (msg) { markOne(r, msg); firstBad = firstBad || r.el; } else { clearOne(r); }
      });
      drawSummary(step);
      if (firstBad && focus) { firstBad.focus(); }
      return !firstBad;
    }
    rules.forEach(function (r) {
      var live = function () {
        if (r.el.getAttribute('aria-invalid') !== 'true') { return; }
        var msg = r.test();
        if (!msg) { clearOne(r); drawSummary(r.step); }
      };
      r.el.addEventListener('input', live);
      r.el.addEventListener('change', live);
    });

    /* step control */
    var current = 1;
    function go(n, focus) {
      current = n;
      p1.hidden = n !== 1;
      p2.hidden = n !== 2;
      pi.forEach(function (li, i) {
        li.classList.toggle('is-current', i === n - 1);
        li.classList.toggle('is-done', i < n - 1);
        if (i === n - 1) { li.setAttribute('aria-current', 'step'); } else { li.removeAttribute('aria-current'); }
      });
      refresh();
      replay(n === 1 ? p1 : p2);
      if (focus) {
        (n === 1 ? p1 : p2).focus({ preventScroll: true }); // the panel is a labelled group: the hidden legend is announced
        if (prog.getBoundingClientRect().top < 90) { smoothTo(prog); } // only when the form header scrolled out of view
      }
    }
    nextBtn.addEventListener('click', function () { if (validate(1, true)) { go(2, true); } });
    backBtn.addEventListener('click', function () { go(1, true); });
    sumBtn.addEventListener('click', function () { go(1, true); });
    f.svc.addEventListener('change', refresh);

    form.addEventListener('submit', function (e) {
      if (current === 1) { // Enter pressed in step 1 behaves like "continue"
        e.preventDefault(); e.stopImmediatePropagation();
        if (validate(1, true)) { go(2, true); }
        return;
      }
      if (!validate(2, true)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (isStatic) {
        e.preventDefault(); e.stopImmediatePropagation();
        var done = mk('div', 'rq-confirm wpforms-confirmation-container-full');
        done.setAttribute('role', 'status');
        done.tabIndex = -1;
        done.appendChild(mk('p', '', 'Ukázka formuláře byla dokončena. Zpráva nebyla odeslána. Pro skutečný kontakt použijte telefon nebo ' + (contactEmail() || 'e-mail uvedený na stránce') + '.'));
        form.parentNode.replaceChild(done, form);
        done.focus();
      }
    }, true);

    /* allowlisted prefill: ?sluzba=slug (invalid values are ignored, field stays editable) */
    var wanted = '';
    try { wanted = new URLSearchParams(location.search).get('sluzba') || ''; } catch (err) { wanted = ''; }
    if (wanted && Object.prototype.hasOwnProperty.call(SVC, wanted)) {
      for (var i = 0; i < f.svc.options.length; i++) {
        var o = f.svc.options[i];
        if (o.value === wanted || o.textContent.trim() === SVC[wanted].label) { f.svc.selectedIndex = i; break; }
      }
    }
    go(1, false);
    // nothing but go(1) moves the user: no scrolling, no focus stealing on load
  }

  /* ------------------------------------------------------------------ *
   * Subtle on-scroll reveal (content is visible unless the observer is running)
   * ------------------------------------------------------------------ */
  function initReveal() {
    if (reduced || !('IntersectionObserver' in window)) { return; }
    var els = $$('.rq-step, .rq-acard, .rq-svc, .rq-principle, .rq-role');
    if (!els.length) { return; }
    var alive = false;
    var io;
    try {
      io = new IntersectionObserver(function (entries) {
        alive = true;
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    } catch (err) { return; }
    var vh = window.innerHeight || 800;
    els.forEach(function (el) {
      el.classList.add('rq-reveal');
      var r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) { el.classList.add('is-visible'); } else { io.observe(el); }
    });
    root.classList.add('rq-reveal-on');
    // if the observer never reports back, nothing may stay hidden
    window.setTimeout(function () { if (!alive) { root.classList.add('rq-reveal-done'); } }, 1500);
  }

  function boot() {
    try { initNavCurrent(); } catch (e) { /* keep going */ }
    try { initNavBackdrop(); } catch (e7) { /* keep going */ }
    try { initTabs(); } catch (e1) { /* keep going */ }
    try { initFilter(); } catch (e2) { /* keep going */ }
    try { initArticleFilter(); } catch (e3) { /* keep going */ }
    try { initForm(); } catch (e4) { /* keep going */ }
    try { initDeepLinks(); } catch (e5) { /* keep going */ }
    try { initReveal(); } catch (e6) { /* keep going */ }
  }
  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', boot); } else { boot(); }
}());
