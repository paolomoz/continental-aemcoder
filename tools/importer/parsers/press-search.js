/* eslint-disable */
/* global WebImporter */
/**
 * Parser for press-search. Base: search.
 * Source: https://www.continental.com/en/press/press-releases/ (+ category landings)
 *         https://www.continental.com/en/press/press-releases/press-tires/ (tabbed Solr search
 *         preset to the "Tires" tag, inside a press-content page)
 * Generated: 2026-10-06
 *
 * The source Solr UI (facets, results, pagination) is rendered at runtime by the block
 * from /en/press/press-index.json, so no static results are imported. The parser emits
 * the key/value config rows from blocks/press-search/README.md. Category landings show
 * only their own facet tab and preset a "has any tag in this facet" filter.
 */
const INDEX = '/en/press/press-index.json';
const ALL_FACETS = ['published', 'corporate-topics', 'products-technologies', 'vehicle-types'];
// slug -> facet tab shown + Filter preset (README: `<facet>` or `<facet> | <label>`)
const CATEGORY_LANDINGS = {
  'corporate-topics': { facet: 'corporate-topics', filter: 'corporate-topics' },
  'products-technologies': { facet: 'products-technologies', filter: 'products-technologies' },
  'vehicle-types': { facet: 'vehicle-types', filter: 'vehicle-types' },
  // Found: tx_solr[filter][0]=tireTypes:<id> facet links; tag 168 = "Tires" (parent tag)
  'press-tires': { facet: 'products-technologies', filter: 'products-technologies | Tires' },
};

const pageSlug = (params, url) => {
  const href = (params && params.originalURL) || url || '';
  let pathname = '';
  try {
    pathname = new URL(href).pathname;
  } catch (e) {
    pathname = href;
  }
  return pathname.replace(/\/+$/, '').split('/').pop();
};

export default function parse(element, { document, url, params }) {
  const slug = pageSlug(params, url);
  const category = CATEGORY_LANDINGS[slug] || null;
  // The press-content selector also matches other Solr widgets (e.g. media galleries):
  // only the main listing and known category landings become a Press Search.
  if (!category && slug !== 'press-releases') return;

  const indexLink = document.createElement('a');
  indexLink.setAttribute('href', INDEX);
  indexLink.textContent = INDEX;

  const cells = [
    ['Index', indexLink],
    ['Page Size', '9'],
    ['Facets', (category ? [category.facet] : ALL_FACETS).join(', ')],
  ];
  if (category) cells.push(['Filter', category.filter]);
  cells.push(['Sort', 'date-desc']);

  element.replaceWith(WebImporter.Blocks.createBlock(document, { name: 'Press Search', cells }));
}
