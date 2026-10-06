/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-stats. Base: cards (no images).
 * Source: https://www.continental.com/en/ (row of .c-fact-box key figures),
 *         https://www.continental.com/en/press/studies-publications/figures-data-facts/ (unit components)
 * Generated: 2026-10-06
 *
 * Output: one row per .c-fact-box, one cell -> [label (h3), number (p), unit (p > strong), description (p)].
 * The block decorator merges all cells and tags label/value/unit/description itself.
 *
 * Numbers animate up from "0" on the live page, so the final value is read from the
 * counter's data attributes (data-count-to + data-count-decimals), with text as fallback.
 * Iteration is keyed on .c-fact-box (a div, iteration-safe).
 */
function readValue(countEl) {
  if (!countEl) return '';
  const raw = countEl.getAttribute('data-count-to')
    || countEl.getAttribute('data-count')
    || countEl.getAttribute('data-value')
    || countEl.getAttribute('data-to')
    || countEl.getAttribute('data-target');
  if (raw !== null && raw !== undefined && raw !== '') {
    const decimalsAttr = countEl.getAttribute('data-count-decimals');
    const num = Number(raw);
    if (!Number.isNaN(num) && decimalsAttr !== null && decimalsAttr !== '') {
      const decimals = parseInt(decimalsAttr, 10) || 0;
      const useSep = countEl.getAttribute('data-count-tsdsep') === '1';
      const locale = countEl.getAttribute('data-count-locale') || 'en-US';
      return num.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: useSep,
      });
    }
    return raw.trim();
  }
  return countEl.textContent.replace(/\s+/g, ' ').trim();
}

export default function parse(element, { document }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const boxes = [...element.querySelectorAll('.c-fact-box')];
  const cells = [];

  boxes.forEach((box) => {
    const content = [];

    const titleEl = box.querySelector('.c-fact-box__title');
    if (titleEl && clean(titleEl.textContent)) {
      const h = document.createElement('h3');
      h.textContent = clean(titleEl.textContent);
      content.push(h);
    }

    const countEl = box.querySelector('.c-fact-box__countable, [data-count-to]')
      || box.querySelector('.c-fact-box__number');
    let value = readValue(countEl);
    // Unit/prefix components next to the counter (figures-data-facts: "~" 76,000,
    // 19.7 "billion", 100 "%"): symbols are glued onto the number; word units
    // ("billion") become the bold unit line, which the block styles as the unit.
    const numberEl = countEl ? countEl.closest('.c-fact-box__number') : null;
    const wordUnits = [];
    if (value && numberEl) {
      let before = '';
      let after = '';
      let seen = false;
      [...numberEl.querySelectorAll('.c-fact-box__number-component')].forEach((comp) => {
        if (comp === countEl || comp.contains(countEl)) { seen = true; return; }
        const t = clean(comp.textContent);
        if (!t) return;
        if (/[A-Za-zÀ-ɏ]{2,}/.test(t)) { wordUnits.push(t); return; }
        if (seen) after += t;
        else before += t;
      });
      value = `${before}${value}${after}`;
    }
    if (value) {
      const p = document.createElement('p');
      p.textContent = value;
      content.push(p);
    }

    const textEl = box.querySelector('.c-fact-box__text');
    const clone = textEl ? textEl.cloneNode(true) : null;
    const unitEl = clone ? clone.querySelector('strong, b') : null;
    const unitText = [...wordUnits, unitEl ? clean(unitEl.textContent) : ''].filter(Boolean).join(' ');
    if (unitText) {
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = unitText;
      p.append(strong);
      content.push(p);
    }
    if (clone) {
      if (unitEl) unitEl.remove();
      const desc = clean(clone.textContent.replace(/ /g, ' '));
      if (desc) {
        const p = document.createElement('p');
        p.textContent = desc;
        content.push(p);
      }
    }

    if (content.length) cells.push([content]);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-stats', cells });
  element.replaceWith(block);
}
