/* eslint-disable */
/* global WebImporter */
/**
 * Parser for search-box. Base: search.
 * Source: https://www.continental.com/en/press/ (press search form)
 * Generated: 2026-10-06
 *
 * Instance: the Solr search form wrapper (.c-search__form). The suggest box
 * (frequent searches, autocomplete) and submit button are UI chrome and are dropped.
 *
 * Output (1 column, 1 content row - same shape as the library Search block):
 * a single link whose href is the search target. Unlike the library block this
 * project's custom search-box does not query an index itself; it navigates to
 * {href}?q=<term> (see blocks/search-box/metadata.json contentPattern), so the
 * link points at the press results page /en/press/press-releases/ and its text
 * is the input placeholder (fallback "Search").
 */
export default function parse(element, { document }) {
  const RESULTS_PAGE = '/en/press/press-releases/';
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const input = element.querySelector('input.c-search__input')
    || element.querySelector('input[type="search"], input[type="text"]')
    || element.querySelector('input:not([type="hidden"]):not([type="submit"])');
  const placeholder = clean(input && (input.getAttribute('placeholder') || input.getAttribute('aria-label')));

  const link = document.createElement('a');
  link.href = RESULTS_PAGE;
  link.textContent = placeholder || 'Search';

  const cells = [[link]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'search-box', cells });
  element.replaceWith(block);
}
