import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  DEFAULT_PRESS_INDEX,
  formatDate,
  hasTemplate,
  isEdsHostedUrl,
  isoDate,
  loadPressIndex,
  normalizeKey,
  splitValues,
} from '../../scripts/press-index.js';

/*
 * press-search: faceted press release listing rendered at runtime from the press index.
 * Authored content is an optional key/value config table (index, page-size, facets, filter,
 * sort, heading). All view state (q, page, sort, facets, published) lives in URL params.
 * No options (CSS classes) yet.
 */
const OPTION_CLASSES = [];

const DEFAULT_PAGE_SIZE = 9;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE_NUMBERS = 10;
const DEBOUNCE_MS = 250;
const TYPE_LABEL = 'Press Release';

const FACETS = {
  published: { label: 'Published', dates: true },
  'corporate-topics': { label: 'Corporate Topics' },
  // "Tires" is a parent tag: present in index values, never offered as an option
  'products-technologies': { label: 'Products & Technologies', hidden: ['tires'] },
  'vehicle-types': { label: 'Vehicle Types' },
};
const FACET_KEYS = Object.keys(FACETS);
const TAG_FACETS = FACET_KEYS.filter((k) => !FACETS[k].dates);

const PUBLISHED_OPTIONS = [
  { value: '', label: 'All' },
  { value: '7d', label: 'Last week' },
  { value: '30d', label: '30 days' },
  { value: '6m', label: '6 months' },
  { value: 'custom', label: 'Custom range' },
];

const SORTS = [
  { value: 'relevance', label: 'Sort by relevance' },
  { value: 'date-desc', label: 'Sort by date (desc.)' },
  { value: 'date-asc', label: 'Sort by date (asc.)' },
];
const SORT_VALUES = SORTS.map((s) => s.value);

const MESSAGES = {
  loading: 'Loading results…',
  error: 'Press releases could not be loaded right now. Please try again later.',
  empty: 'No press releases match your search. Try different keywords or remove some filters.',
};

let instanceId = 0;

/* ---------- helpers ---------- */

const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** "Products & Technologies", "products-technologies" -> 'products-technologies' (or ''). */
function facetKeyOf(text) {
  const key = normalizeKey(text).replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return FACETS[key] ? key : '';
}

const lang = () => document.documentElement.lang || 'en';

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === undefined || v === null || v === false) return;
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  });
  node.append(...children.filter((c) => c !== null && c !== undefined));
  return node;
}

function debounce(fn, ms) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/** Local calendar date as yyyy-mm-dd. */
function toIso(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const isIsoDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * Parses a published value into an inclusive { from, to } range (yyyy-mm-dd, either may be '').
 * Accepts 7d | 30d | 6m | from:yyyy-mm-dd,to:yyyy-mm-dd. Returns null for invalid / empty.
 */
function parsePublished(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  const today = new Date();
  const ago = (days, months = 0) => {
    const d = new Date(today.getFullYear(), today.getMonth() - months, today.getDate() - days);
    return toIso(d);
  };
  if (v === '7d') return { from: ago(7), to: '' };
  if (v === '30d') return { from: ago(30), to: '' };
  if (v === '6m') return { from: ago(0, 6), to: '' };
  const range = { from: '', to: '' };
  v.split(',').forEach((part) => {
    const [k, d] = part.split(':').map((s) => s.trim());
    if ((k === 'from' || k === 'to') && isIsoDay(d)) range[k] = d;
  });
  if (!range.from && !range.to) return null;
  if (range.from && range.to && range.from > range.to) {
    [range.from, range.to] = [range.to, range.from];
  }
  return range;
}

const isCustomPublished = (value) => /^(from|to):/.test(String(value || ''));

/* ---------- config ---------- */

function readConfig(block) {
  const config = {
    indexHref: DEFAULT_PRESS_INDEX,
    pageSize: DEFAULT_PAGE_SIZE,
    facets: [...FACET_KEYS],
    presets: [],
    sort: '',
    heading: '',
  };

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (cells.length < 2) {
      // a lone heading row is accepted as the heading
      const h = row.querySelector('h1, h2, h3, h4, h5, h6');
      if (h && !config.heading) config.heading = h.textContent.trim();
      return;
    }
    const key = normalizeKey(cells[0].textContent).replace(/[^a-z0-9-]/g, '');
    const values = cells.slice(1);
    const text = values.map((c) => c.textContent.trim()).filter(Boolean).join(' | ');

    switch (key) {
      case 'index': {
        const a = values.map((c) => c.querySelector('a[href]')).find(Boolean);
        const href = a ? a.getAttribute('href') : text.split('|')[0].trim();
        if (href) config.indexHref = href;
        break;
      }
      case 'page-size':
      case 'pagesize':
      case 'limit': {
        const n = parseInt(text, 10);
        if (Number.isFinite(n) && n > 0) config.pageSize = Math.min(n, MAX_PAGE_SIZE);
        break;
      }
      case 'facets': {
        const list = [...new Set(text.split(/[,|]/).map(facetKeyOf).filter(Boolean))];
        if (list.length) config.facets = list;
        break;
      }
      case 'filter': {
        const parts = text.split('|').map((s) => s.trim()).filter(Boolean);
        const facet = facetKeyOf(parts[0]);
        if (facet) config.presets.push({ facet, label: parts.slice(1).join(' | ') });
        break;
      }
      case 'sort': {
        const s = normalizeKey(text);
        if (SORT_VALUES.includes(s)) config.sort = s;
        break;
      }
      case 'heading':
        config.heading = text;
        break;
      default:
    }
  });
  return config;
}

/* ---------- data ---------- */

function toItem(row) {
  const tags = {};
  TAG_FACETS.forEach((facet) => {
    const seen = new Set();
    tags[facet] = splitValues(row[facet]).map((label) => ({ label, key: normalizeKey(label) }))
      .filter((t) => !seen.has(t.key) && seen.add(t.key));
  });
  const title = String(row.title || row.path || '').trim();
  const description = String(row.description || '').trim();
  return {
    path: row.path,
    title,
    description,
    image: row.image || '',
    date: isoDate(row['publication-date']),
    tags,
    haystack: { title: fold(title), description: fold(description) },
  };
}

function matchesPreset(item, { facet, label }) {
  if (facet === 'published') {
    if (!label) return !!item.date;
    const range = parsePublished(label);
    return !range || (!!item.date && (!range.from || item.date >= range.from)
      && (!range.to || item.date <= range.to));
  }
  const tags = item.tags[facet] || [];
  if (!label) return tags.length > 0;
  const key = normalizeKey(label);
  return tags.some((t) => t.key === key);
}

const inRange = (item, range) => !!item.date
  && (!range.from || item.date >= range.from)
  && (!range.to || item.date <= range.to);

const matchesTerms = (item, terms) => terms.every(
  (t) => item.haystack.title.includes(t) || item.haystack.description.includes(t),
);

/** Filters by every active criterion, optionally ignoring one facet (for its own counts). */
function applyFilters(items, ctx, except = '') {
  return items.filter((item) => (!ctx.terms.length || matchesTerms(item, ctx.terms))
    && (except === 'published' || !ctx.range || inRange(item, ctx.range))
    && TAG_FACETS.every((facet) => {
      const keys = ctx.tagKeys[facet];
      return facet === except || !keys?.length
        || item.tags[facet].some((t) => keys.includes(t.key));
    }));
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    count += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}

const relevance = (item, terms) => terms.reduce((sum, t) => sum
  + (countOccurrences(item.haystack.title, t) * 2)
  + countOccurrences(item.haystack.description, t), 0);

/** Date order; rows without a date always sort last. */
function byDate(dir) {
  return (a, b) => {
    if (!a.date !== !b.date) return a.date ? -1 : 1;
    return dir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
  };
}

function sortItems(items, sort, terms) {
  const list = [...items];
  if (sort === 'relevance' && terms.length) {
    const scores = new Map(list.map((item) => [item, relevance(item, terms)]));
    const tie = byDate('desc');
    return list.sort((a, b) => (scores.get(b) - scores.get(a)) || tie(a, b));
  }
  return list.sort(byDate(sort === 'date-asc' ? 'asc' : 'desc'));
}

/* ---------- URL state ---------- */

const STATE_PARAMS = ['q', 'page', 'sort', ...FACET_KEYS];

function readState(config) {
  const params = new URL(window.location.href).searchParams;
  const state = {
    q: (params.get('q') || '').trim(),
    page: Math.max(1, parseInt(params.get('page'), 10) || 1),
    sort: SORT_VALUES.includes(params.get('sort')) ? params.get('sort') : '',
    published: '',
    tags: {},
  };
  if (config.facets.includes('published')) {
    const p = (params.get('published') || '').trim().toLowerCase();
    if (parsePublished(p)) state.published = p;
  }
  TAG_FACETS.filter((f) => config.facets.includes(f)).forEach((facet) => {
    const values = params.getAll(facet).map((v) => v.trim()).filter(Boolean);
    const seen = new Set();
    state.tags[facet] = values.filter((v) => {
      const key = normalizeKey(v);
      return !seen.has(key) && seen.add(key);
    });
  });
  return state;
}

function writeState(state, push) {
  const params = new URL(window.location.href).searchParams;
  STATE_PARAMS.forEach((p) => params.delete(p));
  const pairs = [];
  const add = (k, v) => pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  if (state.q) add('q', state.q);
  Object.entries(state.tags).forEach(([facet, labels]) => labels.forEach((l) => add(facet, l)));
  if (state.published) add('published', state.published);
  if (state.sort) add('sort', state.sort);
  if (state.page > 1) add('page', state.page);
  const rest = params.toString();
  const search = [rest, ...pairs].filter(Boolean).join('&');
  const url = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
  const { href, origin } = window.location;
  if (url === href.slice(origin.length)) return;
  window.history[push ? 'pushState' : 'replaceState'](window.history.state, '', url);
}

/* ---------- rendering ---------- */

function renderImage(src) {
  if (!src || /default-meta-image/i.test(src)) return null;
  let url;
  try {
    url = new URL(src, window.location.href);
  } catch {
    return null;
  }
  if (isEdsHostedUrl(url)) {
    return createOptimizedPicture(url.pathname, '', false, [{ width: '500' }]);
  }
  // external media (cdn.continental.com): used as is, lazily
  const picture = document.createElement('picture');
  picture.append(el('img', {
    src: url.href, alt: '', loading: 'lazy', decoding: 'async',
  }));
  return picture;
}

function renderResult(item, headingLevel) {
  const li = el('li', { className: 'press-search-result' });
  const picture = renderImage(item.image);
  if (picture) li.append(el('div', { className: 'press-search-result-image' }, picture));
  else li.classList.add('no-image');

  const meta = el('p', { className: 'press-search-result-meta' }, el('span', { className: 'press-search-result-type', text: TYPE_LABEL }));
  if (item.date) {
    meta.append(' ', el('time', { className: 'press-search-result-date', datetime: item.date, text: formatDate(item.date) }));
  }
  const title = el(`h${headingLevel}`, { className: 'press-search-result-title' }, el('a', { href: item.path, text: item.title }));
  const body = el('div', { className: 'press-search-result-body' }, meta, title);
  if (item.description) body.append(el('p', { className: 'press-search-result-description', text: item.description }));
  li.append(body);
  return li;
}

function renderSkeleton(list, count) {
  list.replaceChildren(...Array.from({ length: count }, () => el(
    'li',
    { className: 'press-search-result press-search-skeleton', 'aria-hidden': 'true' },
    el('div', { className: 'press-search-result-image' }),
    el('div', { className: 'press-search-result-body' }, el('span'), el('span'), el('span')),
  )));
}

/** Page numbers to show: at most MAX_PAGE_NUMBERS, first + last always, '…' for gaps. */
function pageNumbers(current, total) {
  if (total <= MAX_PAGE_NUMBERS) return Array.from({ length: total }, (_, i) => i + 1);
  const inner = MAX_PAGE_NUMBERS - 2;
  let start = Math.max(2, current - Math.floor((inner - 1) / 2));
  const end = Math.min(total - 1, start + inner - 1);
  start = Math.max(2, end - inner + 1);
  const pages = [1];
  if (start > 2) pages.push('…');
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

function pageHref(page) {
  const url = new URL(window.location.href);
  if (page > 1) url.searchParams.set('page', page);
  else url.searchParams.delete('page');
  url.hash = '';
  return url.href.slice(url.origin.length);
}

function renderPagination(nav, current, total) {
  if (total < 2) {
    nav.hidden = true;
    nav.replaceChildren();
    return;
  }
  nav.hidden = false;
  const ul = el('ul', { className: 'press-search-pages' });
  const link = (page, label, className, ariaLabel) => {
    const disabled = page < 1 || page > total;
    const a = el('a', {
      className,
      href: disabled ? null : pageHref(page),
      'data-page': disabled ? null : page,
      'aria-label': ariaLabel,
      'aria-disabled': disabled ? 'true' : null,
      'aria-current': (!className.includes('prev') && !className.includes('next') && page === current) ? 'page' : null,
    }, label);
    return el('li', {}, a);
  };
  ul.append(link(current - 1, '‹', 'press-search-page press-search-page-prev', 'Previous page'));
  pageNumbers(current, total).forEach((p) => {
    if (p === '…') ul.append(el('li', { className: 'press-search-page-gap', 'aria-hidden': 'true', text: '…' }));
    else ul.append(link(p, String(p), 'press-search-page', `Page ${p}`));
  });
  ul.append(link(current + 1, '›', 'press-search-page press-search-page-next', 'Next page'));
  nav.replaceChildren(ul);
}

/* ---------- decorate ---------- */

export default async function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  instanceId += 1;
  const uid = `press-search-${instanceId}`;
  const config = readConfig(block);
  const state = readState(config);
  let customOpen = isCustomPublished(state.published);
  let activeTab = 0;
  let scoped = null; // press releases matching the presets, once loaded

  /* --- shell (rendered immediately) --- */
  const nodes = [];
  const headingLevel = config.heading ? 3 : 2;
  if (config.heading) nodes.push(el('h2', { className: 'press-search-heading', text: config.heading }));

  const input = el('input', {
    type: 'search', id: `${uid}-q`, name: 'q', className: 'press-search-input', placeholder: 'Search', autocomplete: 'off',
  });
  input.value = state.q;
  const form = el(
    'form',
    { className: 'press-search-form', role: 'search', action: window.location.pathname },
    el('label', { className: 'press-search-sr-only', for: input.id, text: 'Search press releases' }),
    input,
    el('button', { type: 'submit', className: 'press-search-submit', 'aria-label': 'Search' }, el('span', { className: 'press-search-submit-icon', 'aria-hidden': 'true' })),
  );
  nodes.push(form);

  // facet tabs + panels
  const filters = el('div', { className: 'press-search-filters' });
  const tablist = el('div', { className: 'press-search-tabs', role: 'tablist', 'aria-labelledby': `${uid}-filter-by` });
  const panels = el('div', { className: 'press-search-panels' });
  const facetUi = {};
  config.facets.forEach((facet, idx) => {
    const tabId = `${uid}-tab-${facet}`;
    const panelId = `${uid}-panel-${facet}`;
    const tab = el('button', {
      type: 'button', role: 'tab', id: tabId, className: 'press-search-tab', 'aria-controls': panelId, 'data-index': idx, text: FACETS[facet].label,
    });
    const options = el('div', { className: 'press-search-options' });
    const fieldset = el('fieldset', { className: 'press-search-fieldset' }, el('legend', { className: 'press-search-sr-only', text: FACETS[facet].label }), options);
    const panel = el('div', {
      role: 'tabpanel', id: panelId, className: 'press-search-panel', 'aria-labelledby': tabId, 'data-facet': facet,
    }, fieldset);
    tablist.append(tab);
    panels.append(panel);
    facetUi[facet] = { tab, panel, options };
  });
  filters.append(
    el('div', { className: 'press-search-filter-bar' }, el('span', { className: 'press-search-filter-label', id: `${uid}-filter-by`, text: 'Filter by:' }), tablist),
    panels,
  );
  nodes.push(filters);

  // published panel: static radio list (+ custom range), counts filled in on render
  const publishedUi = {};
  if (facetUi.published) {
    const { options } = facetUi.published;
    publishedUi.radios = PUBLISHED_OPTIONS.map((opt, i) => {
      const id = `${uid}-published-${i}`;
      const radio = el('input', {
        type: 'radio', id, name: `${uid}-published`, value: opt.value, 'data-facet': 'published',
      });
      const count = el('span', { className: 'press-search-option-count' });
      options.append(el('div', { className: 'press-search-option' }, radio, el('label', { for: id }, opt.label, count)));
      return { radio, count, opt };
    });
    const from = el('input', { type: 'date', id: `${uid}-from`, className: 'press-search-date' });
    const to = el('input', { type: 'date', id: `${uid}-to`, className: 'press-search-date' });
    const apply = el('button', { type: 'button', className: 'press-search-apply', text: 'Show results' });
    publishedUi.custom = el(
      'div',
      { className: 'press-search-custom-range' },
      el('div', { className: 'press-search-date-field' }, el('label', { for: from.id, text: 'Start date' }), from),
      el('div', { className: 'press-search-date-field' }, el('label', { for: to.id, text: 'End date' }), to),
      apply,
    );
    options.after(publishedUi.custom);
    Object.assign(publishedUi, { from, to, apply });
  }

  const chips = el('div', { className: 'press-search-chips', hidden: true });

  const resultsHeading = el('h2', {
    className: 'press-search-count', id: `${uid}-count`, tabindex: '-1', text: MESSAGES.loading,
  });
  const status = el('p', { className: 'press-search-sr-only', role: 'status', 'aria-live': 'polite' });
  const sortSelect = el('select', { id: `${uid}-sort`, className: 'press-search-sort' });
  SORTS.forEach((s) => sortSelect.append(el('option', { value: s.value, text: s.label })));
  const toolbar = el(
    'div',
    { className: 'press-search-toolbar' },
    resultsHeading,
    el('div', { className: 'press-search-sort-field' }, el('label', { className: 'press-search-sr-only', for: sortSelect.id, text: 'Sort results' }), sortSelect),
  );
  const message = el('p', { className: 'press-search-message', hidden: true });
  const list = el('ul', { className: 'press-search-results', 'aria-labelledby': resultsHeading.id });
  const pagination = el('nav', { className: 'press-search-pagination', 'aria-label': 'Pagination', hidden: true });
  nodes.push(chips, toolbar, status, message, list, pagination);

  renderSkeleton(list, Math.min(config.pageSize, 3));
  block.setAttribute('aria-busy', 'true');
  block.replaceChildren(...nodes);

  /* --- tabs --- */
  const tabs = config.facets.map((f) => facetUi[f].tab);
  const selectTab = (index, focus = false) => {
    activeTab = index;
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', selected);
      tab.tabIndex = selected ? 0 : -1;
      facetUi[config.facets[i]].panel.hidden = !selected;
    });
    if (focus) tabs[index].focus();
  };
  tablist.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) selectTab(Number(tab.dataset.index));
  });
  tablist.addEventListener('keydown', (e) => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    const moves = {
      ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    selectTab((moves[e.key] + tabs.length) % tabs.length, true);
  });
  selectTab(activeTab);

  /* --- render --- */
  const buildCtx = () => {
    const tagKeys = {};
    Object.entries(state.tags).forEach(([facet, labels]) => {
      tagKeys[facet] = labels.map(normalizeKey);
    });
    return {
      terms: fold(state.q).split(/\s+/).filter(Boolean),
      range: parsePublished(state.published),
      tagKeys,
    };
  };

  const sortValue = () => state.sort || config.sort || (state.q ? 'relevance' : 'date-desc');

  const renderTagOptions = (facet, ctx) => {
    const { options } = facetUi[facet];
    const hidden = new Set([
      ...(FACETS[facet].hidden || []),
      ...config.presets.filter((p) => p.facet === facet && p.label)
        .map((p) => normalizeKey(p.label)),
    ]);
    const counts = new Map();
    const base = applyFilters(scoped, ctx, facet);
    base.forEach((item) => item.tags[facet].forEach(({ key, label }) => {
      if (hidden.has(key)) return;
      const entry = counts.get(key) || { label, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }));
    const selected = state.tags[facet] || [];
    selected.forEach((label) => {
      const key = normalizeKey(label);
      if (!counts.has(key)) counts.set(key, { label, count: 0 });
    });
    const selectedKeys = selected.map(normalizeKey);
    const entries = [...counts.entries()]
      .filter(([key, { count }]) => count > 0 || selectedKeys.includes(key))
      .sort((a, b) => (b[1].count - a[1].count) || a[1].label.localeCompare(b[1].label, lang()));

    // keep keyboard focus on the same option across re-renders
    const focused = options.contains(document.activeElement) ? document.activeElement : null;
    const focusedKey = focused?.dataset.key;
    options.replaceChildren(...entries.map(([key, { label, count }], i) => {
      const id = `${uid}-${facet}-${i}`;
      const checkbox = el('input', {
        type: 'checkbox', id, value: label, 'data-facet': facet, 'data-key': key,
      });
      checkbox.checked = selectedKeys.includes(key);
      return el(
        'div',
        { className: 'press-search-option' },
        checkbox,
        el('label', { for: id }, label, el('span', { className: 'press-search-option-count', text: ` (${count})` })),
      );
    }));
    if (!entries.length) options.append(el('p', { className: 'press-search-options-empty', text: 'No options for the current results.' }));
    if (focusedKey) options.querySelector(`[data-key="${CSS.escape(focusedKey)}"]`)?.focus();
  };

  const renderPublished = (ctx) => {
    if (!facetUi.published) return;
    const base = applyFilters(scoped, ctx, 'published');
    const current = customOpen || isCustomPublished(state.published) ? 'custom' : state.published;
    publishedUi.radios.forEach(({ radio, count, opt }) => {
      radio.checked = opt.value === current;
      if (opt.value && opt.value !== 'custom') {
        const range = parsePublished(opt.value);
        count.textContent = ` (${base.filter((item) => inRange(item, range)).length})`;
      }
    });
    publishedUi.custom.hidden = current !== 'custom';
    if (isCustomPublished(state.published)) {
      const range = parsePublished(state.published);
      publishedUi.from.value = range?.from || '';
      publishedUi.to.value = range?.to || '';
    }
  };

  const publishedLabel = (value) => {
    if (isCustomPublished(value)) {
      const r = parsePublished(value);
      if (!r) return '';
      if (r.from && r.to) return `${formatDate(r.from)} – ${formatDate(r.to)}`;
      return r.from ? `From ${formatDate(r.from)}` : `Until ${formatDate(r.to)}`;
    }
    return PUBLISHED_OPTIONS.find((o) => o.value === value)?.label || value;
  };

  const renderChips = () => {
    const items = [];
    if (state.q) items.push({ type: 'q', label: `“${state.q}”` });
    if (state.published) items.push({ type: 'published', label: publishedLabel(state.published) });
    Object.entries(state.tags).forEach(([facet, labels]) => labels.forEach((label) => {
      items.push({ type: facet, value: label, label });
    }));
    chips.hidden = !items.length;
    if (!items.length) {
      chips.replaceChildren();
      return;
    }
    const ul = el('ul', { className: 'press-search-chip-list', 'aria-label': 'Active filters' });
    items.forEach((chip) => ul.append(el('li', {}, el('button', {
      type: 'button', className: 'press-search-chip', 'data-type': chip.type, 'data-value': chip.value || '', 'aria-label': `Remove filter ${chip.label}`,
    }, el('span', { text: chip.label }), el('span', { className: 'press-search-chip-remove', 'aria-hidden': 'true', text: '×' })))));
    chips.replaceChildren(ul, el('button', { type: 'button', className: 'press-search-clear', text: 'Clear all' }));
  };

  const render = () => {
    if (!scoped) return;
    const ctx = buildCtx();
    const sort = sortValue();
    const results = sortItems(applyFilters(scoped, ctx), sort, ctx.terms);
    const totalPages = Math.max(1, Math.ceil(results.length / config.pageSize));
    state.page = Math.min(Math.max(1, state.page), totalPages);

    TAG_FACETS.filter((f) => facetUi[f]).forEach((f) => renderTagOptions(f, ctx));
    renderPublished(ctx);
    renderChips();
    sortSelect.value = sort;

    const countText = `${results.length.toLocaleString(lang())} ${results.length === 1 ? 'result' : 'results'}`;
    resultsHeading.textContent = countText;
    status.textContent = countText;
    message.hidden = results.length > 0;
    if (!results.length) message.textContent = MESSAGES.empty;

    const start = (state.page - 1) * config.pageSize;
    list.replaceChildren(...results.slice(start, start + config.pageSize)
      .map((item) => renderResult(item, headingLevel + 1)));
    renderPagination(pagination, state.page, totalPages);
  };

  /* --- interactions --- */
  const update = ({ push = true, resetPage = true } = {}) => {
    if (resetPage) state.page = 1;
    writeState(state, push);
    render();
  };

  const applyQuery = () => {
    const q = input.value.trim();
    if (q === state.q) return;
    state.q = q;
    update({ push: false });
  };
  const debouncedQuery = debounce(applyQuery, DEBOUNCE_MS);
  input.addEventListener('input', debouncedQuery);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    debouncedQuery.cancel();
    applyQuery();
  });

  panels.addEventListener('change', (e) => {
    const { target } = e;
    const { facet } = target.dataset;
    if (!facet) return;
    if (facet === 'published') {
      if (target.value === 'custom') {
        customOpen = true;
        publishedUi.custom.hidden = false;
        publishedUi.from.focus();
        return;
      }
      customOpen = false;
      state.published = target.value;
      update();
      return;
    }
    const labels = state.tags[facet] || [];
    const key = normalizeKey(target.value);
    state.tags[facet] = target.checked
      ? [...labels.filter((l) => normalizeKey(l) !== key), target.value]
      : labels.filter((l) => normalizeKey(l) !== key);
    update();
  });

  publishedUi.apply?.addEventListener('click', () => {
    const from = isIsoDay(publishedUi.from.value) ? publishedUi.from.value : '';
    const to = isIsoDay(publishedUi.to.value) ? publishedUi.to.value : '';
    if (!from && !to) {
      publishedUi.from.focus();
      return;
    }
    state.published = [from && `from:${from}`, to && `to:${to}`].filter(Boolean).join(',');
    customOpen = true;
    update();
  });

  chips.addEventListener('click', (e) => {
    if (e.target.closest('.press-search-clear')) {
      state.q = '';
      input.value = '';
      state.published = '';
      customOpen = false;
      Object.keys(state.tags).forEach((f) => { state.tags[f] = []; });
      update();
      input.focus();
      return;
    }
    const chip = e.target.closest('.press-search-chip');
    if (!chip) return;
    const { type, value } = chip.dataset;
    if (type === 'q') {
      state.q = '';
      input.value = '';
    } else if (type === 'published') {
      state.published = '';
      customOpen = false;
    } else {
      const key = normalizeKey(value);
      state.tags[type] = (state.tags[type] || []).filter((l) => normalizeKey(l) !== key);
    }
    update();
    (chips.querySelector('.press-search-chip') || input).focus();
  });

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    update();
  });

  pagination.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    const page = Number(a.dataset.page);
    if (!page || page === state.page) return;
    state.page = page;
    update({ resetPage: false });
    resultsHeading.focus({ preventScroll: true });
    block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  window.addEventListener('popstate', () => {
    Object.assign(state, readState(config));
    input.value = state.q;
    customOpen = isCustomPublished(state.published);
    render();
  });

  /* --- data --- */
  const rows = await loadPressIndex(config.indexHref);
  block.removeAttribute('aria-busy');
  if (!Array.isArray(rows)) {
    block.classList.add('press-search-error');
    list.replaceChildren();
    resultsHeading.textContent = '0 results';
    message.textContent = MESSAGES.error;
    message.hidden = false;
    status.textContent = MESSAGES.error;
    return;
  }
  scoped = rows
    .filter((row) => row?.path && hasTemplate(row))
    .map(toItem)
    .filter((item) => config.presets.every((p) => matchesPreset(item, p)));
  render();
}
