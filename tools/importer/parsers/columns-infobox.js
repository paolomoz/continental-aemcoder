/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-infobox. Base: columns.
 * Source: https://www.continental.com/en/press/press-releases/oe-porsche/
 * Generated: 2026-10-06
 *
 * Instances:
 *  - press-release: the .row inside the light-grey nested container
 *    (.o-container.is-lightgray.is-nested). Its direct column children hold
 *    either an image (figure.c-image) or rich text (.c-media__text: paragraphs + CTA).
 *  - press-landing (https://www.continental.com/en/press/): the text-with-image CE
 *    .c-media__content.is-image-intext itself; its direct children are
 *    .c-media__gallery (image) and .c-media__text (text incl. CTA link).
 *
 * Output: one row; one cell per source column in document order
 * (normally [image cell, text cell]). The container heading (.o-container__header)
 * is outside the instance and stays default content.
 */
export default function parse(element, { document }) {
  const isPlaceholder = (src) => !src || /^data:/i.test(src);
  const abs = (u) => {
    if (!u) return '';
    try { return new URL(u, 'https://www.continental.com/').href; } catch (e) { return u; }
  };

  const pickImage = (scope) => {
    const img = scope.querySelector('img.c-image__embed-item')
      || [...scope.querySelectorAll('img')].find((i) => !isPlaceholder(i.getAttribute('src')) || i.getAttribute('data-src'));
    if (!img) return null;
    let src = img.getAttribute('data-src');
    if (isPlaceholder(src)) src = img.getAttribute('src');
    if (isPlaceholder(src)) {
      const source = img.closest('picture')?.querySelector('source[data-srcset], source[srcset]');
      src = source ? (source.getAttribute('data-srcset') || source.getAttribute('srcset')).split(',')[0].trim().split(/\s+/)[0] : '';
    }
    if (isPlaceholder(src)) return null;
    const out = document.createElement('img');
    out.src = abs(src);
    out.alt = img.getAttribute('alt') || '';
    return out;
  };

  const buildText = (scope) => {
    const text = scope.querySelector('.c-media__text, .s-richtext') || scope;
    const nodes = [...text.querySelectorAll(':scope > p, :scope > ul, :scope > ol, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6')]
      .filter((n) => n.textContent.trim() || n.querySelector('a, img'));
    nodes.forEach((n) => {
      n.querySelectorAll('a[href]').forEach((a) => {
        a.removeAttribute('class');
        a.setAttribute('href', abs(a.getAttribute('href')));
      });
    });
    // CTA in its own paragraph: a paragraph ending in a link preceded by text
    // (landing: "Here are the five most important findings: <a>When Mobility Changes</a>")
    // is split so the link sits alone in the following paragraph.
    const out = [];
    nodes.forEach((n) => {
      out.push(n);
      if (n.tagName !== 'P') return;
      const last = n.lastElementChild;
      if (!last || last.tagName !== 'A' || !last.getAttribute('href')) return;
      let after = last.nextSibling;
      while (after && after.nodeType === 3 && !after.textContent.trim()) after = after.nextSibling;
      if (after) return;
      const before = n.textContent.replace(last.textContent, '').trim();
      if (!before) return;
      const cta = document.createElement('p');
      cta.append(last);
      out.push(cta);
    });
    return out;
  };

  // direct columns of the row; fall back to the row itself
  let columns = [...element.querySelectorAll(':scope > div')].filter((c) => c.textContent.trim() || c.querySelector('img'));
  if (!columns.length) columns = [element];

  const row = [];
  columns.forEach((col) => {
    const hasText = !!col.querySelector('.c-media__text, .s-richtext, p');
    if (!hasText && col.querySelector('figure, picture, img')) {
      const img = pickImage(col);
      if (img) row.push(img);
      return;
    }
    // mixed column: image above text inside one CE -> split into image + text cells
    const figure = col.querySelector('.c-media__gallery figure');
    if (figure) {
      const img = pickImage(figure);
      if (img) row.push(img);
    }
    const text = buildText(col);
    if (text.length) row.push(text);
  });

  if (!row.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [row];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-infobox', cells });
  element.replaceWith(block);
}
