/* eslint-disable */
/* global WebImporter */

/**
 * Transformer: continental.com press-release page metadata + contact fragments.
 * Active for templates 'press-release' and 'press-contact' (no-op for every other template).
 *
 * press-release
 *   beforeTransform: read page metadata while the original DOM is intact.
 *   afterTransform:  remove breadcrumb + eyebrow, turn sidebar contact cards into
 *                    fragment links, and append a Metadata block at the end of <main>.
 * press-contact (one import per spokesperson; URL hash `#contact=N` picks the card)
 *   afterTransform:  replace the document with the contact fragment and mark the
 *                    target fragment path with data-excat-output-path on the root.
 *
 * Selectors (press-release capture, migration-work/cleaned.html):
 *   article column  main .o-container__content > .row > .col-12.col-md-8.col-lg-9
 *   eyebrow         <div class="mb-3 u-text-h4"><div class="col col-auto">Press Release</div>
 *                     <div class="col c-news-detail__date">September 29, 2026</div>
 *   h1              header.c-media__header h1
 *   body paragraphs .o-page__ce .c-media__text p
 *   hero            main > .c-heroteaser img
 *   breadcrumb      main > .o-container > .o-container__content > nav.c-breadcrumb
 *   sidebar column  main .o-container__content > .row > .col-12.col-md-4.col-lg-3
 *   contact card    .c-contact > .u-text-h4 ("Contact"), .c-contact__content p > strong (name),
 *                   p.jobTitle (role), .c-contact__list a[href^="tel:"], a[href^="mailto:"]
 * Taxonomy map:     tools/importer/data/press-taxonomy.json (.articles keyed by pathname)
 */

import taxonomy from '../data/press-taxonomy.json';

const TEMPLATE_NAME = 'press-release';
const CONTACT_TEMPLATE_NAME = 'press-contact';
const FRAGMENT_BASE = '/en/press/fragments/contacts/';
const OUTPUT_PATH_ATTR = 'data-excat-output-path';

const ARTICLE_COL = 'main .o-container__content > .row > .col-12.col-md-8.col-lg-9';
const SIDEBAR_COL = 'main .o-container__content > .row > .col-12.col-md-4.col-lg-3';

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = '(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\\.?';
const DATE_MDY_RE = new RegExp(`${MONTH_RE}\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i');
const DATE_DMY_RE = new RegExp(`(\\d{1,2})\\.?\\s+${MONTH_RE}\\s+(\\d{4})`, 'i');
const DATE_NUM_RE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
// Dateline at the start of the first body paragraph, e.g.
// "Hanover, Germany, September 29, 2026. Continental has ..."
const DATELINE_RE = new RegExp(
  `^\\s*[^.!?]{0,80}?,\\s*(?:${MONTH_RE}\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\.?\\s+${MONTH_RE}\\s+\\d{4}|\\d{1,2}\\.\\d{1,2}\\.\\d{4})\\s*[.:\\-\\u2013\\u2014]\\s*`,
  'i',
);

// Values read in beforeTransform, consumed in afterTransform (per document).
const store = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
let lastData = null;

function text(el) {
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIso(y, m, d) {
  const yy = Number(y); const mm = Number(m); const dd = Number(d);
  if (!yy || !mm || !dd || mm > 12 || dd > 31) return '';
  return `${yy}-${pad(mm)}-${pad(dd)}`;
}

function monthNum(name) {
  return MONTHS[String(name).toLowerCase().replace('.', '').slice(0, 4)]
    || MONTHS[String(name).toLowerCase().slice(0, 3)];
}

// "September 29, 2026" | "29 September 2026" | "29.09.2026" -> "2026-09-29"
function parseDate(str) {
  if (!str) return '';
  let m = str.match(DATE_MDY_RE);
  if (m) return toIso(m[3], monthNum(m[1]), m[2]);
  m = str.match(DATE_DMY_RE);
  if (m) return toIso(m[3], monthNum(m[2]), m[1]);
  m = str.match(DATE_NUM_RE);
  if (m) return toIso(m[3], m[2], m[1]);
  return '';
}

function getMeta(doc, name) {
  const el = doc.querySelector(`meta[property="${name}"]`) || doc.querySelector(`meta[name="${name}"]`);
  return el ? (el.getAttribute('content') || '').trim() : '';
}

function stripSiteSuffix(title) {
  return (title || '').replace(/\s*[-–—|]\s*Continental AG\s*$/i, '').trim();
}

function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-]+$/, '')}…`;
}

function slugify(str) {
  return (str || '')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getPagePath(doc, payload) {
  const candidates = [
    payload && payload.params && payload.params.originalURL,
    payload && payload.url,
    (doc.querySelector('link[rel="canonical"]') || { getAttribute: () => '' }).getAttribute('href'),
    getMeta(doc, 'og:url'),
  ];
  for (const c of candidates) {
    if (!c) continue;
    try {
      let p = decodeURI(new URL(c, 'https://www.continental.com').pathname);
      p = p.replace(/\/index(\.plain)?\.html?$/, '/').replace(/\.html?$/, '');
      if (!p.endsWith('/')) p += '/';
      if (taxonomy && taxonomy.articles && taxonomy.articles[p]) return p;
    } catch (e) {
      // try next candidate
    }
  }
  return '';
}

function getTaxonomyEntry(doc, payload) {
  const articles = (taxonomy && taxonomy.articles) || {};
  const p = getPagePath(doc, payload);
  return p ? articles[p] : null;
}

function joinLabels(list) {
  return (Array.isArray(list) ? list : []).filter((l) => l && String(l).trim()).join(', ');
}

function getArticleColumn(element) {
  return element.querySelector(ARTICLE_COL);
}

function getEyebrowEl(articleCol) {
  if (!articleCol) return null;
  return articleCol.querySelector(':scope > .mb-3.u-text-h4');
}

// Standard line = "Press Release" label (+ optional .c-news-detail__date).
function isStandardEyebrow(el) {
  if (!el) return false;
  const dateEl = el.querySelector('.c-news-detail__date');
  let label = text(el);
  if (dateEl) label = label.replace(text(dateEl), '').trim();
  label = label.replace(DATE_MDY_RE, '').replace(/[|–—-]+\s*$/, '').trim();
  return /^press release$/i.test(label);
}

function getEyebrowLabel(el) {
  if (!el) return '';
  const dateEl = el.querySelector('.c-news-detail__date');
  let label = text(el);
  if (dateEl) label = label.replace(text(dateEl), '').trim();
  return label;
}

function getBodyParagraphs(articleCol) {
  if (!articleCol) return [];
  return [...articleCol.querySelectorAll('.o-page__ce .c-media__text p')]
    .filter((p) => !/\bu-text-h\d\b/.test(p.className || '') && text(p));
}

function readMetadata(element, payload) {
  const doc = element.ownerDocument || document;
  const entry = getTaxonomyEntry(doc, payload);
  const articleCol = getArticleColumn(element);
  const firstPara = getBodyParagraphs(articleCol)[0];
  const firstParaText = text(firstPara);

  // title: og:title -> h1 -> <title>, without " - Continental AG"
  const h1 = (articleCol && articleCol.querySelector('header.c-media__header h1')) || element.querySelector('h1');
  const title = stripSiteSuffix(getMeta(doc, 'og:title') || text(h1) || doc.title);

  // description: meta description -> taxonomy teaser -> first body paragraph (no dateline, <=160)
  let description = getMeta(doc, 'description');
  if (!description && entry && entry.teaser) description = String(entry.teaser).trim();
  if (!description && firstParaText) {
    description = truncate(firstParaText.replace(DATELINE_RE, '').trim(), 160);
  }

  // image: og:image -> hero image
  let image = getMeta(doc, 'og:image');
  if (!image) {
    const heroImg = element.querySelector('.c-heroteaser img');
    const src = heroImg && (heroImg.getAttribute('src') || heroImg.getAttribute('data-src'));
    if (src && !src.startsWith('data:')) image = src;
  }

  // publication-date: .c-news-detail__date -> taxonomy date -> dateline. Never meta[name=date]
  // (that is the last-modified date).
  let publicationDate = parseDate(text(element.querySelector('.c-news-detail__date')));
  if (!publicationDate && entry && entry.date) {
    const m = String(entry.date).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) publicationDate = `${m[1]}-${m[2]}-${m[3]}`;
  }
  if (!publicationDate && firstParaText) {
    const dl = firstParaText.match(DATELINE_RE);
    if (dl) publicationDate = parseDate(dl[0]);
  }

  // eyebrow: custom pre-header text only (standard "Press Release <date>" is template-rendered)
  let eyebrow = '';
  const eyebrowEl = getEyebrowEl(articleCol);
  if (eyebrowEl && !isStandardEyebrow(eyebrowEl)) eyebrow = getEyebrowLabel(eyebrowEl);

  return {
    title,
    description,
    image,
    'publication-date': publicationDate,
    eyebrow,
    'corporate-topics': entry ? joinLabels(entry['corporate-topics']) : '',
    'products-technologies': entry ? joinLabels(entry['products-technologies']) : '',
    'vehicle-types': entry ? joinLabels(entry['vehicle-types']) : '',
    template: TEMPLATE_NAME,
  };
}

function makeParagraph(doc, child) {
  const p = doc.createElement('p');
  if (typeof child === 'string') p.textContent = child;
  else if (child) p.append(child);
  return p;
}

// Build fragment body for one .c-contact card; returns { slug, nodes }.
function buildContactFragment(doc, card) {
  const nameEl = card.querySelector('.c-contact__content p > strong') || card.querySelector('strong');
  const name = text(nameEl);
  if (!name) return null;
  const slug = slugify(name);
  if (!slug) return null;

  const nodes = [];
  const strong = doc.createElement('strong');
  strong.textContent = name;
  nodes.push(makeParagraph(doc, strong));

  const role = text(card.querySelector('p.jobTitle'));
  if (role) nodes.push(makeParagraph(doc, role));

  card.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]').forEach((link) => {
    const a = doc.createElement('a');
    a.setAttribute('href', link.getAttribute('href').trim());
    a.textContent = text(link) || link.getAttribute('href').replace(/^(tel|mailto):/, '');
    nodes.push(makeParagraph(doc, a));
  });

  return { slug, nodes };
}

function processContacts(element) {
  const doc = element.ownerDocument || document;
  const scope = element.querySelector(SIDEBAR_COL) || element;
  const cards = [...scope.querySelectorAll('.c-contact')];
  if (!cards.length) return;

  let headingAdded = false;
  cards.forEach((card) => {
    const fragment = buildContactFragment(doc, card);
    if (!fragment) return;
    const path = `${FRAGMENT_BASE}${fragment.slug}`;

    const replacement = [];
    if (!headingAdded) {
      const heading = doc.createElement('h3');
      heading.textContent = text(card.querySelector(':scope > .u-text-h4')) || 'Contact';
      replacement.push(heading);
      headingAdded = true;
    }
    const link = doc.createElement('a');
    link.setAttribute('href', path);
    link.textContent = path;
    replacement.push(makeParagraph(doc, link));
    card.replaceWith(...replacement);
  });
}

// press-contact template: the document becomes the fragment of the Nth contact card
// (N from the URL hash `#contact=N`, default 1); the output path is the fragment path.
function renderContactFragment(element, payload) {
  const doc = element.ownerDocument || document;
  const pageUrl = (payload.params && payload.params.originalURL) || payload.url || '';
  const n = Number((pageUrl.match(/#contact=(\d+)/) || [])[1] || 1);
  const scope = element.querySelector(SIDEBAR_COL) || element;
  const card = [...scope.querySelectorAll('.c-contact')][n - 1];
  const fragment = card && buildContactFragment(doc, card);
  element.replaceChildren();
  if (!fragment) return;
  element.append(...fragment.nodes);
  element.setAttribute(OUTPUT_PATH_ATTR, `${FRAGMENT_BASE}${fragment.slug}`);
}

/* ------------------------------------------------------------------------ */
/* press-content (fairs & events, media library, studies, press contacts)   */
/* ------------------------------------------------------------------------ */
// Selectors (CES 2025 capture migration-work/cleaned.html + live press-content samples):
//   banner         main > .c-heroteaser.c-heroteaser--small
//   rich text      .c-media__text.s-richtext p
//   date           .c-news-detail__date (when shown)
//   contact cards  (a) <div class="c-contact has-bg"><div class="u-text-h4">Contact</div>
//                        <div class="c-contact__content" itemscope>picture img, p > strong (name),
//                        div.description p (role), ul.c-contact__list a[href^=tel:|mailto:]
//                  (b) <div class="c-contact"><div itemscope><div class="row mb-6">
//                        <div class="col-md-6 col-lg-4"><picture><img></picture></div>
//                        <div class="col-md-6 col-lg-8"><p><strong>Name</strong></p><p class="jobTitle">
//                        ...<ul class="c-contact__list"> - one div per person, N persons per card
//                        (CES accordion, corporate-communications, results-q1-2026)

const CONTENT_TEMPLATE_NAME = 'press-content';
const CONTACT_DONE_ATTR = 'data-excat-contact';

// Existing contact fragments: content/en/press/fragments/contacts/*.plain.html
const CONTACT_FRAGMENT_SLUGS = new Set([
  'alena-liebram', 'allison-zora', 'anna-hohne', 'annette-rojas', 'anthony-digiacobbe',
  'ashok-vedanayagam', 'carina-schulte-van-bentheim', 'christopher-schrecke',
  'continental-presse-tires-emea', 'henry-schniewind', 'ildiko-kovacs', 'ilona-tzudnowski',
  'jennifer-weyrich', 'julia-reinhold', 'kamini-kulshreshtha-saxena', 'katharina-buhmann',
  'kelsey-rollet', 'kim-jeannette-neubauer', 'laura-averbeck', 'linlin-zhao',
  'louis-alexis-luchtenberg', 'marc-siedler', 'marie-mehlil', 'mary-ann-kotlarich',
  'matthias-krempl', 'melina-kostmann', 'nicole-gottlicher', 'oliver-heil', 'pallavi-kapoor',
  'patrick-erdmann', 'paul-flake', 'ragen-steele', 'sarah-steingrube', 'sebastian-fillenberg',
  'sebastien-bonset', 'silke-bernhardt', 'soren-pinkow', 'stefan-jenzowski',
  'thiiban-thuraiveloo', 'valerie-libercka', 'vincent-charles', 'wolfgang-reinert', 'yanni-chen',
]);

function imageSrc(img) {
  if (!img) return '';
  const src = [img.getAttribute('data-src'), img.getAttribute('src')]
    .find((s) => s && !s.startsWith('data:'));
  return src || '';
}

// Person blocks inside one .c-contact card (variant a: .c-contact__content; variant b: child divs).
function getContactPersons(card) {
  const persons = [...card.querySelectorAll('.c-contact__content')];
  if (persons.length) return persons;
  const children = [...card.children].filter((c) => !c.matches('.u-text-h4') && c.querySelector('strong'));
  return children.length ? children : [card];
}

// Inline default content for a person without an existing fragment.
function buildInlineContact(doc, person, name) {
  const nodes = [];
  const src = imageSrc(person.querySelector('picture img, img'));
  if (src) {
    const img = doc.createElement('img');
    img.setAttribute('src', src);
    img.setAttribute('alt', name);
    nodes.push(makeParagraph(doc, img));
  }
  const strong = doc.createElement('strong');
  strong.textContent = name;
  nodes.push(makeParagraph(doc, strong));

  const roleEls = [...person.querySelectorAll('p.jobTitle, .description p')].filter((p) => text(p));
  roleEls.forEach((roleEl) => {
    const p = doc.createElement('p');
    roleEl.childNodes.forEach((n) => {
      if (n.nodeType === 1 && n.tagName === 'BR') p.append(doc.createElement('br'));
      else p.append(doc.createTextNode(n.textContent.replace(/\s+/g, ' ')));
    });
    nodes.push(p);
  });

  person.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]').forEach((link) => {
    const a = doc.createElement('a');
    a.setAttribute('href', link.getAttribute('href').trim());
    a.textContent = text(link) || link.getAttribute('href').replace(/^(tel|mailto):/, '');
    nodes.push(makeParagraph(doc, a));
  });
  return nodes;
}

// Every .c-contact on the page: fragment link when the fragment exists, inline card otherwise.
// Runs in beforeTransform so block parsers (accordion-lined in the CES contacts accordion)
// pick up clean default content. The .c-contact wrapper is kept (marked done) so block
// selectors excluding :has(.c-contact) keep their meaning.
function processContentContacts(element) {
  const doc = element.ownerDocument || document;
  element.querySelectorAll(`.c-contact:not([${CONTACT_DONE_ATTR}])`).forEach((card) => {
    const nodes = [];
    const heading = text(card.querySelector(':scope > .u-text-h4'));
    if (heading) {
      const h3 = doc.createElement('h3');
      h3.textContent = heading;
      nodes.push(h3);
    }
    getContactPersons(card).forEach((person) => {
      const name = text(person.querySelector('p > strong') || person.querySelector('strong'));
      if (!name) return;
      const slug = slugify(name);
      if (slug && CONTACT_FRAGMENT_SLUGS.has(slug)) {
        const path = `${FRAGMENT_BASE}${slug}`;
        const link = doc.createElement('a');
        link.setAttribute('href', path);
        link.textContent = path;
        nodes.push(makeParagraph(doc, link));
      } else {
        nodes.push(...buildInlineContact(doc, person, name));
      }
    });
    if (!nodes.length) return;
    card.replaceChildren(...nodes);
    card.setAttribute(CONTACT_DONE_ATTR, '');
  });
}

function readContentMetadata(element) {
  const doc = element.ownerDocument || document;
  const main = element.querySelector('main') || element;

  // title: og:title -> first h1 -> <title>, without " - Continental AG"
  const title = stripSiteSuffix(getMeta(doc, 'og:title') || text(main.querySelector('h1')) || doc.title);

  // description: meta description -> first rich-text paragraph (<= 160 chars)
  let description = getMeta(doc, 'description');
  if (!description) {
    const para = [...main.querySelectorAll('.c-media__text p, .s-richtext p')]
      .find((p) => !p.closest('.c-contact, .o-accordion, .c-teaser, .c-heroteaser, .c-heroteaser-fixed')
        && !/\bu-text-h\d\b/.test(p.className || '') && text(p).length >= 20);
    if (para) description = truncate(text(para), 160);
  }

  // image: og:image (the generic HeaderDefaults image is dropped by continental-cleanup)
  let image = getMeta(doc, 'og:image');
  if (/\/HeaderDefaults\//.test(image)) image = '';

  // publication-date: only a date shown on the page (meta[name=date] is last-modified)
  const publicationDate = parseDate(text(main.querySelector('.c-news-detail__date')));

  return {
    title,
    description,
    image,
    'publication-date': publicationDate,
    template: CONTENT_TEMPLATE_NAME,
  };
}

function appendMetadataBlock(element, data) {
  const doc = element.ownerDocument || document;
  const cells = {};
  Object.entries(data).forEach(([key, value]) => {
    if (!value) return;
    if (key === 'image') {
      const img = doc.createElement('img');
      img.setAttribute('src', value);
      cells[key] = img;
    } else {
      cells[key] = value;
    }
  });
  const main = element.querySelector('main') || element;
  main.append(WebImporter.Blocks.createBlock(doc, { name: 'Metadata', cells }));
}

export default function transform(hookName, element, payload) {
  const template = payload && payload.template;
  if (template && template.name === CONTACT_TEMPLATE_NAME) {
    if (hookName === 'afterTransform') renderContactFragment(element, payload);
    return;
  }
  if (template && template.name === CONTENT_TEMPLATE_NAME) {
    const doc = element.ownerDocument || document;
    if (hookName === 'beforeTransform') {
      const data = readContentMetadata(element);
      if (store) store.set(doc, data);
      lastData = data;
      processContentContacts(element);
    }
    if (hookName === 'afterTransform') {
      const data = (store && store.get(doc)) || lastData || readContentMetadata(element);
      processContentContacts(element); // cards a parser re-created from source markup
      element.querySelectorAll(`[${CONTACT_DONE_ATTR}]`).forEach((el) => el.removeAttribute(CONTACT_DONE_ATTR));
      appendMetadataBlock(element, data);
      if (store) store.delete(doc);
      lastData = null;
    }
    return;
  }
  if (!template || template.name !== TEMPLATE_NAME) return;
  const doc = element.ownerDocument || document;

  if (hookName === 'beforeTransform') {
    const data = readMetadata(element, payload);
    if (store) store.set(doc, data);
    lastData = data;
  }

  if (hookName === 'afterTransform') {
    const data = (store && store.get(doc)) || lastData || readMetadata(element, payload);

    // Breadcrumb (code-generated in EDS) and its wrapper container
    element.querySelectorAll('nav.c-breadcrumb').forEach((nav) => {
      const wrapper = nav.closest('.o-container');
      if (wrapper && text(wrapper) === text(nav)) wrapper.remove();
      else nav.remove();
    });

    // Eyebrow line (standard "Press Release <date>" or custom): template-rendered from metadata
    const eyebrowEl = getEyebrowEl(getArticleColumn(element));
    if (eyebrowEl) eyebrowEl.remove();

    processContacts(element);

    // Metadata block at the end of <main>
    const cells = {};
    Object.entries(data).forEach(([key, value]) => {
      if (!value) return;
      if (key === 'image') {
        const img = doc.createElement('img');
        img.setAttribute('src', value);
        cells[key] = img;
      } else {
        cells[key] = value;
      }
    });
    const main = element.querySelector('main') || element;
    main.append(WebImporter.Blocks.createBlock(doc, { name: 'Metadata', cells }));

    if (store) store.delete(doc);
    lastData = null;
  }
}
