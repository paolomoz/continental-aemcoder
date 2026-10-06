/* eslint-disable */
/* global WebImporter */
/**
 * Parser for carousel-hero. Base: carousel.
 * Source: https://www.continental.com/en/ (homepage hero slider .c-heroteaser-fixed),
 *         https://www.continental.com/en/press/ (press landing hero, white text)
 * Generated: 2026-10-06
 *
 * Output: one row per slide -> [image cell, text cell (eyebrow, title, description, CTAs)].
 * Validated selectors (source.html):
 *   .c-heroteaser-fixed__slide, picture.c-heroteaser__picture img,
 *   .c-heroteaser__title, .c-heroteaser__description, .c-heroteaser__links a.c-heroteaser__link
 * Navigation arrows/dots are UI chrome and are ignored.
 *
 * Option light-text: when the slider/slides carry a white-text class
 * (e.g. .c-heroteaser__textcolor-white, used on the press landing page) the
 * block is emitted as "Carousel Hero (light-text)"; otherwise plain carousel-hero
 * (homepage, unchanged).
 */
export default function parse(element, { document }) {
  let slides = [...element.querySelectorAll('.c-heroteaser-fixed__slide')];
  if (!slides.length) slides = [...element.querySelectorAll('[class*="__slide"]:not([class*="__slides"])')];
  // Single fixed hero (press-content, e.g. studies-publications:
  // main > .c-heroteaser-fixed:not(.c-heroteaser-fixed--slider)) normally still
  // carries one __slide; without one the whole hero is the single slide.
  if (!slides.length) slides = [element];

  const cells = [];

  slides.forEach((slide) => {
    // image cell
    const img = slide.querySelector('.c-heroteaser-fixed__multimedia img, picture img, img:not([src^="data:"])');
    let imageCell = '';
    if (img && !(img.getAttribute('src') || '').startsWith('data:')) {
      const image = document.createElement('img');
      image.src = img.getAttribute('src') || img.src;
      image.alt = img.getAttribute('alt') || '';
      imageCell = image;
    }

    // text cell
    const textCell = [];
    const eyebrowEl = slide.querySelector('[class*="eyebrow"], [class*="topline"], [class*="kicker"], [class*="overline"]');
    if (eyebrowEl && eyebrowEl.textContent.trim()) {
      const p = document.createElement('p');
      p.textContent = eyebrowEl.textContent.trim();
      textCell.push(p);
    }

    const titleEl = slide.querySelector('.c-heroteaser__title') || slide.querySelector('h1, h2, h3');
    if (titleEl && titleEl.textContent.trim()) {
      const h = document.createElement('h2');
      h.textContent = titleEl.textContent.replace(/\s+/g, ' ').trim();
      textCell.push(h);
    }

    const descEl = slide.querySelector('.c-heroteaser__description');
    if (descEl && descEl.textContent.trim()) {
      const p = document.createElement('p');
      p.textContent = descEl.textContent.replace(/\s+/g, ' ').trim();
      textCell.push(p);
    }

    let links = [...slide.querySelectorAll('.c-heroteaser__links a[href]')];
    if (!links.length) links = [...slide.querySelectorAll('a.c-button[href], a.c-heroteaser__link[href]')];
    links.forEach((link) => {
      const label = link.textContent.replace(/\s+/g, ' ').trim();
      if (!label) return;
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = link.getAttribute('href');
      a.textContent = label;
      p.append(a);
      textCell.push(p);
    });

    if (!imageCell && !textCell.length) return;
    cells.push([imageCell, textCell.length ? textCell : '']);
  });

  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const WHITE_TEXT = '[class*="textcolor-white"], [class*="text-color-white"], [class*="is-color-white"], .text-white';
  const lightText = element.matches(WHITE_TEXT) || !!element.querySelector(WHITE_TEXT);
  const name = lightText ? 'Carousel Hero (light-text)' : 'carousel-hero';

  const block = WebImporter.Blocks.createBlock(document, { name, cells });
  element.replaceWith(block);
}
