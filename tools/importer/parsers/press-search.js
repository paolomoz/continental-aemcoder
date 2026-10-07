/* eslint-disable */
/* global WebImporter */
/**
 * Parser for press-search. Base: search.
 * Source: https://www.continental.com/en/press/press-releases/ (+ category landings)
 * Generated: 2026-10-06
 *
 * The source Solr UI (facets, results, pagination) is rendered at runtime by the block
 * from /en/press/press-index.json, so no static results are imported. The parser emits
 * the key/value config rows from blocks/press-search/README.md. Category landings show
 * only their own facet tab and preset a "has any tag in this facet" filter.
 */
const INDEX = '/en/press/press-index.json';
const ALL_FACETS = ['published', 'corporate-topics', 'products-technologies', 'vehicle-types'];
const CATEGORY_LANDINGS = {
  'corporate-topics': 'corporate-topics',
  'products-technologies': 'products-technologies',
  'vehicle-types': 'vehicle-types',
};

function pageCategory(params, url) {
  const href = (params && params.originalURL) || url || '';
  let pathname = '';
  try {
    pathname = new URL(href).pathname;
  } catch (e) {
    pathname = href;
  }
  const slug = pathname.replace(/\/+$/, '').split('/').pop();
  return CATEGORY_LANDINGS[slug] || null;
}

export default function parse(element, { document, url, params }) {
  const category = pageCategory(params, url);

  const indexLink = document.createElement('a');
  indexLink.setAttribute('href', INDEX);
  indexLink.textContent = INDEX;

  const cells = [
    ['Index', indexLink],
    ['Page Size', '9'],
    ['Facets', (category ? [category] : ALL_FACETS).join(', ')],
  ];
  if (category) cells.push(['Filter', category]);
  cells.push(['Sort', 'date-desc']);

  element.replaceWith(WebImporter.Blocks.createBlock(document, { name: 'Press Search', cells }));
}
