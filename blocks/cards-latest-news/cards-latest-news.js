import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  DEFAULT_PRESS_INDEX,
  formatDate,
  indexByPath,
  isoDate,
  latestPressReleases,
  loadPressIndex,
  normalizeKey,
  normalizePath,
} from '../../scripts/press-index.js';
import groupTabbedBlocks from '../../scripts/tab-group.js';

/*
 * Options (all combinable, all optional - without any the block is the plain date + title list):
 * - teaser:  image cards (image, date, title, description, link) in a grid instead of the list
 * - curated: the authored article links are the items (authored order), enriched from the index
 * - tabbed:  adjacent tabbed instances in one section share one tab bar (labels = block headings)
 */
const OPTION_CLASSES = ['teaser', 'curated', 'tabbed'];

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const LINK_LABELS = { curated: 'Find out more', latest: 'Read the press release' };

let instanceId = 0;

const KEYS = {
  index: ['index', 'source', 'url', 'feed', 'query-index'],
  limit: ['limit', 'count', 'max', 'items'],
  all: ['all-news', 'all', 'more', 'link'],
  label: ['link-label', 'cta', 'label'],
};
const keyOf = (text) => Object.keys(KEYS).find((k) => KEYS[k].includes(normalizeKey(text))) || '';

const isIndexHref = (href) => /\.json($|[?#])/i.test(href) || /(query|press)-index($|[?#])/i.test(href);

/**
 * Reads the authored config. Every row is optional:
 * - a link to a .json file (or a key/value row "index | <link>") sets the index URL
 * - a number (or "limit | 10") sets the limit
 * - "all-news | <link>" sets the "All news" link (wins over any other link)
 * - "link-label | Find out more" overrides the teaser link label
 * - any other link: in curated mode an item (authored order), otherwise the "All news" link
 * - headings are kept as the block heading
 */
function readConfig(block, curated) {
  const config = {
    indexHref: DEFAULT_PRESS_INDEX,
    limit: DEFAULT_LIMIT,
    limitSet: false,
    allLink: null,
    fallbackAllLink: null,
    linkLabel: '',
    headings: [],
    items: [],
  };

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const key = cells.length > 1 ? keyOf(cells[0].textContent) : '';
    const valueCells = key ? cells.slice(1) : cells;

    valueCells.forEach((cell) => {
      cell.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => config.headings.push(h));
      const links = [...cell.querySelectorAll('a[href]')];
      links.forEach((a) => {
        const href = a.getAttribute('href');
        if (key === 'index' || (isIndexHref(href) && key !== 'all')) config.indexHref = href;
        else if (key === 'all') {
          if (!config.allLink) config.allLink = a;
        } else if (curated) {
          config.items.push({ href, text: a.textContent.trim() });
        } else if (!config.fallbackAllLink) config.fallbackAllLink = a;
      });
      if (!links.length) {
        const text = cell.textContent.trim();
        if (key === 'index' && text) config.indexHref = text;
        else if (key === 'label' && text) config.linkLabel = text;
        else if ((key === 'limit' || !key) && /^\d+$/.test(text)) {
          config.limit = Math.min(Math.max(parseInt(text, 10), 1), MAX_LIMIT);
          config.limitSet = true;
        }
      }
    });
  });

  // curated: only an explicit all-news row is the "All news" link; otherwise any other link
  if (!config.allLink && !curated) config.allLink = config.fallbackAllLink;
  return config;
}

/* ---------- items ---------- */

const toItem = (row) => ({
  path: row.path,
  title: row.title || row.path,
  date: row.date ?? isoDate(row['publication-date']),
  description: row.description || '',
  image: row.image || '',
});

/** Curated: authored links in authored order, enriched by path; link text when not indexed. */
function curatedItems(config, rows) {
  const byPath = indexByPath(rows);
  const items = config.items.map(({ href, text }) => {
    const row = byPath.get(normalizePath(href));
    if (row) return toItem({ ...row, title: row.title || text });
    return {
      path: href, title: text || href, date: '', description: '', image: '',
    };
  });
  return config.limitSet ? items.slice(0, config.limit) : items.slice(0, MAX_LIMIT);
}

function latestItems(config, rows) {
  return latestPressReleases(rows, { limit: config.limit, exclude: window.location.pathname })
    .map(toItem);
}

/* ---------- rendering ---------- */

function renderDate(date) {
  const time = document.createElement('time');
  time.className = 'cards-latest-news-date';
  time.dateTime = date;
  time.textContent = formatDate(date);
  return time;
}

/** Default (and backward compatible) rendering: date line above a title link. */
function renderList(items) {
  const ul = document.createElement('ul');
  ul.className = 'cards-latest-news-list';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'cards-latest-news-item';
    if (item.date) li.append(renderDate(item.date));
    const a = document.createElement('a');
    a.className = 'cards-latest-news-title';
    a.href = item.path;
    a.textContent = item.title;
    li.append(a);
    ul.append(li);
  });
  return ul;
}

const isDefaultImage = (src) => /default-meta-image/i.test(src);

function renderImage(src) {
  let url;
  try {
    url = new URL(src, window.location.href);
  } catch {
    return null;
  }
  // EDS-hosted media get optimized renditions; other hosts are used as is
  const local = url.origin === window.location.origin || /\.(aem|hlx)\.(page|live)$/.test(url.hostname);
  if (local) {
    return createOptimizedPicture(url.pathname, '', false, [{ width: '750' }]);
  }
  const picture = document.createElement('picture');
  const img = document.createElement('img');
  img.src = url.href;
  img.alt = '';
  img.loading = 'lazy';
  picture.append(img);
  return picture;
}

/** teaser: image cards. The CTA link stretches over the whole card (see CSS). */
function renderCards(items, { id, linkLabel, headingLevel }) {
  const ul = document.createElement('ul');
  ul.className = 'cards-latest-news-cards';
  ul.dataset.count = items.length;
  items.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'cards-latest-news-card';

    if (item.image && !isDefaultImage(item.image)) {
      const picture = renderImage(item.image);
      if (picture) {
        const imageCell = document.createElement('div');
        imageCell.className = 'cards-latest-news-card-image';
        imageCell.append(picture);
        li.append(imageCell);
      }
    }
    if (!li.children.length) li.classList.add('no-image');

    const body = document.createElement('div');
    body.className = 'cards-latest-news-card-body';

    const title = document.createElement(`h${headingLevel}`);
    title.className = 'cards-latest-news-card-title';
    title.id = `cards-latest-news-${id}-item-${idx}`;
    title.textContent = item.title;
    body.append(title);

    if (item.date || item.description) {
      const text = document.createElement('p');
      text.className = 'cards-latest-news-card-text';
      if (item.date) text.append(renderDate(item.date));
      if (item.date && item.description) text.append(' ');
      if (item.description) text.append(item.description);
      body.append(text);
    }

    const cta = document.createElement('p');
    cta.className = 'cards-latest-news-card-cta';
    const a = document.createElement('a');
    a.className = 'cards-latest-news-card-link';
    a.href = item.path;
    a.textContent = linkLabel;
    a.setAttribute('aria-describedby', title.id);
    cta.append(a);
    body.append(cta);

    li.append(body);
    ul.append(li);
  });
  return ul;
}

/* ---------- decorate ---------- */

export default async function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');
  const teaser = active.includes('teaser');
  const curated = active.includes('curated');

  instanceId += 1;
  const id = instanceId;

  // group tabs first (synchronously), while every instance's heading is still in the DOM
  if (active.includes('tabbed')) groupTabbedBlocks(block, { blockName: 'cards-latest-news' });

  const config = readConfig(block, curated);
  const nodes = [];

  if (config.headings.length) {
    const header = document.createElement('div');
    header.className = 'cards-latest-news-header';
    header.append(...config.headings);
    nodes.push(header);
  }

  let footer = null;
  if (config.allLink) {
    const a = config.allLink;
    a.classList.remove('button', 'primary', 'secondary', 'accent');
    a.classList.add('cards-latest-news-all-link');
    footer = document.createElement('p');
    footer.className = 'cards-latest-news-all';
    footer.append(a);
  }

  // clear the authored config right away so it never flashes
  block.replaceChildren(...nodes, ...(footer ? [footer] : []));

  if (curated && !config.items.length) {
    block.classList.add('cards-latest-news-empty');
    return;
  }

  const rows = await loadPressIndex(config.indexHref);
  let items = [];
  if (curated) items = curatedItems(config, Array.isArray(rows) ? rows : []);
  else if (Array.isArray(rows)) items = latestItems(config, rows);

  if (!items.length) {
    block.classList.add('cards-latest-news-empty');
    return;
  }

  const headingLevel = config.headings.length
    ? Math.min(parseInt(config.headings[0].tagName.slice(1), 10) + 1, 6)
    : 3;
  const list = teaser
    ? renderCards(items, {
      id,
      headingLevel,
      linkLabel: config.linkLabel || (curated ? LINK_LABELS.curated : LINK_LABELS.latest),
    })
    : renderList(items);
  block.insertBefore(list, footer);
}
