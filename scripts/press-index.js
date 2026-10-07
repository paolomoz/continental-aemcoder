/*
 * Shared press index loader.
 * One fetch (all pages) per index URL per page view, shared by every block that imports this
 * module (cards-latest-news today, a press-search block later). Blocks must import it from
 * /scripts/ - cross-block imports are not allowed.
 */

export const DEFAULT_PRESS_INDEX = '/en/press/press-index.json';
export const PRESS_RELEASE_TEMPLATE = 'press-release';

const PAGE_SIZE = 500;
const MAX_PAGES = 20;

/* index URL -> Promise<rows[] | null> */
const indexCache = new Map();

export const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-');

/** Strips trailing slashes, `/index` and `.html` so `/a/b/`, `/a/b` and `/a/b/index` match. */
export function normalizePath(path) {
  let p = String(path || '');
  try {
    p = new URL(p, window.location.href).pathname;
  } catch { /* keep as is */ }
  p = p.replace(/\.(plain\.)?html$/, '').replace(/\/index$/, '').replace(/\/+$/, '');
  return p || '/';
}

/**
 * Resolves the index URL. Same-origin and *.aem.page / *.aem.live URLs are rebased on the
 * current origin so blocks work on .page, .live and localhost alike.
 */
export function resolveIndexUrl(href = DEFAULT_PRESS_INDEX) {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin === window.location.origin || /\.(aem|hlx)\.(page|live)$/.test(url.hostname)) {
      return new URL(url.pathname + url.search, window.location.origin);
    }
    return url;
  } catch {
    return new URL(DEFAULT_PRESS_INDEX, window.location.origin);
  }
}

/** Fetches every row of an EDS query index, following offset/limit pagination. */
async function fetchIndexRows(indexUrl) {
  const rows = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(indexUrl);
    url.searchParams.set('offset', offset);
    url.searchParams.set('limit', PAGE_SIZE);
    // eslint-disable-next-line no-await-in-loop
    const resp = await fetch(url);
    if (!resp.ok) {
      if (page === 0) throw new Error(`index ${resp.status}`);
      break;
    }
    // eslint-disable-next-line no-await-in-loop
    const json = await resp.json();
    const data = Array.isArray(json?.data) ? json.data : [];
    rows.push(...data);
    const total = Number(json?.total);
    offset = Number(json?.offset ?? offset) + data.length;
    if (!data.length || !Number.isFinite(total) || offset >= total) break;
  }
  return rows;
}

/**
 * Loads all rows of the index (cached per URL). Resolves to `null` when the index is
 * unavailable; a failed load is not cached, so a later caller retries.
 * @param {string|URL} [href] index URL, defaults to the press index
 * @returns {Promise<object[]|null>}
 */
export function loadPressIndex(href = DEFAULT_PRESS_INDEX) {
  const indexUrl = href instanceof URL ? href : resolveIndexUrl(href);
  const key = indexUrl.href;
  if (!indexCache.has(key)) {
    indexCache.set(key, fetchIndexRows(indexUrl).catch(() => {
      indexCache.delete(key);
      return null;
    }));
  }
  return indexCache.get(key);
}

/** Returns the first yyyy-mm-dd of a value, or ''. */
export const isoDate = (value) => {
  const s = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
};

/** Formats a yyyy-mm-dd date in the page language ("September 16, 2026" for en). */
export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return iso;
  const lang = document.documentElement.lang || 'en';
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : lang, {
    year: 'numeric', month: 'long', day: '2-digit', timeZone: 'UTC',
  }).format(date);
}

/**
 * Splits a multi-value index field into trimmed labels. Accepts comma-separated strings,
 * JSON array strings ('["a","b"]') and arrays; empty values yield [].
 */
export function splitValues(value) {
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  const s = String(value ?? '').trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return splitValues(parsed);
    } catch { /* not JSON: split on commas */ }
  }
  return s.split(',').map((v) => v.trim()).filter(Boolean);
}

/** True for URLs served by this EDS site (same origin, *.aem/hlx.page/live): optimizable media. */
export function isEdsHostedUrl(url) {
  try {
    const u = url instanceof URL ? url : new URL(url, window.location.href);
    return u.origin === window.location.origin || /\.(aem|hlx)\.(page|live)$/.test(u.hostname);
  } catch {
    return false;
  }
}

/** True when a row's (comma-separated) `template` contains the given template. */
export function hasTemplate(row, template = PRESS_RELEASE_TEMPLATE) {
  return normalizeKey(row?.template).split(',')
    .map((t) => t.replace(/^-+|-+$/g, ''))
    .includes(template);
}

/** Map of normalized path -> row, for enriching authored links. */
export function indexByPath(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    if (row?.path) {
      const key = normalizePath(row.path);
      if (!map.has(key)) map.set(key, row);
    }
  });
  return map;
}

/**
 * Press releases newest first (by publication-date), optionally excluding one path.
 * Each returned row carries a normalized `date` (yyyy-mm-dd or '').
 */
export function latestPressReleases(rows, { limit = Infinity, exclude = '', template } = {}) {
  const excluded = exclude ? normalizePath(exclude) : '';
  return (rows || [])
    .filter((row) => hasTemplate(row, template))
    .filter((row) => row.path && normalizePath(row.path) !== excluded)
    .map((row) => ({ ...row, date: isoDate(row['publication-date']) }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}
