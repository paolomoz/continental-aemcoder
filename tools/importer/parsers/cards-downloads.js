/* eslint-disable */
/* global WebImporter */
import downloads from '../data/press-downloads.json';

/**
 * Parser for cards-downloads. Base: cards.
 * Source: https://www.continental.com/en/press/press-releases/oe-porsche/
 * Generated: 2026-10-06
 *
 * Instance: the article page options bar (.c-pageoptions: share, print, downloads).
 * The whole bar is replaced by the block; share/print UI is dropped.
 *
 * File list source, in order of preference:
 *  1. tools/importer/data/press-downloads.json (pre-resolved CDN URLs, inlined by esbuild),
 *     keyed by article pathname with trailing slash: { articles: { [path]: { files: [...] } } }
 *  2. fallback: the hidden inputs of the download modal
 *     (form[data-minicart] input[type=hidden], JSON {type,id,title,name,size,ext});
 *     'processed' files link to https://cdn.continental.com/fileadmin{id},
 *     others to the article URL (the file id is an opaque hash).
 *
 * "(small version)" duplicates of processed images are skipped when the full file exists.
 *
 * Output: one row per file: [type label, [link (title -> url), size paragraph]].
 *
 * Second instance shape (press-content, e.g. https://www.continental.com/en/press/fairs-events/ces-2025/):
 * .o-page__ce:has(a.c-link--download) - see parseLinkList below.
 */
const TYPE_LABELS = [
  ['Word', ['doc', 'docx', 'rtf', 'odt']],
  ['PDF', ['pdf']],
  ['Image', ['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'webp', 'svg', 'bmp']],
  ['Excel', ['xls', 'xlsx', 'csv']],
  ['PowerPoint', ['ppt', 'pptx']],
  ['ZIP', ['zip', 'rar', '7z']],
  ['Video', ['mp4', 'mov', 'avi', 'webm']],
  ['Audio', ['mp3', 'wav', 'm4a']],
];
const typeLabel = (ext) => {
  const e = (ext || '').toLowerCase().replace(/^\./, '');
  const hit = TYPE_LABELS.find(([, exts]) => exts.includes(e));
  if (hit) return hit[0];
  return e ? e.toUpperCase() : 'File';
};

/**
 * press-content: a text CE (.o-page__ce) holding consecutive download links
 *   <p><a class="c-link--download" href="...pdf">Title -&nbsp;<span class="text-uppercase">pdf (243KB)</span></a></p>
 * Each run of consecutive download-link paragraphs becomes one cards-downloads
 * block (row per link: [type label, [link, size]]); any other content of the CE
 * (intro text, headings) stays default content in source order.
 */
function parseLinkList(element, document) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const text = element.querySelector('.c-media__text, .s-richtext') || element;
  const isDownloadP = (n) => {
    if (n.nodeType !== 1) return false;
    const links = n.matches('a.c-link--download') ? [n] : [...n.querySelectorAll('a.c-link--download')];
    if (!links.length) return false;
    const rest = n.cloneNode(true);
    rest.querySelectorAll('a.c-link--download').forEach((a) => a.remove());
    if (rest.matches && rest.matches('a.c-link--download')) return true;
    return !clean(rest.textContent);
  };

  const rowOf = (a) => {
    const span = a.querySelector('span.text-uppercase, span');
    const meta = clean(span ? span.textContent : '');
    const linkClone = a.cloneNode(true);
    if (span) linkClone.querySelector(span.classList.length ? `span.${[...span.classList].join('.')}` : 'span')?.remove();
    const title = clean(linkClone.textContent.replace(/ /g, ' ')).replace(/\s*[-–—:]\s*$/, '');
    const href = a.getAttribute('href') || '';
    let abs = href;
    try { abs = new URL(href, 'https://www.continental.com/').href; } catch (e) { /* keep */ }
    // "pdf (243KB)" -> ext pdf, size "243 KB"
    const m = meta.match(/^([a-z0-9]{2,5})\s*(?:\(([^)]*)\))?/i);
    let ext = m ? m[1] : '';
    if (!ext) {
      const em = href.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
      ext = em ? em[1] : '';
    }
    const size = m && m[2] ? clean(m[2]).replace(/^([\d.,]+)\s*([KMGT]?B)$/i, (x, n, u) => `${n} ${u.toUpperCase()}`) : '';
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = abs;
    link.textContent = title || meta || abs;
    p.append(link);
    const linkCell = [p];
    if (size) {
      const sp = document.createElement('p');
      sp.textContent = size;
      linkCell.push(sp);
    }
    return [typeLabel(ext), linkCell];
  };

  const out = [];
  let run = [];
  const flush = () => {
    if (!run.length) return;
    out.push(WebImporter.Blocks.createBlock(document, { name: 'cards-downloads', cells: run }));
    run = [];
  };
  [...text.childNodes].forEach((n) => {
    if (isDownloadP(n)) {
      const links = n.matches('a.c-link--download') ? [n] : [...n.querySelectorAll('a.c-link--download')];
      links.forEach((a) => run.push(rowOf(a)));
      return;
    }
    if (n.nodeType === 3 && !clean(n.textContent)) return;
    flush();
    out.push(n);
  });
  flush();
  return out;
}

export default function parse(element, { document, url, params } = {}) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // ---- press-content download link lists (not the page options bar) ---------
  if (!element.matches('.c-pageoptions') && !element.querySelector('form[data-minicart]')
    && element.querySelector('a.c-link--download')) {
    const nodes = parseLinkList(element, document);
    const block = nodes.find((n) => n.nodeType === 1 && n.tagName === 'TABLE') || nodes[0];
    if (!block) { element.remove(); return; }
    element.replaceWith(block);
    const idx = nodes.indexOf(block);
    nodes.slice(0, idx).reverse().forEach((n) => block.before(n));
    let anchor = block;
    nodes.slice(idx + 1).forEach((n) => { anchor.after(n); anchor = n; });
    return;
  }

  // ---- article URL / map key -------------------------------------------------
  let articleUrl = (params && params.originalURL) || url || '';
  if (!articleUrl || /localhost|127\.0\.0\.1/.test(articleUrl)) {
    const canonical = document.querySelector('link[rel="canonical"]');
    const fromCanonical = canonical && canonical.getAttribute('href');
    if (fromCanonical) articleUrl = fromCanonical;
    else if (!articleUrl && typeof window !== 'undefined' && window.location) articleUrl = window.location.href;
  }
  let pathKey = '';
  try {
    const u = new URL(articleUrl, 'https://www.continental.com/');
    pathKey = u.pathname.replace(/\.html?$/, '');
    if (!pathKey.endsWith('/')) pathKey += '/';
    articleUrl = `https://www.continental.com${u.pathname}`;
  } catch (e) { /* keep raw */ }

  // ---- collect files ---------------------------------------------------------
  let files = [];
  const map = (typeof downloads !== 'undefined' && downloads)
    ? (downloads.articles || downloads)
    : null;
  const entry = map && (map[pathKey] || map[pathKey.replace(/\/$/, '')] || (url && map[url]));
  if (entry && Array.isArray(entry.files) && entry.files.length) {
    files = entry.files.map((f) => ({
      type: f.type,
      title: f.title || f.name,
      name: f.name,
      size: f.size,
      ext: f.ext,
      url: f.url || articleUrl,
    }));
  } else {
    const inputs = [...element.querySelectorAll('form[data-minicart] input[type="hidden"]')];
    const fallbackInputs = inputs.length
      ? inputs
      : [...element.querySelectorAll('.c-download-files-modal__files input[type="hidden"]')];
    fallbackInputs.forEach((input) => {
      let data;
      try { data = JSON.parse(input.value || input.getAttribute('value') || ''); } catch (e) { return; }
      if (!data || typeof data !== 'object' || !(data.name || data.title)) return;
      const isProcessed = data.type === 'processed' && data.id;
      let href = articleUrl;
      if (isProcessed) {
        const id = String(data.id);
        href = `https://cdn.continental.com/fileadmin${id.startsWith('/') ? '' : '/'}${id}`;
      }
      files.push({
        type: data.type,
        title: data.title || data.name,
        name: data.name,
        size: data.size,
        ext: data.ext,
        url: href,
      });
    });
  }

  // ---- drop "(small version)" duplicates when the full file is present -------
  const SMALL_RE = /\s*\(small version\)\s*$/i;
  const keyOf = (s) => clean(s).toLowerCase();
  const fullTitles = new Set(
    files.filter((f) => !SMALL_RE.test(f.title || '')).flatMap((f) => [keyOf(f.title), keyOf(f.name)]),
  );
  files = files.filter((f) => {
    if (f.type !== 'processed' || !SMALL_RE.test(f.title || '')) return true;
    return !fullTitles.has(keyOf((f.title || '').replace(SMALL_RE, '')));
  });

  // de-duplicate identical url + title pairs
  const seen = new Set();
  files = files.filter((f) => {
    const k = `${f.url}|${f.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (!files.length) {
    element.remove();
    return;
  }

  // ---- helpers ---------------------------------------------------------------
  const extOf = (f) => {
    const e = clean(f.ext).toLowerCase().replace(/^\./, '');
    if (e) return e;
    const m = (f.name || f.url || '').match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
    return m ? m[1].toLowerCase() : '';
  };
  const labelOf = typeLabel;
  const humanSize = (bytes) => {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
  };

  // ---- build rows ------------------------------------------------------------
  const cells = [];
  files.forEach((f) => {
    const ext = extOf(f);
    const linkCell = [];
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = f.url;
    a.textContent = clean(f.title) || clean(f.name) || f.url;
    p.append(a);
    linkCell.push(p);
    const size = humanSize(f.size);
    if (size) {
      const sp = document.createElement('p');
      sp.textContent = size;
      linkCell.push(sp);
    }
    cells.push([labelOf(ext), linkCell]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-downloads', cells });
  element.replaceWith(block);
}
