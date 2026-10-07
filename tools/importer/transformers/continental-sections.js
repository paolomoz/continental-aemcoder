/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: continental.com sections.
 * Inserts section breaks (<hr>) and Section Metadata blocks driven by
 * payload.template.sections. Template-agnostic.
 *
 * Homepage: every section is a top-level `main > .o-container` (or the hero);
 *   a section's background image (when present) lives in
 *   `.o-container__bg-image > img` (homepage capture).
 *
 * Press release: sections can be NESTED. The infobox
 *   (`.o-container.is-lightgray.is-nested`) and `.c-pageoptions` live inside
 *   the article column (`.col-12.col-md-8.col-lg-9`, section 2), and the sidebar
 *   column (`.col-12.col-md-4.col-lg-3`) is its sibling (press-release capture).
 *   For a section whose element sits inside another section's element, an <hr>
 *   is inserted before it AND a closing <hr> after it when more content of the
 *   enclosing section follows and does not itself start a template section.
 *   That trailing chunk becomes its own unstyled section (no metadata), so it is
 *   not swallowed by the nested section's style.
 *
 * beforeTransform: insert <hr> markers and capture background images while
 *   every section element still exists (parsers replace elements between hooks).
 * afterTransform: attach Section Metadata (style + background image) to markers.
 *
 * The cleanup transformer removes `.o-container__bg-image` wrappers in
 * afterTransform, after the image has been captured here.
 */

const SECTION_MARKER_ATTR = 'data-excat-section-id';
const SECTION_START_ATTR = 'data-excat-section-start';
const BG_IMAGE_ATTR = 'data-excat-section-bg';
const BG_IMAGE_SELECTOR = ':scope > .o-container__bg-image';

function querySection(root, selectors) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const sel of list) {
    if (!sel) continue;
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // invalid selector in template data - try next candidate
    }
  }
  return null;
}

// Resolve the background image URL of a section element (o-container).
function getBackgroundImageSrc(sectionEl) {
  if (!sectionEl) return null;
  let bg = null;
  try {
    bg = sectionEl.querySelector(BG_IMAGE_SELECTOR);
  } catch (e) {
    bg = null;
  }
  if (!bg) return null;
  const img = bg.querySelector('img');
  if (img) {
    const candidates = [
      img.getAttribute('src'),
      img.getAttribute('data-src'),
      img.currentSrc,
    ];
    const src = candidates.find((s) => s && !s.startsWith('data:'));
    if (src) return src;
  }
  // Fallback: CSS background-image on the wrapper
  const style = bg.getAttribute('style') || '';
  const match = style.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/i);
  return match ? match[1] : null;
}

// Template-declared background (e.g. section.backgroundImage / section.sectionMetadata.backgroundImage)
function getTemplateBackground(section) {
  const bg = section.backgroundImage
    || (section.sectionMetadata && section.sectionMetadata.backgroundImage);
  if (!bg) return null;
  if (typeof bg === 'string') return bg;
  return bg.src || bg.local || null;
}

// Does a node carry content that would end up in the imported document?
function isMeaningful(node) {
  if (!node) return false;
  if (node.nodeType === 3) return node.textContent.trim() !== ''; // text
  if (node.nodeType !== 1) return false; // comments etc.
  const tag = node.tagName;
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'TEMPLATE'].includes(tag)) return false;
  if (tag === 'HR') return false; // an existing break already closes the section
  if (node.textContent.trim() !== '') return true;
  return !!node.querySelector && !!node.querySelector('img, picture, video, iframe, table, form');
}

// Is there meaningful content after `el` (up to, not beyond, `container`)
// that does not itself start another template section?
function hasTrailingContent(el, container) {
  let node = el;
  while (node && node !== container) {
    let sib = node.nextSibling;
    while (sib) {
      if (sib.nodeType === 1 && sib.hasAttribute(SECTION_START_ATTR)) return false;
      if (sib.nodeType === 1 && sib.querySelector && sib.querySelector(`[${SECTION_START_ATTR}]`)) {
        // another section starts inside this sibling - only content before it matters
        return false;
      }
      if (isMeaningful(sib)) return true;
      sib = sib.nextSibling;
    }
    node = node.parentNode;
  }
  return false;
}

/* ------------------------------------------------------------------------ */
/* Container mode (template.sectionMode === 'containers', e.g. press-content) */
/* ------------------------------------------------------------------------ */
//
// Heterogeneous pages: every top-level container starts a section, styled from
// template.sectionStyles (container class -> style). Selectors verified in the
// CES 2025 capture (migration-work/cleaned.html) and live press-content samples:
//   banner        main > div.c-heroteaser.c-heroteaser--small
//   hero slider   main > div.c-heroteaser-fixed
//   breadcrumb    main > div.o-container.pb-0.d-none.d-sm-flex.d-print-none (skipped)
//   containers    main > div#c191295.o-container.is-white.has-columns, #c191291.o-container.is-lightgray, ...
//   wrapper       main > div.d-print-none > div#c15888.o-container.is-white (results-q1-2026:
//                 full-width containers after the two-column block sit in a plain wrapper div)
//   two-column    main > div.o-container > .o-container__content > .row >
//                   div.col-12.col-md-8.col-lg-9 + div.o-container__sidebar.col-12.col-md-4.col-lg-3
//   three-column  #c194305 .row > 3x div.d-flex.col-12.col-sm-6.col-md-4 (accordion | text | video)

const CM_HR_ATTR = 'data-excat-cm';
const CM_STYLE_ATTR = 'data-excat-cm-style';
const CM_FIRST_ATTR = 'data-excat-cm-first';
const SIDEBAR_COL_SELECTOR = ':scope > .o-container__content > .row > .col-md-4.col-lg-3';
const MAIN_COL_SELECTOR = ':scope > .col-md-8.col-lg-9';

// Text / media an author would see (ignores scripts, icon data-URI imgs, whitespace).
function hasVisibleContent(el) {
  if (!el) return false;
  const clone = el.cloneNode(true);
  clone.querySelectorAll('script, style, noscript, template, svg').forEach((n) => n.remove());
  if (clone.textContent.replace(/ /g, ' ').trim() !== '') return true;
  return [...clone.querySelectorAll('img, video, iframe, table, form[data-minicart]')]
    .some((n) => n.tagName !== 'IMG' || !(n.getAttribute('src') || '').startsWith('data:'));
}

function isBreadcrumbContainer(el) {
  return el.matches('.d-print-none, .pb-0.d-none') || !!el.querySelector(':scope > .o-container__content > nav.c-breadcrumb');
}

// Ordered list of top-level section candidates (descends into plain wrapper divs).
function collectContainers(root, out = []) {
  [...root.children].forEach((child) => {
    if (child.matches('.c-heroteaser, .c-heroteaser-fixed')) {
      out.push(child);
    } else if (child.matches('.o-container')) {
      if (!isBreadcrumbContainer(child) && hasVisibleContent(child)) out.push(child);
    } else if (child.tagName === 'DIV' && child.querySelector(':scope > .o-container, :scope > .c-heroteaser')) {
      collectContainers(child, out);
    }
  });
  return out;
}

// CES section 4: one row of exactly three equal columns mixing accordion / text / video.
function isThreeColumn(container) {
  const rows = container.querySelectorAll(':scope > .o-container__content > .row:not(.o-container__header)');
  if (rows.length !== 1) return false;
  const cols = [...rows[0].children];
  if (cols.length !== 3 || !cols.every((c) => /\bcol-md-4\b/.test(c.className))) return false;
  // card grids (teasers / fact boxes) are blocks, not a three-column layout
  if (rows[0].querySelector('.c-teaser, .c-fact-box')) return false;
  const kinds = new Set();
  cols.forEach((c) => {
    if (c.querySelector('.o-accordion')) kinds.add('accordion');
    else if (c.querySelector('.c-media__embed.is-video, video')) kinds.add('video');
    else if (c.querySelector('.c-media__text')) kinds.add('text');
  });
  return kinds.size >= 2;
}

function containerStyle(el, styleMap) {
  if (el.matches('.c-heroteaser--small')) return 'banner';
  if (el.matches('.c-heroteaser-fixed, .c-heroteaser')) return null;
  const styles = [];
  // has-image wins over the colour modifier (has-image containers are also .is-white)
  const keys = Object.keys(styleMap || {}).sort((a, b) => (b === 'has-image') - (a === 'has-image'));
  const colourKey = keys.find((k) => el.classList.contains(k));
  if (colourKey && styleMap[colourKey]) styles.push(styleMap[colourKey]);
  if (isThreeColumn(el)) styles.push('three-column');
  return styles.length ? styles.join(', ') : null;
}

function insertMarker(doc, target, { style, bgSrc, first }) {
  const hr = doc.createElement('hr');
  hr.setAttribute(CM_HR_ATTR, '');
  if (style) hr.setAttribute(CM_STYLE_ATTR, style);
  if (bgSrc) hr.setAttribute(BG_IMAGE_ATTR, bgSrc);
  if (first) hr.setAttribute(CM_FIRST_ATTR, '');
  target.before(hr);
  return hr;
}

function containerModeBefore(element, template) {
  const doc = element.ownerDocument || document;
  const main = element.querySelector('main') || element;
  const containers = collectContainers(main);
  let prevStyle = null;
  let count = 0;

  containers.forEach((el) => {
    const bgSrc = getBackgroundImageSrc(el);
    const style = containerStyle(el, template.sectionStyles);
    const sidebar = el.querySelector(SIDEBAR_COL_SELECTOR);
    const hasSidebar = !!(sidebar && sidebar.parentElement.querySelector(MAIN_COL_SELECTOR)
      && hasVisibleContent(sidebar));

    // Merge consecutive containers with the same non-null style (no bg image, no sidebar).
    const merge = count > 0 && style && style === prevStyle && !bgSrc && !hasSidebar
      && style !== 'banner';
    if (!merge) {
      const first = count === 0;
      if (!first || style || bgSrc) insertMarker(doc, el, { style, bgSrc, first });
      count += 1;
    }
    prevStyle = bgSrc ? null : style;

    if (hasSidebar) {
      // Two-column layout: the sidebar column is its own 'sidebar' section; content
      // following it inside the same container closes with a plain break.
      el.setAttribute(SECTION_START_ATTR, '');
      if (hasTrailingContent(sidebar, el)) sidebar.after(doc.createElement('hr'));
      el.removeAttribute(SECTION_START_ATTR);
      insertMarker(doc, sidebar, { style: 'sidebar' });
      prevStyle = null;
      count += 1;
    }
  });
}

function containerModeAfter(element) {
  const doc = element.ownerDocument || document;
  [...element.querySelectorAll(`hr[${CM_HR_ATTR}]`)].reverse().forEach((marker) => {
    const cells = {};
    const style = marker.getAttribute(CM_STYLE_ATTR);
    const bgSrc = marker.getAttribute(BG_IMAGE_ATTR);
    if (style) cells.style = style;
    if (bgSrc) {
      const img = doc.createElement('img');
      img.setAttribute('src', bgSrc);
      cells['background-image'] = img;
    }
    if (Object.keys(cells).length) {
      marker.after(WebImporter.Blocks.createBlock(doc, { name: 'Section Metadata', cells }));
    }
    const first = marker.hasAttribute(CM_FIRST_ATTR);
    [CM_HR_ATTR, CM_STYLE_ATTR, BG_IMAGE_ATTR, CM_FIRST_ATTR].forEach((a) => marker.removeAttribute(a));
    if (first) marker.remove(); // first section never gets a leading break
  });
}

export default function transform(hookName, element, payload) {
  const template = (payload && payload.template) || {};
  if (template.sectionMode === 'containers') {
    if (hookName === 'beforeTransform') containerModeBefore(element, template);
    if (hookName === 'afterTransform') containerModeAfter(element);
    return;
  }

  const sections = (payload && payload.template && payload.template.sections) || [];
  if (sections.length < 2) return;
  const doc = element.ownerDocument || document;

  if (hookName === 'beforeTransform') {
    // Resolve every section element up front (nothing has been inserted yet).
    const resolved = sections.map((section) => querySection(element, section.selector));
    resolved.forEach((el) => { if (el) el.setAttribute(SECTION_START_ATTR, ''); });

    // Reverse order so earlier sections keep their DOM positions/indices.
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const sectionEl = resolved[i];
      if (!sectionEl) continue;

      // Nested: the closest other template section element that contains this one.
      let container = null;
      resolved.forEach((other, j) => {
        if (!other || j === i || other === sectionEl || !other.contains(sectionEl)) return;
        if (!container || container.contains(other)) container = other;
      });

      // Closing break after a nested section when more of the enclosing section
      // follows. Plain <hr> (no marker): the trailing chunk gets no metadata.
      if (container && hasTrailingContent(sectionEl, container)) {
        sectionEl.after(doc.createElement('hr'));
      }

      const bgSrc = getBackgroundImageSrc(sectionEl) || getTemplateBackground(section);
      const needsMetadata = !!section.style || !!bgSrc;
      if (i === 0 && !needsMetadata) continue;

      const hr = doc.createElement('hr');
      if (needsMetadata) hr.setAttribute(SECTION_MARKER_ATTR, section.id);
      if (bgSrc) hr.setAttribute(BG_IMAGE_ATTR, bgSrc);
      sectionEl.before(hr);
    }

    resolved.forEach((el) => { if (el) el.removeAttribute(SECTION_START_ATTR); });
  }

  if (hookName === 'afterTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const marker = element.querySelector(`[${SECTION_MARKER_ATTR}="${section.id}"]`);
      const anchor = marker || (section.style ? querySection(element, section.selector) : null);
      if (!anchor) continue;

      const cells = {};
      if (section.style) cells.style = section.style;

      const bgSrc = marker ? marker.getAttribute(BG_IMAGE_ATTR) : null;
      if (bgSrc) {
        const img = doc.createElement('img');
        img.setAttribute('src', bgSrc);
        cells['background-image'] = img;
      }

      if (Object.keys(cells).length) {
        const metadataBlock = WebImporter.Blocks.createBlock(doc, {
          name: 'Section Metadata',
          cells,
        });
        anchor.after(metadataBlock);
      }

      if (marker) {
        marker.removeAttribute(SECTION_MARKER_ATTR);
        marker.removeAttribute(BG_IMAGE_ATTR);
        if (i === 0) marker.remove(); // first section never gets a leading break
      }
    }
  }
}
