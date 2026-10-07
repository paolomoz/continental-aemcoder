/* eslint-disable */
/* global WebImporter */
/**
 * Parser for cards-latest-news. Base: cards.
 * Sources:
 *   https://www.continental.com/en/press/press-releases/oe-porsche/ (sidebar .c-news-sidebar)
 *   https://www.continental.com/en/press/ (tabbed news .o-tabs .o-tabs__content-item)
 * Generated: 2026-10-06
 *
 * Static news items are NOT imported: the block renders them at runtime from the
 * press query index (blocks/cards-latest-news/cards-latest-news.js). Output is the
 * block's config, 1 column (key/value rows use 2 cells as the block reads them).
 *
 * 1) Sidebar (.c-news-sidebar, press-release template) - unchanged minimal output:
 *      row: heading "Latest News"
 *      row: link to the query index (/en/press/press-index.json)
 *      row: "All news" link (/en/press/press-releases/)
 *
 * 2) Landing tabs (.o-tabs__content-item). The tab label is read from the tab nav
 *    (.o-tabs__header-item, matched by aria-controls/id or by index):
 *    - curated tab (e.g. "Recommended News": hand-picked teasers, no "show all" link)
 *        -> "Cards Latest News (teaser, curated, tabbed)"
 *           row: heading (tab label)
 *           one row per article: a link to the article path (link text = title,
 *           used only as fallback when the article is not in the index)
 *    - latest tab (e.g. "Latest News": contains the news list + "show all" link)
 *        -> "Cards Latest News (teaser, tabbed)"
 *           row: heading (tab label)
 *           index    | /en/press/press-index.json
 *           limit    | 9
 *           all-news | <source "show all" href, default /en/press/press-releases/>
 */
export default function parse(element, { document }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const INDEX = '/en/press/press-index.json';
  const ALL_NEWS = '/en/press/press-releases/';
  const LATEST_LIMIT = '9';

  const toPath = (href) => {
    if (!href) return '';
    if (/^https?:\/\/(www\.)?continental\.com\//i.test(href)) {
      try {
        const u = new URL(href);
        return u.pathname + u.search + u.hash;
      } catch (e) { return href; }
    }
    return href;
  };
  const makeLink = (href, text) => {
    const a = document.createElement('a');
    a.href = toPath(href);
    a.textContent = text;
    return a;
  };
  const makeHeading = (text, level = 'h3') => {
    const h = document.createElement(level);
    h.textContent = text;
    return h;
  };

  const tabItem = element.matches('.o-tabs__content-item') ? element : null;

  /* ---------- 2) landing page tabs ---------- */
  if (tabItem) {
    const tabs = tabItem.closest('.o-tabs');
    // index among the content wrapper's children - earlier tabs may already have
    // been replaced in place by their block table, so count all element siblings
    const index = tabItem.parentElement ? [...tabItem.parentElement.children].indexOf(tabItem) : 0;

    // tab label: aria-controls/id match first, then the same index in the tab nav
    let labelEl = null;
    if (tabs) {
      const navItems = [...tabs.querySelectorAll('.o-tabs__header-item, .o-tabs__header [role="tab"], .o-tabs__header button, .o-tabs__header a')]
        .filter((n, i, arr) => !arr.some((o) => o !== n && o.contains(n)));
      const id = tabItem.getAttribute('id');
      if (id) labelEl = navItems.find((n) => n.getAttribute('aria-controls') === id || n.getAttribute('href') === `#${id}`) || null;
      if (!labelEl && index > -1) labelEl = navItems[index] || null;
    }
    const label = clean(labelEl && labelEl.textContent)
      || clean(tabItem.querySelector('h2, h3') && tabItem.querySelector('h2, h3').textContent)
      || (index > 0 ? 'Latest News' : 'Recommended News');

    // "show all" link (latest tab only): a button-style link that is not a teaser
    const showAll = [...tabItem.querySelectorAll('a[href]')]
      .find((a) => !a.closest('.c-teaser') && !a.matches('.c-teaser')
        && (a.matches('[class*="c-button"]') || /show all|all (press|news)/i.test(a.textContent)));

    // articles: iterate the inner .c-teaser__content wrapper (immune to anchor
    // merging) and read the href from the enclosing teaser anchor
    let articles = [...tabItem.querySelectorAll('.c-teaser__content')].map((content) => {
      const anchor = content.closest('a[href]');
      const header = content.querySelector('.c-teaser__header, h2, h3, h4');
      return {
        href: anchor && anchor.getAttribute('href'),
        title: clean((anchor && anchor.getAttribute('title')) || (header && header.textContent)),
      };
    });
    if (!articles.length) {
      articles = [...tabItem.querySelectorAll('a.c-teaser[href]')].map((a) => ({
        href: a.getAttribute('href'),
        title: clean(a.getAttribute('title') || a.textContent),
      }));
    }
    articles = articles.filter((a) => a.href);

    const isLatest = !!showAll || !!tabItem.querySelector('.c-news-sidebar, .c-search__results')
      || /latest/i.test(label);

    const cells = [[makeHeading(label)]];
    let name;
    if (isLatest) {
      name = 'Cards Latest News (teaser, tabbed)';
      const allHref = (showAll && showAll.getAttribute('href')) || ALL_NEWS;
      cells.push(['index', makeLink(INDEX, INDEX)]);
      cells.push(['limit', LATEST_LIMIT]);
      cells.push(['all-news', makeLink(allHref, clean(showAll && showAll.textContent) || 'All news')]);
    } else {
      if (!articles.length) {
        element.replaceWith(...element.childNodes);
        return;
      }
      name = 'Cards Latest News (teaser, curated, tabbed)';
      const seen = new Set();
      articles.forEach(({ href, title }) => {
        const path = toPath(href);
        if (seen.has(path)) return;
        seen.add(path);
        cells.push([makeLink(path, title || path)]);
      });
    }

    const block = WebImporter.Blocks.createBlock(document, { name, cells });
    element.replaceWith(block);
    return;
  }

  /* ---------- 1) article sidebar (.c-news-sidebar) ---------- */
  const headlineEl = element.querySelector('.c-news-sidebar__headline, [class*="headline"], h2, h3, h4');
  const heading = makeHeading(clean(headlineEl && headlineEl.textContent) || 'Latest News');

  const indexLink = makeLink(INDEX, 'press-index');

  const srcAll = element.querySelector('.c-news-sidebar__link a[href]');
  const allHref = (srcAll && srcAll.getAttribute('href')) || ALL_NEWS;
  const allLink = makeLink(allHref, clean(srcAll && srcAll.textContent) || 'All news');

  const cells = [
    [heading],
    [indexLink],
    [allLink],
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-latest-news', cells });
  element.replaceWith(block);
}
