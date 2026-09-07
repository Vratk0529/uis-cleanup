// ==UserScript==
// @name         UIS STUBA – prehľadnejší dashboard
// @namespace    https://is.stuba.sk/
// @version      1.1.0
// @description  Odstráni balast z osobnej administratívy UIS (hry, oznamy) a dá známky a rozvrh na prvé miesto.
// @author       Vratko Hajdučík
// @match        https://is.stuba.sk/auth/*
// @icon         https://is.stuba.sk/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Nastavenia
   * ------------------------------------------------------------------ */

  // Sekcie skryté v predvolenom nastavení. Kľúč je id divu (sekce-NN).
  // 165 = "Herňa pre chvíle oddychu" (hry), 31 = "Dokumentácia UIS",
  // 1001 = "Ochrana osobných údajov", 1281 = "Mobilná aplikácia Moje štúdium".
  const DEFAULT_HIDDEN = ['sekce-165', 'sekce-31', 'sekce-1001', 'sekce-1281'];

  // Poradie sekcií. Čím nižšie číslo, tým vyššie na stránke.
  // Sekcie, ktoré tu nie sú, skončia za nimi v pôvodnom poradí.
  const SECTION_ORDER = {
    'sekce-24': 1,   // Moje štúdium
    'sekce-27': 2,   // eLearning
    'sekce-29': 3,   // Osobný manažment
    'sekce-41': 4,   // Portál verejných informácií
    'sekce-34': 5,   // eAgenda
    'sekce-25': 6,   // Veda a výskum
    'sekce-40': 7,   // Prispôsobenie IS
    'sekce-32': 8,   // Nastavenie IS
  };

  const store = {
    get(key, fallback) {
      try {
        if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
      } catch (e) { /* padáme na localStorage */ }
      try {
        const raw = localStorage.getItem('uisbetter.' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try {
        if (typeof GM_setValue === 'function') { GM_setValue(key, value); return; }
      } catch (e) { /* padáme na localStorage */ }
      try { localStorage.setItem('uisbetter.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
  };

  const settings = {
    hidden: store.get('hiddenSections', DEFAULT_HIDDEN),
    collapseNotices: store.get('collapseNotices', true),
    showGrades: store.get('showGrades', true),
    showSchedule: store.get('showSchedule', true),
  };

  const isDashboard = /^\/auth\/(index\.pl)?$/.test(location.pathname);

  /* ------------------------------------------------------------------ *
   * Slovenčina ako predvolený jazyk
   * ------------------------------------------------------------------ */

  // Účet má v UIS nastavenú angličtinu, takže stránka otvorená bez ?lang=
  // príde po anglicky. Doplníme ho reťazcovo – prechod cez URLSearchParams
  // by query string preusporiadal a UIS by vrátil prázdnu stránku.
  // Explicitné lang=en (prepnutie vlajkou) rešpektujeme.
  function redirectedToSlovak() {
    if (/[?&]lang=/.test(location.search)) return false;
    const sep = location.search ? '&' : '?';
    location.replace(location.pathname + location.search + sep + 'lang=sk' + location.hash);
    return true;
  }
  if (redirectedToSlovak()) return;

  /* ------------------------------------------------------------------ *
   * Štýly
   * ------------------------------------------------------------------ */

  const CSS = `
  :root {
    --ub-accent: #8b1a3f;
    --ub-accent-soft: #f6ecf0;
    --ub-border: #dcd7d9;
    --ub-text: #2b2326;
    --ub-muted: #6f6569;
  }

  /* --- horná lišta rýchlych odkazov --- */
  #ub-bar {
    position: sticky; top: 0; z-index: 900;
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    padding: 8px 14px;
    background: #fff;
    border-bottom: 2px solid var(--ub-accent);
    box-shadow: 0 2px 6px rgba(0,0,0,.08);
    font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  #ub-bar .ub-link {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 12px; border-radius: 6px;
    color: var(--ub-text); text-decoration: none; font-weight: 600;
    border: 1px solid transparent; white-space: nowrap;
  }
  #ub-bar .ub-link:hover { background: var(--ub-accent-soft); border-color: var(--ub-border); }
  #ub-bar .ub-link.ub-primary { background: var(--ub-accent); color: #fff; }
  #ub-bar .ub-link.ub-primary:hover { background: #6f1533; }
  #ub-bar .ub-count {
    display: inline-block; min-width: 18px; padding: 1px 6px; border-radius: 9px;
    background: #ddd; color: #333; font-size: 11px; font-weight: 700; text-align: center;
  }
  #ub-bar .ub-count.ub-has { background: var(--ub-accent); color: #fff; }
  #ub-bar .ub-spacer { flex: 1 1 auto; }
  #ub-bar .ub-gear {
    cursor: pointer; border: 1px solid var(--ub-border); background: #fff;
    border-radius: 6px; padding: 6px 10px; font-size: 14px; line-height: 1;
  }
  #ub-bar .ub-gear:hover { background: var(--ub-accent-soft); }

  /* --- karty s obsahom --- */
  #ub-cards {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 14px; margin: 14px 14px 4px;
    font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--ub-text);
  }
  .ub-card {
    border: 1px solid var(--ub-border); border-radius: 10px; background: #fff;
    overflow: hidden; display: flex; flex-direction: column;
  }
  .ub-card h2 {
    margin: 0; padding: 10px 14px; font-size: 14px; font-weight: 700;
    background: var(--ub-accent); color: #fff;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .ub-card h2 a { color: #fff; font-size: 12px; font-weight: 600; opacity: .9; }
  .ub-card-body { padding: 10px 14px 14px; }
  .ub-empty { color: var(--ub-muted); font-style: italic; padding: 6px 0; }

  table.ub-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.ub-table th {
    text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em;
    color: var(--ub-muted); border-bottom: 1px solid var(--ub-border); padding: 4px 6px 6px;
  }
  table.ub-table td { padding: 5px 6px; border-bottom: 1px solid #f0edee; vertical-align: top; }
  table.ub-table tr:last-child td { border-bottom: 0; }
  table.ub-table td.ub-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--ub-muted); white-space: nowrap; }
  table.ub-table td.ub-num { text-align: right; white-space: nowrap; }

  .ub-mark {
    display: inline-block; min-width: 20px; padding: 1px 7px; border-radius: 4px;
    font-weight: 700; text-align: center; background: #eee;
  }
  .ub-mark.g-A, .ub-mark.g-B { background: #d8f0d8; color: #1d5c1d; }
  .ub-mark.g-C, .ub-mark.g-D { background: #fdf0cf; color: #6d5310; }
  .ub-mark.g-E { background: #fde4cf; color: #7a3f10; }
  .ub-mark.g-FX, .ub-mark.g-F { background: #f8d4d4; color: #8a1f1f; }
  .ub-mark.g-none { background: transparent; color: var(--ub-muted); font-weight: 400; }

  .ub-stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .ub-stat {
    flex: 1 1 90px; padding: 8px 10px; border-radius: 8px;
    background: var(--ub-accent-soft); border: 1px solid var(--ub-border);
  }
  .ub-stat b { display: block; font-size: 18px; line-height: 1.1; }
  .ub-stat span { font-size: 11px; color: var(--ub-muted); }

  /* --- zbalené oznamy --- */
  #ub-notices { margin: 12px 14px; font: 13px/1.45 system-ui, sans-serif; }
  #ub-notices > summary {
    cursor: pointer; padding: 8px 12px; border-radius: 8px;
    background: #f4f1f2; border: 1px solid var(--ub-border);
    font-weight: 600; color: var(--ub-muted); list-style: none;
  }
  #ub-notices > summary::-webkit-details-marker { display: none; }
  #ub-notices > summary::before { content: "▸ "; }
  #ub-notices[open] > summary::before { content: "▾ "; }
  #ub-notices[open] > summary { margin-bottom: 8px; }

  /* --- panel nastavení --- */
  #ub-settings {
    position: fixed; top: 56px; right: 14px; z-index: 950; width: 300px;
    background: #fff; border: 1px solid var(--ub-border); border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0,0,0,.18); padding: 14px;
    font: 13px/1.45 system-ui, sans-serif; color: var(--ub-text);
  }
  #ub-settings h3 { margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--ub-muted); }
  #ub-settings label { display: flex; gap: 8px; align-items: flex-start; padding: 3px 0; cursor: pointer; }
  #ub-settings hr { border: 0; border-top: 1px solid var(--ub-border); margin: 10px 0; }
  #ub-settings .ub-note { color: var(--ub-muted); font-size: 11.5px; margin-top: 10px; }

  /* --- zoštíhlená hlavička (zo 170 px na 46 px) ---
     #hlavicka má pevnú výšku 170 px, #univerzita je len veľký dekoratívny
     nadpis. Logo STU je pozadím #ie1, takže ten skrývať nemôžeme.
     Celé #menu (odkazy fakúlt, počítadlá, prihlásený) ide preč – počítadlá
     sú v našej lište a meno s odhlásením presúvame hore do #ie1. */
  body.ub-on #hlavicka { height: auto !important; }
  body.ub-on #ie1 {
    height: 46px !important;
    background-size: auto 30px !important;
    background-position: 14px 8px !important;
  }
  body.ub-on #univerzita,
  body.ub-on #menu { display: none !important; }

  body.ub-on #ub-topright {
    position: absolute; right: 8px; top: 0; height: 46px;
    display: flex; align-items: center; gap: 14px;
    font: 12px/1 system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff;
  }
  body.ub-on #ub-topright #svatek,
  body.ub-on #ub-topright #vlajky {
    position: static !important; display: flex; align-items: center; gap: 5px;
  }
  body.ub-on #ub-topright #log {
    float: none !important; display: flex; align-items: center; gap: 6px; white-space: nowrap;
  }
  body.ub-on #ub-topright a { color: #fff; }
  body.ub-on #ub-logout {
    display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px;
    border: 1px solid rgba(255,255,255,.45); border-radius: 5px;
    color: #fff; text-decoration: none; font-weight: 600; white-space: nowrap;
  }
  body.ub-on #ub-logout:hover { background: rgba(255,255,255,.16); }

  /* --- balast na konci stránky ---
     Šípky UIS pridáva a skrýva pri scrollovaní, preto ich radšej schováme
     cez CSS, než aby sme ich odstraňovali z DOM. */
  body.ub-on .operinfo,
  body.ub-on #automatic-back-to-home,
  body.ub-on #automatic-go-to-page-end { display: none !important; }

  body.ub-on .ub-hidden-section { display: none !important; }
  `;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.body.classList.add('ub-on');

  /* ------------------------------------------------------------------ *
   * Pomocníci
   * ------------------------------------------------------------------ */

  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.flat().forEach(k => k != null && n.append(k));
    return n;
  };

  const clean = s => (s || '').replace(/\s+/g, ' ').trim();

  async function fetchDoc(url, options) {
    const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, options));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }

  // UIS je na tvar query stringu chúlostivý – prechod cez URLSearchParams
  // ho preusporiada a server potom vráti prázdnu stránku. Preto href iba
  // doplníme na absolútnu cestu a inak sa ho nedotýkame.
  const resolveHref = href => {
    const u = new URL(href, location.href);
    return u.pathname + u.search;
  };

  // Prihlásený študent má viac štúdií; berieme odkazy z Portálu študenta.
  let studentDocPromise = null;
  const studentDoc = () => (studentDocPromise ||= fetchDoc('/auth/student/moje_studium.pl?lang=sk'));

  function linkByText(doc, text) {
    return [...doc.querySelectorAll('a')].find(a => clean(a.textContent) === text) || null;
  }

  /* ------------------------------------------------------------------ *
   * Horná lišta
   * ------------------------------------------------------------------ */

  function headerCounts() {
    // #ema má tvar: <a>0</a><a>správ</a> <a>3</a><a>dokumenty</a> <a>0</a><a>úloh</a>
    const out = {};
    const links = [...document.querySelectorAll('#ema a')];
    links.forEach(a => {
      const path = a.pathname || '';
      const n = clean(a.textContent);
      if (!/^\d+$/.test(n)) return;
      if (path.includes('/posta/')) out.mail = n;
      else if (path.includes('nove_dok')) out.docs = n;
      else if (path.includes('/todo/')) out.todo = n;
    });
    return out;
  }

  // Meniny sú v #svatek ako ikona s title="Meniny má" a textový uzol za ňou;
  // dátum s časom v tom istom bloku si necháme.
  function dropNameday(svatek) {
    [...svatek.childNodes].forEach((node, i, all) => {
      if (node.nodeType !== 1) return;
      const isNameday = [...node.querySelectorAll('img')].some(img => /meniny/i.test(img.title || ''));
      if (!isNameday) return;
      const next = all[i + 1];
      if (next && next.nodeType === 3) next.remove();
      node.remove();
    });
  }

  // Dátum, prihláseného používateľa, odhlásenie a vlajky zlúčime do jedného
  // riadka vpravo hore, aby mohol celý pruh #menu zmiznúť.
  function slimHeader() {
    const ie1 = document.getElementById('ie1');
    if (!ie1 || document.getElementById('ub-topright')) return;

    const cluster = el('div', { id: 'ub-topright' });
    const svatek = document.getElementById('svatek');
    if (svatek) { dropNameday(svatek); cluster.append(svatek); }

    const log = document.getElementById('log');
    if (log) cluster.append(log);

    const logout = document.querySelector('#ikonky a[href*="logout"]');
    if (logout) {
      logout.id = 'ub-logout';
      logout.textContent = 'Odhlásiť';
      cluster.append(logout);
    }

    const vlajky = document.getElementById('vlajky');
    if (vlajky) cluster.append(vlajky);

    ie1.append(cluster);
  }

  function buildBar() {
    const counts = headerCounts();

    const mk = (label, href, opts = {}) => {
      const a = el('a', { className: 'ub-link' + (opts.primary ? ' ub-primary' : ''), href, textContent: label });
      if (opts.count !== undefined) {
        a.append(' ', el('span', {
          className: 'ub-count' + (opts.count !== '0' ? ' ub-has' : ''),
          textContent: opts.count,
        }));
      }
      return a;
    };

    const bar = el('div', { id: 'ub-bar' },
      mk('📊 Známky', '/auth/student/pruchod_studiem.pl?lang=sk', { primary: true }),
      mk('🗓 Rozvrh', '/auth/katalog/rozvrhy_view.pl?lang=sk', { primary: true }),
      mk('🎓 Portál študenta', '/auth/student/moje_studium.pl?lang=sk'),
      mk('📝 Termíny skúšok', '/auth/student/terminy_seznam.pl?lang=sk'),
      mk('📚 Materiály', '/auth/dok_server/?lang=sk'),
      mk('✉️ Pošta', '/auth/posta/?lang=sk', { count: counts.mail ?? '0' }),
      mk('📄 Dokumenty', '/auth/dok_server/nove_dok.pl?lang=sk', { count: counts.docs ?? '0' }),
      mk('✅ Úlohy', '/auth/todo/?lang=sk', { count: counts.todo ?? '0' }),
      el('span', { className: 'ub-spacer' }),
      el('button', { className: 'ub-gear', textContent: '⚙', title: 'Nastavenia doplnku', onclick: toggleSettings }),
    );

    const anchor = document.getElementById('base') || document.body;
    anchor.parentNode.insertBefore(bar, anchor);
  }

  /* ------------------------------------------------------------------ *
   * Karta: Známky (E-index)
   * ------------------------------------------------------------------ */

  const GRADE_COL = {
    code: 'Kód', name: 'Predmet', end: 'Uk.', attempt: 'Pokus',
    result: 'Výsledok', credits: 'Kredity',
  };

  function columnIndexes(table) {
    const heads = [...table.querySelectorAll('tr:first-child th, tr:first-child td')]
      .map(c => clean(c.textContent));
    const idx = {};
    Object.entries(GRADE_COL).forEach(([key, label]) => { idx[key] = heads.indexOf(label); });
    return idx;
  }

  function markClass(result) {
    const m = clean(result).toUpperCase();
    if (!m) return 'g-none';
    if (/^FX/.test(m)) return 'g-FX';
    const first = m[0];
    return 'g-' + (['A', 'B', 'C', 'D', 'E', 'F'].includes(first) ? first : 'none');
  }

  async function renderGrades(body) {
    const doc = await studentDoc();
    const eindex = linkByText(doc, 'E-index') || linkByText(doc, 'E-study record');
    if (!eindex) throw new Error('Odkaz na E-index sa nenašiel.');

    const gd = await fetchDoc(resolveHref(eindex.getAttribute('href')));

    const table = gd.querySelector('#tmtab_1');
    if (!table) { body.append(el('p', { className: 'ub-empty', textContent: 'Zoznam predmetov sa nepodarilo načítať.' })); return; }

    const idx = columnIndexes(table);
    const rows = [...table.rows].slice(1).filter(r => r.cells.length > 2);

    const out = el('table', { className: 'ub-table' },
      el('thead', {}, el('tr', {},
        el('th', { textContent: 'Kód' }),
        el('th', { textContent: 'Predmet' }),
        el('th', { textContent: 'Uk.' }),
        el('th', { textContent: 'Výsledok' }),
        el('th', { textContent: 'Kr.' }),
      )),
    );
    const tbody = el('tbody');

    rows.forEach(r => {
      const cell = k => (idx[k] >= 0 && r.cells[idx[k]] ? clean(r.cells[idx[k]].textContent) : '');
      const result = cell('result');
      tbody.append(el('tr', {},
        el('td', { className: 'ub-code', textContent: cell('code') }),
        el('td', { textContent: cell('name') }),
        el('td', { className: 'ub-code', textContent: cell('end') }),
        el('td', {}, el('span', { className: 'ub-mark ' + markClass(result), textContent: result || '–' })),
        el('td', { className: 'ub-num', textContent: cell('credits') }),
      ));
    });

    out.append(tbody);
    body.append(rows.length ? out : el('p', { className: 'ub-empty', textContent: 'Zatiaľ žiadne zapísané predmety.' }));

    // Súhrnné čísla z druhej tabuľky (dvojstĺpcová: popis ~ hodnota).
    const stats = gd.querySelector('#tmtab_2');
    if (!stats) return;
    const pick = re => {
      const row = [...stats.rows].find(r => r.cells.length >= 2 && re.test(clean(r.cells[0].textContent)));
      return row ? clean(row.cells[1].textContent) : null;
    };
    const zapisane = pick(/^Počet zapísaných kreditov/i);
    const ziskane = pick(/^Počet získaných kreditov/i);
    const priemer = pick(/^Priemer z vyštudovaných predmetov za dané študijné obdobie$/i);

    const box = el('div', { className: 'ub-stats' });
    const add = (value, label) => value != null && box.append(
      el('div', { className: 'ub-stat' }, el('b', { textContent: value }), el('span', { textContent: label })),
    );
    add(ziskane, 'získaných kreditov');
    add(zapisane, 'zapísaných kreditov');
    add(priemer, 'priemer');
    if (box.children.length) body.append(box);
  }

  /* ------------------------------------------------------------------ *
   * Karta: Rozvrh
   * ------------------------------------------------------------------ */

  const ddmmyyyy = d => String(d.getDate()).padStart(2, '0') + '.' +
    String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();

  // Formulár rozvrhu je POST; prekopírujeme jeho vlastné polia a prepíšeme rozsah dní.
  function serializeForm(doc, overrides) {
    const params = new URLSearchParams();
    doc.querySelectorAll('input, select').forEach(f => {
      if (!f.name) return;
      if ((f.type === 'radio' || f.type === 'checkbox') && !f.checked) return;
      params.append(f.name, f.value);
    });
    Object.entries(overrides).forEach(([k, v]) => params.set(k, v));
    return params;
  }

  async function renderSchedule(body) {
    const doc = await studentDoc();
    const link = linkByText(doc, 'Osobný rozvrh') || linkByText(doc, 'Personal timetable');
    if (!link) throw new Error('Odkaz na osobný rozvrh sa nenašiel.');

    const scheduleUrl = resolveHref(link.getAttribute('href'));
    const formDoc = await fetchDoc(scheduleUrl);

    const from = new Date();
    const to = new Date(from.getTime() + 6 * 864e5);
    const params = serializeForm(formDoc, {
      typ_vypisu: 'konani',
      konani_od: ddmmyyyy(from),
      konani_do: ddmmyyyy(to),
      format: 'html',
    });

    const sd = await fetchDoc('/auth/katalog/rozvrhy_view.pl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    // Rozvrhová tabuľka je tá s najviac riadkami, ktorá nie je formulár.
    const tables = [...sd.querySelectorAll('table')]
      .filter(t => !t.querySelector('input, select') && t.rows.length > 1)
      .sort((a, b) => b.rows.length - a.rows.length);

    const table = tables[0];
    if (!table) {
      body.append(
        el('p', { className: 'ub-empty', textContent: 'Na najbližších 7 dní nie je zverejnený žiadny rozvrh.' }),
        el('p', {}, el('a', { href: scheduleUrl, textContent: 'Otvoriť nastavenie rozvrhu →' })),
      );
      return;
    }

    const copy = table.cloneNode(true);
    copy.className = 'ub-table';
    copy.removeAttribute('style');
    copy.querySelectorAll('[style], [width], [bgcolor]').forEach(n => {
      n.removeAttribute('style'); n.removeAttribute('width'); n.removeAttribute('bgcolor');
    });
    // Odkazy v tabuľke sú relatívne voči /auth/katalog/, nie voči nástenke.
    const base = new URL('/auth/katalog/rozvrhy_view.pl', location.origin).href;
    copy.querySelectorAll('a[href]').forEach(a => {
      a.href = new URL(a.getAttribute('href'), base).href;
    });
    body.append(el('div', { style: 'overflow-x:auto' }, copy));
  }

  /* ------------------------------------------------------------------ *
   * Skladanie kariet
   * ------------------------------------------------------------------ */

  function card(title, moreHref, moreLabel) {
    const bodyEl = el('div', { className: 'ub-card-body' },
      el('p', { className: 'ub-empty', textContent: 'Načítavam…' }));
    const cardEl = el('div', { className: 'ub-card' },
      el('h2', {}, title, moreHref ? el('a', { href: moreHref, textContent: moreLabel }) : null),
      bodyEl);
    return { cardEl, bodyEl };
  }

  function mountCards() {
    const wrap = el('div', { id: 'ub-cards' });
    const menitko = document.getElementById('menitko');
    const host = menitko || document.querySelector('.mainpage');
    if (!host) return;
    host.parentNode.insertBefore(wrap, host);

    const load = (title, href, label, fn) => {
      const { cardEl, bodyEl } = card(title, href, label);
      wrap.append(cardEl);
      fn(bodyEl)
        .then(() => { const p = bodyEl.querySelector('p.ub-empty'); if (p && p.textContent === 'Načítavam…') p.remove(); })
        .catch(err => {
          bodyEl.textContent = '';
          bodyEl.append(
            el('p', { className: 'ub-empty', textContent: 'Nepodarilo sa načítať: ' + err.message }),
            el('p', {}, el('a', { href, textContent: 'Otvoriť priamo v UIS →' })),
          );
        });
    };

    if (settings.showSchedule) {
      load('🗓 Rozvrh – najbližších 7 dní', '/auth/katalog/rozvrhy_view.pl?lang=sk', 'celý rozvrh', renderSchedule);
    }
    if (settings.showGrades) {
      load('📊 Známky a kredity', '/auth/student/pruchod_studiem.pl?lang=sk', 'celý E-index', renderGrades);
    }
  }

  /* ------------------------------------------------------------------ *
   * Upratanie sekcií a oznamov
   * ------------------------------------------------------------------ */

  // Väčšina sekcií má názov v title="" na .menu-drzak, niektoré (napr. odkaz
  // na mobilnú aplikáciu) nemajú ani ten, ani nadpis – tam vezmeme prvý odkaz.
  function sectionTitle(sec) {
    const drzak = clean((sec.querySelector('.menu-drzak') || {}).title);
    if (drzak) return drzak;
    const nadpis = clean((sec.querySelector('.sekce-nadpis') || {}).textContent);
    if (nadpis) return nadpis;
    const link = [...sec.querySelectorAll('a')].map(a => clean(a.textContent)).find(Boolean);
    return link || sec.id;
  }

  function allSections() {
    return [...document.querySelectorAll('div[id^="sekce-"]')]
      .map(sec => ({ id: sec.id, node: sec, title: sectionTitle(sec) }));
  }

  function applySections() {
    allSections().forEach(({ id, node }, i) => {
      node.classList.toggle('ub-hidden-section', settings.hidden.includes(id));
      // Grid rešpektuje `order`, takže nemusíme presúvať uzly a rozbiť drag & drop.
      node.style.order = SECTION_ORDER[id] ?? (100 + i);
    });
  }

  function collapseNotices() {
    if (!settings.collapseNotices) return;
    const container = document.querySelector('.zasadky-container');
    if (!container || container.dataset.ubDone) return;
    const notices = [...container.querySelectorAll('.zasadka')];
    if (!notices.length) return;

    container.dataset.ubDone = '1';
    const details = el('details', { id: 'ub-notices' },
      el('summary', { textContent: `Oznamy a výveska (${notices.length})` }));
    container.parentNode.insertBefore(details, container);
    details.append(container);
  }

  /* ------------------------------------------------------------------ *
   * Nastavenia
   * ------------------------------------------------------------------ */

  function toggleSettings() {
    const open = document.getElementById('ub-settings');
    if (open) { open.remove(); return; }

    const panel = el('div', { id: 'ub-settings' }, el('h3', { textContent: 'Zobrazené sekcie' }));

    allSections().forEach(({ id, title }) => {
      const cb = el('input', {
        type: 'checkbox',
        checked: !settings.hidden.includes(id),
        onchange() {
          settings.hidden = this.checked
            ? settings.hidden.filter(x => x !== id)
            : settings.hidden.concat(id);
          store.set('hiddenSections', settings.hidden);
          applySections();
        },
      });
      panel.append(el('label', {}, cb, el('span', { textContent: title })));
    });

    panel.append(el('hr'), el('h3', { textContent: 'Karty' }));

    const toggle = (key, label, storeKey) => {
      const cb = el('input', {
        type: 'checkbox',
        checked: settings[key],
        onchange() { settings[key] = this.checked; store.set(storeKey, this.checked); },
      });
      panel.append(el('label', {}, cb, el('span', { textContent: label })));
    };
    toggle('showSchedule', 'Karta s rozvrhom', 'showSchedule');
    toggle('showGrades', 'Karta so známkami', 'showGrades');
    toggle('collapseNotices', 'Zbaliť oznamy a vývesku', 'collapseNotices');

    panel.append(el('p', { className: 'ub-note', textContent: 'Zmeny kariet a oznamov sa prejavia po obnovení stránky.' }));
    document.body.append(panel);

    // Klik mimo panela ho zavrie.
    setTimeout(() => {
      const close = e => {
        if (!panel.contains(e.target) && !e.target.classList.contains('ub-gear')) {
          panel.remove();
          document.removeEventListener('click', close);
        }
      };
      document.addEventListener('click', close);
    }, 0);
  }

  /* ------------------------------------------------------------------ *
   * Štart
   * ------------------------------------------------------------------ */

  // buildBar číta počítadlá z #menu, ktoré je v tom čase už schované cez CSS –
  // textContent aj a.pathname fungujú aj na display:none prvkoch.
  // slimHeader musí ísť až po ňom, ten už #log a odhlásenie z #menu vyberá.
  buildBar();
  slimHeader();

  if (isDashboard) {
    applySections();
    collapseNotices();
    mountCards();
  }
})();
