/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-content. Base: columns (library convention: one row, one
 * cell per column, default content in each cell).
 * Source: https://www.continental.com/en/press/studies-publications/ (image | text, wide-left text | image),
 *         https://www.continental.com/en/press/studies-publications/figures-data-facts/ (Tires | ContiTech),
 *         https://www.continental.com/en/press/studies-publications/continental-mobility-studies/mobility-study-2024/
 * Generated: 2026-10-06
 *
 * Instance: a has-columns grid row (.o-container.has-columns > .o-container__content > .row)
 * whose columns (.col-*) hold only text-media CEs (headings, rich text, images, buttons).
 * Rows with teasers, fact boxes, contacts, accordions, sliders, quotes, videos or
 * tables are excluded by the selector (handled by their own blocks). Note: jsdom
 * cannot parse the instance selector; Chromium can.
 *
 * Output: one row, one cell per non-empty source column, in source order.
 * Each cell: CE header headings (level kept), images (+ figcaption), rich-text
 * children (p, ul, ol, headings) with absolute links; the figure tool overlays
 * (.c-image__tools: share/download) are dropped.
 * Option wide-left: two columns split .col-md-8 + .col-md-4.
 *
 * Guard: when an earlier parser already turned part of the row into a block
 * (e.g. columns-infobox inside a column, accordion-lined), the row is left as is
 * so blocks are never nested in block cells.
 */
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const absUrl = (u) => {
  if (!u) return '';
  if (/^(tel|mailto):/i.test(u) || u.startsWith('#')) return u.trim();
  try { return new URL(u, 'https://www.continental.com/').href; } catch (e) { return u; }
};

function pickImage(img, document) {
  let src = img.getAttribute('data-src');
  if (!src || src.startsWith('data:')) src = img.getAttribute('src');
  if (!src || src.startsWith('data:')) {
    const source = img.closest('picture')?.querySelector('source[data-srcset], source[srcset]');
    src = source ? (source.getAttribute('data-srcset') || source.getAttribute('srcset')).split(',')[0].trim().split(/\s+/)[0] : '';
  }
  if (!src || src.startsWith('data:')) return null;
  const out = document.createElement('img');
  out.src = absUrl(src);
  out.alt = img.getAttribute('alt') || '';
  return out;
}

function columnNodes(col, document) {
  const out = [];
  const para = (child) => {
    const p = document.createElement('p');
    if (typeof child === 'string') p.textContent = child;
    else p.append(child);
    return p;
  };
  const walk = (node) => {
    [...node.children].forEach((el) => {
      if (el.matches('script, style, .c-image__tools, .c-scroll-hint, .c-image__lazyload-placeholder, .c-sharelist, [data-lightbox-dc-window]')) return;
      if (/^H[1-6]$/.test(el.tagName)) {
        const h = document.createElement(el.tagName.toLowerCase());
        h.textContent = clean(el.textContent);
        if (h.textContent) out.push(h);
        return;
      }
      if (el.matches('figure')) {
        const img = el.querySelector('img.c-image__embed-item') || el.querySelector('img');
        const pic = img ? pickImage(img, document) : null;
        if (pic) out.push(para(pic));
        const cap = el.querySelector('figcaption');
        if (cap) {
          const capClone = cap.cloneNode(true);
          capClone.querySelectorAll('.c-image__tools').forEach((n) => n.remove());
          const t = clean(capClone.textContent);
          if (t) out.push(para(t));
        }
        return;
      }
      if (el.matches('.c-media__text')) {
        [...el.children].forEach((child) => {
          if (!clean(child.textContent) && !child.querySelector('img')) return;
          const c = child.cloneNode(true);
          c.querySelectorAll('i.u-icon, svg, script').forEach((n) => n.remove());
          c.querySelectorAll('strong, b, em, span').forEach((n) => { if (!n.textContent.trim() && !n.querySelector('img')) n.remove(); });
          c.querySelectorAll('a[href]').forEach((a) => {
            a.setAttribute('href', absUrl(a.getAttribute('href')));
            a.removeAttribute('target');
            a.removeAttribute('rel');
          });
          c.querySelectorAll('img').forEach((i) => {
            const pic = pickImage(i, document);
            if (pic) i.replaceWith(pic); else i.remove();
          });
          c.removeAttribute('class');
          c.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
          out.push(c);
        });
        return;
      }
      if (el.matches('a.c-button[href]')) {
        const a = document.createElement('a');
        a.href = absUrl(el.getAttribute('href'));
        a.textContent = clean(el.textContent);
        if (a.textContent) out.push(para(a));
        return;
      }
      if (el.matches('img')) {
        const pic = pickImage(el, document);
        if (pic) out.push(para(pic));
        return;
      }
      walk(el);
    });
  };
  walk(col);
  return out;
}

export default function parse(element, { document }) {
  // an earlier parser already placed a block in this row: do not nest blocks
  if (element.querySelector('table')) return;

  const columns = [...element.children].filter((c) => c.matches('div'));
  const row = [];
  const kept = [];
  columns.forEach((col) => {
    const nodes = columnNodes(col, document);
    if (!nodes.length) return;
    row.push(nodes);
    kept.push(col);
  });

  if (!row.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const wideLeft = kept.length === 2
    && /\bcol-md-8\b/.test(kept[0].className) && /\bcol-md-4\b/.test(kept[1].className);
  const name = wideLeft ? 'Columns Content (wide-left)' : 'columns-content';
  const block = WebImporter.Blocks.createBlock(document, { name, cells: [row] });
  element.replaceWith(block);
}
