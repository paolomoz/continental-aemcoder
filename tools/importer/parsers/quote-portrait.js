/* eslint-disable */
/* global WebImporter */
/**
 * Parser for quote-portrait. Base: quote (custom; no library convention).
 * Source: https://www.continental.com/en/press/studies-publications/continental-mobility-studies/mobility-study-2024/
 *         https://www.continental.com/en/press/studies-publications/ (pastel-green, portrait right)
 * Generated: 2026-10-06
 *
 * Instance: .c-quote
 *   portrait     img.c-quote__image (inside .c-quote__image-container.is-left|is-right)
 *   quote text   .c-quote__text
 *   attribution  .c-quote__author (span.u-text-style__bold name, <br>, role text)
 * Output (block contract, 2 columns):
 *   Row 1: [portrait image, quote text]
 *   Row 2: [attribution: <strong>name</strong><br>role, '']
 * The portrait is optional (empty first cell when missing).
 */
export default function parse(element, { document }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const abs = (u) => {
    try { return new URL(u, 'https://www.continental.com/').href; } catch (e) { return u; }
  };

  // portrait
  const srcImg = element.querySelector('img.c-quote__image') || element.querySelector('img');
  let imageCell = '';
  if (srcImg) {
    const src = [srcImg.getAttribute('data-src'), srcImg.getAttribute('src')]
      .find((s) => s && !s.startsWith('data:'));
    if (src) {
      const img = document.createElement('img');
      img.src = abs(src);
      img.alt = srcImg.getAttribute('alt') || srcImg.getAttribute('title') || '';
      imageCell = img;
    }
  }

  // quote text (keep paragraphs when the source has them)
  const textEl = element.querySelector('.c-quote__text') || element.querySelector('blockquote, q');
  const quoteCell = [];
  if (textEl) {
    const paras = [...textEl.querySelectorAll('p')].filter((p) => clean(p.textContent));
    if (paras.length) {
      paras.forEach((p) => {
        const np = document.createElement('p');
        np.textContent = clean(p.textContent);
        quoteCell.push(np);
      });
    } else if (clean(textEl.textContent)) {
      const p = document.createElement('p');
      p.textContent = clean(textEl.textContent);
      quoteCell.push(p);
    }
  }

  // attribution: bold name + role
  const authorEl = element.querySelector('.c-quote__author') || element.querySelector('cite, footer');
  let authorCell = '';
  if (authorEl && clean(authorEl.textContent)) {
    const p = document.createElement('p');
    const nameEl = authorEl.querySelector('.u-text-style__bold, strong, b');
    const name = clean(nameEl ? nameEl.textContent : '');
    if (name) {
      const strong = document.createElement('strong');
      strong.textContent = name;
      p.append(strong);
      const clone = authorEl.cloneNode(true);
      const cloneName = clone.querySelector('.u-text-style__bold, strong, b');
      if (cloneName) cloneName.remove();
      const role = clean(clone.textContent);
      if (role) {
        p.append(document.createElement('br'));
        p.append(document.createTextNode(role));
      }
    } else {
      p.textContent = clean(authorEl.textContent);
    }
    authorCell = p;
  }

  if (!quoteCell.length && !authorCell) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const cells = [[imageCell, quoteCell.length ? quoteCell : '']];
  if (authorCell) cells.push([authorCell, '']);

  const block = WebImporter.Blocks.createBlock(document, { name: 'quote-portrait', cells });
  element.replaceWith(block);
}
