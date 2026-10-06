/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-teaser. Base: cards.
 * Source: https://www.continental.com/en/ (teaser grids),
 *         https://www.continental.com/en/press/ (events, media, contacts rows; tabs excluded by selector),
 *         press-content pages (https://www.continental.com/en/press/fairs-events/ces-2025/,
 *         .../fairs-events/ (tabs), .../media-library/videos/ (video teasers), ...)
 * Generated: 2026-10-06
 *
 * Instances are a .row holding several a.c-teaser elements, a single column
 * wrapping one a.c-teaser (homepage), a .c-content-slider of teasers, or a
 * teaser row inside an .o-tabs panel. Each teaser -> one row:
 *   [image cell, body cell (title, description, optional date, CTA link)].
 *
 * Options (block name "Cards Teaser (option)"):
 *  - slider:  the instance is a .c-content-slider
 *  - tabbed:  the instance sits in an .o-tabs__content-item; a first heading row
 *             holds the tab label (the H3 of the panel's .o-container__header,
 *             else the matching .o-tabs__header-item text). The consumed header
 *             row is removed so the heading is not duplicated as default content.
 *  - four-up: every teaser column is .col-md-3
 *  - two-up:  every teaser column is .col-md-6, or .col-sm-6 without a col-md-* size
 *  - default (3 per row) otherwise, e.g. .col-md-4 (homepage / press landing).
 *
 * Mixed rows (press-content figures-data-facts): text-media columns
 * ([data-ctype="textmedia"]) next to teaser columns are not dropped:
 *  - one teaser + text column(s) -> one columns-content block, one cell per
 *    source column (the teaser rendered as default content);
 *  - several teasers + text column(s) -> the text stays default content before /
 *    after the cards block, in source order.
 *
 * Iteration is keyed on the inner block wrapper .c-teaser__content (not the
 * a.c-teaser anchor, which wraps block content and can be merged by html2md
 * preprocessing). The href is read from the enclosing anchor and re-attached
 * to the CTA. Absolute links (PDFs on cdn.continental.com, video teasers on
 * https://video.continental.com/?v={uuid}) are kept as-is.
 */
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const absUrl = (u) => {
  if (!u) return '';
  try { return new URL(u, 'https://www.continental.com/').href; } catch (e) { return u; }
};

function collectItems(scope) {
  let items = [...scope.querySelectorAll('.c-teaser__content')].map((content) => {
    const container = content.closest('.c-teaser') || content.parentElement;
    return {
      content,
      image: container ? container.querySelector('.c-teaser__image img, picture img') : null,
      anchor: content.closest('a[href]') || (container && container.matches('a[href]') ? container : null),
      container,
    };
  });
  if (!items.length) {
    // Fallback: iterate the teaser anchors directly
    items = [...scope.querySelectorAll('a.c-teaser')].map((a) => ({
      content: a,
      image: a.querySelector('img'),
      anchor: a,
      container: a,
    }));
  }
  return items;
}

/** One teaser -> { imageCell, body[] } (unchanged extraction from the first version). */
function buildTeaser({ content, image, anchor }, document) {
  let imageCell = '';
  if (image) {
    const src = image.getAttribute('src') || image.src;
    if (src && !src.startsWith('data:')) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = image.getAttribute('alt') || '';
      imageCell = img;
    }
  }

  const body = [];
  const titleEl = content.querySelector('.c-teaser__header, h2, h3, h4');
  const titleText = clean(titleEl ? titleEl.textContent : '');
  if (titleText) {
    const h = document.createElement('h3');
    h.textContent = titleText;
    body.push(h);
  }

  const textEl = content.querySelector('.c-teaser__text');
  let dateText = '';
  if (textEl) {
    const textClone = textEl.cloneNode(true);
    const timeEl = textClone.querySelector('time');
    if (timeEl) {
      dateText = clean(timeEl.textContent);
      timeEl.remove();
    }
    const paras = [...textClone.querySelectorAll('p')];
    const sources = paras.length ? paras : [textClone];
    sources.forEach((src) => {
      const t = clean(src.textContent);
      if (!t) return;
      const p = document.createElement('p');
      p.textContent = t;
      body.push(p);
    });
  }
  if (!dateText) {
    const timeEl = content.querySelector('time');
    if (timeEl) dateText = clean(timeEl.textContent);
  }
  if (dateText) {
    const p = document.createElement('p');
    const em = document.createElement('em');
    em.textContent = dateText;
    p.append(em);
    body.push(p);
  }

  const href = anchor ? anchor.getAttribute('href') : null;
  const ctaEl = content.querySelector('.c-teaser__link');
  const ctaText = clean(ctaEl ? ctaEl.textContent : '') || 'Find out more';
  if (href) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = href;
    a.textContent = ctaText;
    p.append(a);
    body.push(p);
  }
  return { imageCell, body };
}

/** Default content of a text-media column: headings, images, rich text. */
function textColumnNodes(col, document) {
  const out = [];
  const pickImg = (img) => {
    let src = img.getAttribute('data-src');
    if (!src || src.startsWith('data:')) src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return null;
    const out2 = document.createElement('img');
    out2.src = absUrl(src);
    out2.alt = img.getAttribute('alt') || '';
    return out2;
  };
  const walk = (node) => {
    [...node.children].forEach((el) => {
      if (el.matches('script, style, .c-image__tools, .c-scroll-hint, .c-image__lazyload-placeholder')) return;
      if (/^H[1-6]$/.test(el.tagName)) {
        const h = document.createElement(el.tagName.toLowerCase());
        h.textContent = clean(el.textContent);
        if (h.textContent) out.push(h);
        return;
      }
      if (el.matches('figure')) {
        const img = el.querySelector('img.c-image__embed-item') || el.querySelector('img');
        const pic = img ? pickImg(img) : null;
        if (pic) { const p = document.createElement('p'); p.append(pic); out.push(p); }
        const cap = clean(el.querySelector('figcaption')?.textContent);
        if (cap) { const p = document.createElement('p'); p.textContent = cap; out.push(p); }
        return;
      }
      if (el.matches('.c-media__text')) {
        [...el.children].forEach((child) => {
          if (!clean(child.textContent) && !child.querySelector('img')) return;
          const c = child.cloneNode(true);
          c.querySelectorAll('i.u-icon, svg').forEach((n) => n.remove());
          c.querySelectorAll('a[href]').forEach((a) => a.setAttribute('href', absUrl(a.getAttribute('href'))));
          c.removeAttribute('class');
          c.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
          out.push(c);
        });
        return;
      }
      if (el.matches('a.c-button[href]')) {
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = absUrl(el.getAttribute('href'));
        a.textContent = clean(el.textContent);
        p.append(a);
        out.push(p);
        return;
      }
      walk(el);
    });
  };
  walk(col);
  return out;
}

export default function parse(element, { document }) {
  // ---- options ---------------------------------------------------------------
  const isSlider = element.matches('.c-content-slider');
  const tabItem = !isSlider ? element.closest('.o-tabs__content-item') : null;

  // ---- mixed rows: teaser columns next to text-media columns ----------------
  const columns = element.matches('.row') ? [...element.children] : [];
  const teaserCols = columns.filter((c) => c.querySelector('.c-teaser'));
  const textCols = columns.filter((c) => !c.querySelector('.c-teaser')
    && c.querySelector('[data-ctype="textmedia"]') && clean(c.textContent));

  if (!isSlider && !tabItem && textCols.length && teaserCols.length === 1) {
    const row = [];
    columns.forEach((col) => {
      if (col === teaserCols[0]) {
        const cell = [];
        collectItems(col).forEach((item) => {
          const { imageCell, body } = buildTeaser(item, document);
          if (imageCell) { const p = document.createElement('p'); p.append(imageCell); cell.push(p); }
          cell.push(...body);
        });
        if (cell.length) row.push(cell);
      } else if (textCols.includes(col)) {
        const nodes = textColumnNodes(col, document);
        if (nodes.length) row.push(nodes);
      }
    });
    if (row.length) {
      const block = WebImporter.Blocks.createBlock(document, { name: 'columns-content', cells: [row] });
      element.replaceWith(block);
      return;
    }
  }

  const scope = element;
  const items = collectItems(scope);
  const cells = [];
  items.forEach((item) => {
    const { imageCell, body } = buildTeaser(item, document);
    if (!imageCell && !body.length) return;
    cells.push([imageCell, body.length ? body : '']);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  let variant = '';
  if (isSlider) {
    variant = 'slider';
  } else if (tabItem) {
    variant = 'tabbed';
    // heading row: the panel's container header H3, else the tab label
    const contentWrap = element.parentElement;
    const headerRow = contentWrap
      ? [...contentWrap.children].find((c) => c !== element && c.matches('.o-container__header')
        && (c.compareDocumentPosition(element) & 4))
      : null;
    const headerHeading = headerRow ? headerRow.querySelector('h1, h2, h3, h4, h5, h6') : null;
    let label = clean(headerHeading ? headerHeading.textContent : '');
    if (!label) {
      const id = tabItem.getAttribute('data-tabs-target');
      const tabs = tabItem.closest('.o-tabs');
      const trigger = tabs && id ? tabs.querySelector(`.o-tabs__header-item[data-tabs-trigger="${id}"]`) : null;
      label = clean(trigger ? trigger.textContent : '');
    }
    if (label) {
      const h = document.createElement('h3');
      h.textContent = label;
      cells.unshift([h]);
      // the header row only held the tab heading: drop it (now the heading row)
      if (headerRow && clean(headerRow.textContent) === label) headerRow.remove();
    }
  } else {
    // column classes of the teasers decide two-up / four-up
    const colClasses = items.map(({ content }) => {
      const col = content.closest('[class*="col-"]');
      return col && (element.contains(col) || col === element) ? String(col.className) : '';
    }).filter(Boolean);
    if (colClasses.length) {
      if (colClasses.every((c) => /\bcol-md-3\b/.test(c))) variant = 'four-up';
      else if (colClasses.every((c) => /\bcol-md-6\b/.test(c) || (/\bcol-sm-6\b/.test(c) && !/\bcol-md-\d+\b/.test(c)))) variant = 'two-up';
    }
  }

  const name = variant ? `Cards Teaser (${variant})` : 'cards-teaser';
  const block = WebImporter.Blocks.createBlock(document, { name, cells });

  // text-media columns of a mixed row stay default content around the block
  if (!isSlider && !tabItem && textCols.length) {
    const firstTeaser = teaserCols[0];
    const before = [];
    const after = [];
    textCols.forEach((col) => {
      const nodes = textColumnNodes(col, document);
      if (firstTeaser && (col.compareDocumentPosition(firstTeaser) & 4)) before.push(...nodes);
      else after.push(...nodes);
    });
    element.replaceWith(block);
    before.forEach((n) => block.before(n));
    let anchor = block;
    after.forEach((n) => { anchor.after(n); anchor = n; });
    return;
  }

  element.replaceWith(block);
}
