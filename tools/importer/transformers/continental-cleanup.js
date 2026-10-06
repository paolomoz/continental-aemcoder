/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: continental.com site-wide cleanup.
 * Template-agnostic: all continental.com pages share the o-page / o-header /
 * o-container / o-footer layout. Every selector below was verified in
 * migration-work/cleaned.html (line refs are from that capture).
 */
const TransformHook = { beforeTransform: 'beforeTransform', afterTransform: 'afterTransform' };

const PRESS_LANDING = 'press-landing';
// Source-styled CTA links (press-landing capture):
//   <a class="c-button--internal"> (quick-link pills, Mobility Studies CTA)
const CTA_LINK_SELECTOR = 'a.c-button--internal, a.c-button';

function normText(str) {
  return (str || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-]+$/, '')}…`;
}

function stripSiteSuffix(title) {
  return (title || '').replace(/\s*[-–—|]\s*Continental AG\s*$/i, '').trim();
}

// Resolve a template section element by section name: template selectors first,
// then a fallback verified in the press-landing capture.
function getSectionEl(element, payload, name, fallback) {
  const sections = (payload && payload.template && payload.template.sections) || [];
  const section = sections.find((s) => s.name === name);
  const selectors = [...((section && section.selector) || []), fallback].filter(Boolean);
  for (const sel of selectors) {
    try {
      const el = element.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // invalid selector - try next
    }
  }
  return null;
}

// <p><strong><a href>label</a></strong></p> -> EDS decorateButtons makes it a primary button.
// Keeps the source class so section selectors (:has(a.c-button--internal)) still match.
function buttonParagraph(doc, link) {
  const a = doc.createElement('a');
  a.setAttribute('href', link.getAttribute('href'));
  if (link.getAttribute('class')) a.setAttribute('class', link.getAttribute('class'));
  if (link.getAttribute('title')) a.setAttribute('title', link.getAttribute('title'));
  a.textContent = normText(link.textContent);
  const strong = doc.createElement('strong');
  strong.append(a);
  const p = doc.createElement('p');
  p.append(strong);
  return p;
}

function isBlankParagraph(p) {
  return p && p.tagName === 'P' && !normText(p.textContent) && !p.querySelector('img, picture, a');
}

// Section 3 (quick-links): one <p> holding (optional lead-in +) N pill links separated
// by &nbsp; -> lead-in <p> + one button <p> per link; drop the trailing &nbsp; <p>.
// Found: <p><a href="/en/press/press-contacts/" class="c-button--internal">Press contacts</a>&nbsp; ... (6 links)</p>
//        followed by <p>&nbsp;</p>
function splitQuickLinks(element, payload) {
  const doc = element.ownerDocument || document;
  const scope = getSectionEl(element, payload, 'quick-links',
    'main > .o-container.is-white:has(.c-media__text a.c-button--internal):not(.has-columns)');
  if (!scope) return;
  scope.querySelectorAll('.c-media__text p').forEach((p) => {
    const links = [...p.querySelectorAll('a.c-button--internal')];
    if (links.length < 2) return;
    const replacement = [];
    // lead-in: everything before the first link (bold text etc.)
    const leadIn = doc.createElement('p');
    for (const node of [...p.childNodes]) {
      if (node.nodeType === 1 && (node === links[0] || node.contains(links[0]))) break;
      leadIn.append(node);
    }
    if (normText(leadIn.textContent)) replacement.push(leadIn);
    links.forEach((link) => replacement.push(buttonParagraph(doc, link)));
    // trailing empty paragraph(s) used as spacing
    let next = p.nextElementSibling;
    while (isBlankParagraph(next)) {
      const blank = next;
      next = next.nextElementSibling;
      blank.remove();
    }
    p.replaceWith(...replacement);
  });
}

// Section 7 (mobility-studies): the CTA sits at the end of a text paragraph.
// columns-infobox (tools/importer/parsers/columns-infobox.js) copies `:scope > p`
// verbatim into its text cell, so the CTA must already be its own paragraph.
// Found: <p>Here are the five most important findings: <a href="/en/stories/when-mobility-changes/"
//          class="c-button--internal"><strong>When Mobility Changes</strong></a></p>
function splitTrailingCta(element, payload) {
  const doc = element.ownerDocument || document;
  const scope = getSectionEl(element, payload, 'mobility-studies', 'main > .o-container.is-pastel-yellow');
  if (!scope) return;
  scope.querySelectorAll('.c-media__text p').forEach((p) => {
    const links = [...p.querySelectorAll(CTA_LINK_SELECTOR)];
    if (links.length !== 1) return;
    const link = links[0];
    // the link (or its <strong> wrapper) must be the last meaningful child
    const holder = link.parentElement !== p && link.parentElement.tagName === 'STRONG'
      && link.parentElement.parentElement === p ? link.parentElement : link;
    if (holder.parentElement !== p) return;
    let after = holder.nextSibling;
    while (after) {
      if (after.nodeType === 1 ? after.tagName !== 'BR' && normText(after.textContent) : normText(after.textContent)) return;
      after = after.nextSibling;
    }
    const cta = buttonParagraph(doc, link);
    holder.remove();
    // trim trailing whitespace / <br> left behind in the lead-in paragraph
    while (p.lastChild && ((p.lastChild.nodeType === 3 && !normText(p.lastChild.textContent))
      || (p.lastChild.nodeType === 1 && p.lastChild.tagName === 'BR'))) {
      p.lastChild.remove();
    }
    if (p.lastChild && p.lastChild.nodeType === 3) {
      p.lastChild.textContent = p.lastChild.textContent.replace(/[\s ]+$/, '');
    }
    if (normText(p.textContent)) p.after(cta);
    else p.replaceWith(cta);
  });
}

// press-landing has no meta description and <title> "Press - Continental AG".
// Set both in <head> so WebImporter.rules.createMetadata picks them up.
// Description source: intro paragraph under the h1 (section 2, intro-search).
// Found: <h1>Press</h1> ... <div class="c-media__text s-richtext mb-0 mt-0"><p><strong>This site&nbsp;will
//        provide you with a quick overview of the press portal. ...</strong></p>
function setLandingMetadata(element, payload) {
  const doc = element.ownerDocument || document;
  const head = doc.head || doc.querySelector('head');
  if (!head) return;

  const ogTitle = doc.querySelector('meta[property="og:title"]');
  let titleEl = doc.querySelector('title');
  const title = stripSiteSuffix((titleEl && titleEl.textContent)
    || (ogTitle && ogTitle.getAttribute('content'))
    || normText((element.querySelector('h1') || {}).textContent));
  if (title) {
    if (!titleEl) {
      titleEl = doc.createElement('title');
      head.append(titleEl);
    }
    titleEl.textContent = title;
  }

  let descEl = doc.querySelector('meta[name="description"]');
  if (descEl && normText(descEl.getAttribute('content'))) return;
  const intro = getSectionEl(element, payload, 'intro-search',
    'main > .o-container.is-white:has(> .o-container__content > .o-container__header h1)');
  const scope = (intro && intro.querySelector('.o-container__header')) || intro;
  const para = scope && [...scope.querySelectorAll('.c-media__text p')].find((p) => normText(p.textContent));
  const description = para ? truncate(normText(para.textContent), 160) : '';
  if (!description) return;
  if (!descEl) {
    descEl = doc.createElement('meta');
    descEl.setAttribute('name', 'description');
    head.append(descEl);
  }
  descEl.setAttribute('content', description);
}

// Site-wide <head> normalization so WebImporter.rules.createMetadata emits clean values:
// strip the " - Continental AG" suffix from <title>/og:title (otherwise an extra og:title
// row is written) and drop the generic default share image.
// Found: <title>Press Releases - Continental AG</title>,
//        <meta property="og:image" content=".../Images/HeaderDefaults/page.jpg">
function normalizeHeadMetadata(element) {
  const doc = element.ownerDocument || document;
  const titleEl = doc.querySelector('title');
  if (titleEl) titleEl.textContent = stripSiteSuffix(titleEl.textContent);
  doc.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]').forEach((m) => {
    m.setAttribute('content', stripSiteSuffix(m.getAttribute('content')));
  });
  doc.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach((m) => {
    if (/\/HeaderDefaults\//.test(m.getAttribute('content') || '')) m.remove();
  });
}

const PRESS_CONTENT = 'press-content';

// press-content (media-library pictures / videos): Solr search box container with no
// authorable content. Found: <div class="o-container is-white tx_solr"> > ... >
//   <div id="tx-solr-search" class="c-search"> (form, empty .c-search__filters / .c-search__results)
function removeSolrSearch(element, payload) {
  element.querySelectorAll('.o-container.tx_solr').forEach((container) => {
    const search = container.querySelector('.c-search');
    if (!search) return;
    const results = container.querySelector('.c-search__results');
    const hasResults = results && results.querySelector('a[href], img');
    const url = (payload && payload.params && payload.params.originalURL) || (payload && payload.url) || '';
    if (hasResults) {
      // keep populated results; drop only the search UI
      container.querySelectorAll('.c-search__form, .c-search__filters').forEach((el) => el.remove());
      console.log(`[continental-cleanup] removed Solr search form (results kept) ${url}`);
    } else {
      container.remove();
      console.log(`[continental-cleanup] removed Solr search box container ${url}`);
    }
  });
}

// Sidebar sub-navigation -> default content: <h3>title</h3><ul><li><a>..</a></li></ul>
// Found (press-contacts/corporate-communications): <div class="o-box">
//   <header class="o-box__title">Press Contact</header>
//   <div class="c-step-navigation"> (prev / "1 of 4" / next - UI only)
//   <ul class="c-list-lined has-2-cols-only-sm"><li><a class="c-list-lined__link" href title>..</a></li>
function convertSubNavBoxes(element) {
  const doc = element.ownerDocument || document;
  element.querySelectorAll('.o-box').forEach((box) => {
    const links = [...box.querySelectorAll('ul a[href]')];
    if (!links.length) return;
    const nodes = [];
    const title = normText((box.querySelector('.o-box__title') || {}).textContent);
    if (title) {
      const h3 = doc.createElement('h3');
      h3.textContent = title;
      nodes.push(h3);
    }
    const ul = doc.createElement('ul');
    links.forEach((link) => {
      const a = doc.createElement('a');
      a.setAttribute('href', link.getAttribute('href'));
      a.textContent = normText(link.textContent) || link.getAttribute('title') || link.getAttribute('href');
      const li = doc.createElement('li');
      li.append(a);
      ul.append(li);
    });
    nodes.push(ul);
    box.replaceWith(...nodes);
  });
}

// Only one H1 per page: demote every later H1 to H2.
// Found (CES 2025): <h1>CES 2025 - Advancing Mobility from Road to Cloud</h1> (#c191267) and
//   <h1>Continental | CES 2025 Photos</h1> (#c196569, photo slider header)
function demoteExtraH1s(element) {
  const doc = element.ownerDocument || document;
  const main = element.querySelector('main') || element;
  [...main.querySelectorAll('h1')].slice(1).forEach((h1) => {
    const h2 = doc.createElement('h2');
    [...h1.attributes].forEach((attr) => h2.setAttribute(attr.name, attr.value));
    h2.append(...h1.childNodes);
    h1.replaceWith(h2);
  });
}

// Download modal ("Available documents" form with per-file checkboxes).
// Found (CES 2025, results-q1-2026): <form [data-minicart]><h4 class="c-download-files-modal__title">
//   Available documents</h4><div class="c-download-files-modal__toggle-select">...
//   <div class="c-download-files-modal__files">...<div class="c-download-files-modal__footer">
// cards-downloads (tools/importer/parsers/cards-downloads.js) reads the modal's hidden
// inputs (.c-pageoptions and .o-page__ce:has(a.c-link--download)), so modals are removed
// only in afterTransform, and never inside a block table.
const DOWNLOAD_MODAL_SELECTOR = 'form:has(.c-download-files-modal__files), form:has(.c-download-files-modal__title), .c-download-files-modal';
function removeDownloadModals(element) {
  let modals = [];
  try {
    modals = [...element.querySelectorAll(DOWNLOAD_MODAL_SELECTOR)];
  } catch (e) {
    modals = [...element.querySelectorAll('.c-download-files-modal__files')].map((f) => f.closest('form') || f);
  }
  modals.forEach((modal) => {
    if (!modal.isConnected || modal.closest('table')) return;
    modal.remove();
  });
}

export default function transform(hookName, element, payload) {
  const templateName = payload && payload.template && payload.template.name;

  if (hookName === TransformHook.beforeTransform) normalizeHeadMetadata(element);

  if (hookName === TransformHook.beforeTransform && templateName === PRESS_CONTENT) {
    removeSolrSearch(element, payload);
    convertSubNavBoxes(element);
    demoteExtraH1s(element);
  }

  if (hookName === TransformHook.beforeTransform && templateName === PRESS_LANDING) {
    setLandingMetadata(element, payload);
    splitQuickLinks(element, payload);
    splitTrailingCta(element, payload);
  }

  if (hookName === TransformHook.beforeTransform) {
    // Consent manager (consentmanager.net) wrapper + its hidden cross-domain iframes
    // Found: <div id="cmpwrapper" class="cmpwrapper"> (line 2)
    // Found: <iframe title="Intentionally hidden, please ignore"> (lines 4-10, 3826)
    WebImporter.DOMUtils.remove(element, [
      '#cmpwrapper',
      'iframe[title="Intentionally hidden, please ignore"]',
      'iframe[src*="consentmanager.net"]',
    ]);

    // Country / language detection banner
    // Found: <section class="c-ip-redirect-banner__wrapper is-hidden"> (line 13)
    WebImporter.DOMUtils.remove(element, ['.c-ip-redirect-banner__wrapper']);

    // body has inline overflow:hidden (consent modal scroll lock) - restore scrolling
    // Found: <body id="page-4094" style="overflow: hidden;"> (line 1)
    const { body } = element.ownerDocument || document;
    if (body && body.style && body.style.overflow === 'hidden') {
      body.style.overflow = 'scroll';
    }

    // --- Article chrome (press-release capture, also present on the homepage) ---
    // Removed before parsing so block parsers never pick up spinner <img>s,
    // share lists or per-image download modals as content.
    WebImporter.DOMUtils.remove(element, [
      // Image hover tool overlays (download / share / zoom per image incl. their
      // hidden <form> download modals and c-sharelist popovers).
      // Found: <div class="c-image__tools"> inside figure.c-image (press-release),
      //        <div class="c-image__tools c-image__tools--top"> in .c-heroteaser (both templates)
      '.c-image__tools',
      // Lazy-load placeholder + spinner icon rendered inside <picture>
      // Found: <div class="c-image__lazyload-placeholder"><span class="... icon-con-spinner">
      '.c-image__lazyload-placeholder',
      // "scrollable" hint overlay next to tables (UI only)
      // Found: <div class="c-scroll-hint__icon is-white"><div class="c-scroll-hint__text">scrollable</div>
      '.c-scroll-hint__icon',
      // Page options: share toggle + share popover, print link. The downloads
      // item (<i> icon-con-download-multiple + <div><form>) is kept for the
      // cards-downloads parser, which consumes .c-pageoptions.
      // Found: <div class="c-pageoptions"><i class="c-pageoptions__item c-pageoptions__item--share ...">
      //        <span class="... icon-con-share">, <div>...<h3>Share:</h3><ul class="c-sharelist">,
      //        <a href="javascript:window.print();" class="c-pageoptions__item ..."> (icon-con-print)
      '.c-pageoptions > .c-pageoptions__item:has(.icon-con-share)',
      '.c-pageoptions > .c-pageoptions__item:has(.icon-con-print)',
      '.c-pageoptions > a[href^="javascript:"]',
      '.c-pageoptions > div:has(> ul.c-sharelist)',
    ]);
  }

  if (hookName === TransformHook.afterTransform) {
    WebImporter.DOMUtils.remove(element, [
      // Header incl. mega menu, search, language menu, download cart toggle
      // Found: <div class="o-header__spacer is-sticky"> (line 15), <header class="o-header is-visible"> (line 17)
      '.o-header__spacer',
      'header.o-header',
      // Mega menu dropdown panels and mobile off-canvas nav render as siblings
      // AFTER </header> (lines 220-2593), so they need their own selectors.
      // Found: <div class="c-main-nav__dropdown"> (line 220), <div class="c-offcanvas"> (line 724)
      '.c-main-nav__dropdown',
      '.c-offcanvas',
      // Download cart (lives in header meta bar, removed defensively if rendered elsewhere)
      // Found: <button class="c-download-cart__toggle-button"> (line 79)
      '.c-download-cart__toggle-button',
      // "Follow us on" social media strip
      // Found: <section class="c-socialmedia-list"> (line 3583)
      'section.c-socialmedia-list',
      // Footer
      // Found: <footer class="o-footer"> (line 3682)
      'footer.o-footer',
      // Scroll-to-top button
      // Found: <button class="c-scroll-to-top__button is-visible"> (line 3810)
      '.c-scroll-to-top__button',
      // Section background image wrappers. The sections transformer captures
      // the image into Section Metadata in beforeTransform; the wrapper itself
      // is never authorable content.
      // Found: <div class="o-container__bg-image ..."> (lines 2846, 3316)
      '.o-container__bg-image',
      // Breadcrumb bar (press-release capture). The wrapper o-container holds
      // nothing but the nav. Found: <div class="o-container pb-0 d-none d-sm-flex d-print-none">
      //   <div class="o-container__content container w-100"><nav class="c-breadcrumb mt-2 mt-md-0">
      '.o-container:has(> .o-container__content > nav.c-breadcrumb:only-child)',
      'nav.c-breadcrumb',
      // Page-options leftovers: if .c-pageoptions survives until afterTransform
      // the cards-downloads parser did not consume it, so whatever remains
      // (download modal form, icon toggles) is non-authorable widget chrome.
      // Found: <div class="c-pageoptions"> (press-release article column)
      '.c-pageoptions',
      // Remaining share popovers / close toggles anywhere (image tools, page options)
      // Found: <ul class="c-sharelist">, <div class="is-close ">
      'ul.c-sharelist',
      '.is-close',
      // Solr "Frequently searched" / suggestions / "Go directly to" flyouts (hidden UI).
      // Found: <div class="c-search__suggest-box-container"> in the header quicksearch
      //        (all templates) and in .o-container.tx_solr (press-landing)
      '.c-search__suggest-box-container',
      // Tab nav buttons. Parsers (cards-latest-news) read the labels in their own
      // pass, so the nav is removed only here.
      // Found: <div class="o-tabs__header"><div class="o-tabs__header-item has-hover is-active">Recommended News</div>...
      '.o-tabs__header',
      // Floating page section menu (toggle button + JS-filled list), rendered after </footer>.
      // Found (figures-data-facts): <div class="c-section-menu"><div class="c-section-menu__head">
      //   <button class="c-section-menu__toggle" aria-label="Show/Hide Section Menu">
      '.c-section-menu',
      // Slider arrows / dots and sub-nav pager (UI only; slides are consumed by parsers).
      // Found: <div class="c-content-slider__controls"> (CES), <div class="c-heroteaser-fixed__arrows">,
      //        <div class="c-heroteaser__dots"> (media-library/pictures),
      //        <div class="c-step-navigation"> (corporate-communications .o-box)
      '.c-content-slider__controls',
      '.c-heroteaser-fixed__arrows',
      '.c-heroteaser__dots',
      '.c-step-navigation',
      // Tracking / script / non-content elements
      'script',
      'noscript',
      'link',
      'style',
    ]);

    // Solr search leftovers outside the search-box block (press-landing .o-container.tx_solr):
    // the search-box parser replaces .c-search__form with a block table; anything solr-ish
    // that is not inside a block table is widget chrome.
    // Found: <form id="tx-solr-search-form-pi-results">, <input class="c-search__input tx-solr-q ...">,
    //        <button class="c-search__submit-button tx-solr-submit">, <div class="c-search__filters">,
    //        <div class="c-search__results row mt-3">
    element.querySelectorAll([
      '.tx_solr form',
      '.tx_solr input',
      '.tx_solr button',
      '.tx_solr .c-search__form-content',
    ].join(', ')).forEach((el) => {
      if (el.isConnected && !el.closest('table')) el.remove();
    });
    // Empty filter / result containers only; populated results (Latest News teasers)
    // belong to cards-latest-news and must never be dropped here.
    element.querySelectorAll('.tx_solr .c-search__filters, .tx_solr .c-search__results').forEach((el) => {
      if (el.isConnected && !el.closest('table') && !normText(el.textContent) && !el.querySelector('a, img')) {
        el.remove();
      }
    });

    // Download modals not consumed by cards-downloads
    removeDownloadModals(element);

    // Strip tracking / inline handler attributes
    element.querySelectorAll('[onclick], [data-track], [data-tracking]').forEach((el) => {
      el.removeAttribute('onclick');
      el.removeAttribute('data-track');
      el.removeAttribute('data-tracking');
    });
  }
}
