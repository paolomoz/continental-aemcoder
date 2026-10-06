/* eslint-disable */
/* global WebImporter */
/**
 * Parser for widget-share-price. Base: widget (custom, no library convention).
 * Source: https://www.continental.com/en/ (.o-page__ce holding the equitystory iframe)
 * Generated: 2026-10-06
 *
 * Output: one row, one cell -> [link to the equitystory iframe src, "Share Price Chart" link].
 * Never emits a /widgets/ link (scripts.js auto-blocks those).
 */
const DEFAULT_SRC = 'https://charts3.equitystory.com/teaser-t1/continental-ag-v31/English/';

export default function parse(element, { document }) {
  const iframe = element.querySelector('iframe[src*="equitystory"]') || element.querySelector('iframe[src]');
  const src = (iframe && iframe.getAttribute('src')) || DEFAULT_SRC;

  const content = [];

  const srcP = document.createElement('p');
  const srcLink = document.createElement('a');
  srcLink.href = src;
  srcLink.textContent = src;
  srcP.append(srcLink);
  content.push(srcP);

  // CTA buttons (e.g. "Share Price Chart"), skipping any /widgets/ placeholder links
  const ctas = [...element.querySelectorAll('a[href]')]
    .filter((a) => !/\/widgets\//.test(a.getAttribute('href')));
  ctas.forEach((a) => {
    const label = a.textContent.replace(/\s+/g, ' ').trim();
    if (!label) return;
    const p = document.createElement('p');
    const link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = label;
    p.append(link);
    content.push(p);
  });

  const cells = [[content]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'widget-share-price', cells });
  element.replaceWith(block);
}
