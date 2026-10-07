/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-gallery. Base: cards.
 * Source: https://www.continental.com/en/press/press-releases/oe-porsche/
 *         https://www.continental.com/en/press/press-releases/20250708-more-sustainable-fillers/
 *         press-content: https://www.continental.com/en/press/fairs-events/ces-2025/ (slider, four-up),
 *         https://www.continental.com/en/press/fairs-events/results-q1-2026/ (sliders)
 * Generated: 2026-10-06
 *
 * press-content options: 'slider' for a bare .c-content-slider of photos (outside
 * the press-release article column), 'four-up' for a grid row of .col-md-3
 * captioned photos. Slider photos without figcaption take the lightbox anchor title.
 *
 * Instances:
 *  - a nested white container (.o-container.is-white.is-nested) holding 2+ figures
 *    in grid columns (oe-porsche), or wrapping a .c-content-slider (fillers page)
 *  - a bare .c-content-slider (skipped by the import loop when its parent
 *    container was already replaced)
 *
 * Output (cards convention, 2 columns): one row per figure.c-image:
 *   [image cell, text cell (caption paragraph + link to hi-res original)]
 *
 * Iteration is keyed on figure.c-image (a block element, never nested inside
 * another figure), not on the image anchors. The figure tool overlays
 * (.c-image__tools: download modal, share list, zoom) are ignored.
 */
export default function parse(element, { document }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const isPlaceholder = (src) => !src || /^data:/i.test(src) || /spinner|placeholder|blank\.gif/i.test(src);
  const abs = (u) => {
    if (!u) return '';
    try { return new URL(u, 'https://www.continental.com/').href; } catch (e) { return u; }
  };

  // Pick the best real image URL: the largest candidate from data-srcset/srcset
  // and data-src; fall back to src when it is not a lazy placeholder.
  const bestSrc = (figure) => {
    const img = figure.querySelector('img.c-image__embed-item')
      || figure.querySelector('picture img:not([src^="data:"])')
      || figure.querySelector('img');
    if (!img) return { src: '', alt: '' };
    const candidates = [];
    const addSet = (set, fallbackWidth) => {
      (set || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((entry) => {
        const [url, descriptor] = entry.split(/\s+/);
        if (isPlaceholder(url)) return;
        const w = descriptor && /w$/.test(descriptor) ? parseInt(descriptor, 10) : (fallbackWidth || 0);
        candidates.push({ url, w });
      });
    };
    const picture = img.closest('picture');
    if (picture) {
      picture.querySelectorAll('source').forEach((source) => {
        const w = parseInt(source.getAttribute('width'), 10) || 0;
        addSet(source.getAttribute('data-srcset'), w);
        addSet(source.getAttribute('srcset'), w);
      });
    }
    const imgW = parseInt(img.getAttribute('width'), 10) || 0;
    const dataSrc = img.getAttribute('data-src');
    if (!isPlaceholder(dataSrc)) candidates.push({ url: dataSrc, w: imgW });
    addSet(img.getAttribute('data-srcset'), imgW);
    addSet(img.getAttribute('srcset'), imgW);
    const src = img.getAttribute('src');
    let chosen = '';
    if (candidates.length) {
      candidates.sort((a, b) => b.w - a.w);
      chosen = candidates[0].url;
    }
    if (!chosen && !isPlaceholder(src)) chosen = src;
    return { src: abs(chosen), alt: img.getAttribute('alt') || '' };
  };

  let figures = [...element.querySelectorAll('figure.c-image')]
    .filter((f) => !f.parentElement || !f.parentElement.closest('figure'));
  if (!figures.length) figures = [...element.querySelectorAll('figure')];

  const cells = [];
  figures.forEach((figure) => {
    const { src, alt } = bestSrc(figure);
    const captionEl = figure.querySelector('figcaption');
    // Content-slider photos (press-content, e.g. CES exhibit photos) have no
    // figcaption; their title sits on the lightbox anchor.
    const titleA = figure.querySelector('.position-relative > a[title], a[data-lightbox][title]');
    const caption = clean(captionEl ? captionEl.textContent : '')
      || clean(titleA ? titleA.getAttribute('title') : '');
    const hiResA = figure.querySelector('a[href*="/fileadmin/"]:not(.c-sharelist__link)')
      || figure.querySelector('.position-relative > a[href]');
    const hiRes = hiResA ? abs(hiResA.getAttribute('href')) : '';

    let imageCell = '';
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt || caption;
      imageCell = img;
    }

    const textCell = [];
    if (caption) {
      const p = document.createElement('p');
      p.textContent = caption;
      textCell.push(p);
    }
    if (hiRes) {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = hiRes;
      a.textContent = 'Download';
      p.append(a);
      textCell.push(p);
    }

    if (!imageCell && !textCell.length) return;
    cells.push([imageCell, textCell.length ? textCell : '']);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // keep a container header heading (if any) as default content above the block
  const header = element.querySelector('.o-container__header');
  const headings = header ? [...header.querySelectorAll('h1, h2, h3, h4, h5, h6')] : [];

  // Options (press-content):
  //  - slider:  the instance is a bare .c-content-slider outside the press-release
  //             article column (press-release sliders keep the plain grid output)
  //  - four-up: the instance is a grid row whose photos sit in .col-md-3 columns
  const inArticleColumn = !!element.closest('.col-md-8.col-lg-9');
  const isSlider = element.matches('.c-content-slider') && !inArticleColumn;
  const isFourUp = !isSlider && element.matches('.row')
    && figures.some((f) => f.closest('[class*="col-md-3"]'));
  const variant = (isSlider && 'slider') || (isFourUp && 'four-up') || '';
  const name = variant ? `Cards Gallery (${variant})` : 'cards-gallery';

  const block = WebImporter.Blocks.createBlock(document, { name, cells });
  element.replaceWith(block);
  headings.forEach((h) => block.before(h));
}
