/* eslint-disable */
/* global WebImporter */
/**
 * Parser for accordion-lined. Base: accordion (library convention: 2 columns,
 * one row per item = [title cell, content cell]).
 * Source: https://www.continental.com/en/press/fairs-events/ces-2025/ (contacts accordion,
 *         "Our Highlights" accordions in two sibling columns),
 *         https://www.continental.com/en/press/studies-publications/continental-mobility-studies/mobility-study-2024/
 * Generated: 2026-10-06
 *
 * Instance: .o-accordion > .o-accordion__item
 *   title  .o-accordion__header (text; the plus/minus icon span is dropped)
 *   panel  .o-accordion__content-inner (text-media CEs, contact cards, images, links)
 * Output: one row per item -> [title cell, panel content cell].
 *
 * Option two-column: when accordions sit in sibling columns of the same grid row
 * (.o-container__content > .row > .col-*), all of them are merged into ONE block,
 * left column items first, with option 'two-column'. The other accordions of the
 * row are removed from the DOM (so the import loop skips them) and their emptied
 * columns are dropped; other columns in the row (e.g. a download button) stay.
 *
 * Spokesperson cards (.c-contact) inside a panel: a link to
 * /en/press/fragments/contacts/{slug} when that fragment exists (slug list below
 * = content/en/press/fragments/contacts/*.plain.html), otherwise inline default
 * content (portrait, bold name, role, phone/email links). Cards already rewritten
 * by the continental-press-metadata transformer ([data-excat-contact]) are taken
 * as they are.
 *
 * Iteration is keyed on .o-accordion__item (a div, iteration-safe).
 */
const FRAGMENT_BASE = '/en/press/fragments/contacts/';
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
const MERGED_ATTR = 'data-accordion-merged';

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const absUrl = (u) => {
  if (!u) return '';
  if (/^(tel|mailto):/i.test(u)) return u.trim();
  try { return new URL(u, 'https://www.continental.com/').href; } catch (e) { return u; }
};
const slugify = (str) => (str || '')
  .replace(/ß/g, 'ss')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const para = (document, child) => {
  const p = document.createElement('p');
  if (typeof child === 'string') p.textContent = child;
  else if (child) p.append(child);
  return p;
};
const imgSrc = (img) => [img && img.getAttribute('data-src'), img && img.getAttribute('src')]
  .find((s) => s && !s.startsWith('data:')) || '';

/** One .c-contact card -> fragment links / inline person nodes. */
function contactNodes(card, document) {
  if (card.hasAttribute('data-excat-contact')) {
    // already rewritten by the transformer: clean default content
    return [...card.childNodes].filter((n) => n.nodeType === 1 || clean(n.textContent));
  }
  const nodes = [];
  const heading = clean(card.querySelector(':scope > .u-text-h4')?.textContent);
  if (heading) {
    const h3 = document.createElement('h3');
    h3.textContent = heading;
    nodes.push(h3);
  }
  let persons = [...card.querySelectorAll('.c-contact__content')];
  if (!persons.length) persons = [...card.querySelectorAll('[itemscope]')].filter((p) => p.querySelector('strong'));
  if (!persons.length) persons = [card];
  persons.forEach((person) => {
    const name = clean((person.querySelector('p > strong') || person.querySelector('strong'))?.textContent);
    if (!name) return;
    const slug = slugify(name);
    if (slug && CONTACT_FRAGMENT_SLUGS.has(slug)) {
      const a = document.createElement('a');
      a.href = `${FRAGMENT_BASE}${slug}`;
      a.textContent = `${FRAGMENT_BASE}${slug}`;
      nodes.push(para(document, a));
      return;
    }
    // inline: portrait, bold name, role, phone/email links
    const src = imgSrc(person.querySelector('picture img, img'));
    if (src) {
      const img = document.createElement('img');
      img.src = absUrl(src);
      img.alt = name;
      nodes.push(para(document, img));
    }
    const strong = document.createElement('strong');
    strong.textContent = name;
    nodes.push(para(document, strong));
    [...person.querySelectorAll('p.jobTitle, .description p')].filter((p) => clean(p.textContent)).forEach((roleEl) => {
      const p = document.createElement('p');
      roleEl.childNodes.forEach((n) => {
        if (n.nodeType === 1 && n.tagName === 'BR') p.append(document.createElement('br'));
        else p.append(document.createTextNode(n.textContent.replace(/\s+/g, ' ')));
      });
      nodes.push(p);
    });
    person.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]').forEach((link) => {
      const a = document.createElement('a');
      a.href = link.getAttribute('href').trim();
      a.textContent = clean(link.textContent) || link.getAttribute('href').replace(/^(tel|mailto):/, '');
      nodes.push(para(document, a));
    });
  });
  return nodes;
}

/** Panel content -> clean default content nodes. */
function panelNodes(panel, document) {
  const out = [];
  const walk = (node) => {
    [...node.children].forEach((el) => {
      if (el.matches('script, style, .c-image__tools, .c-scroll-hint, .c-image__lazyload-placeholder, .u-icon')) return;
      if (el.matches('.c-contact')) { out.push(...contactNodes(el, document)); return; }
      if (/^H[1-6]$/.test(el.tagName)) {
        const h = document.createElement(el.tagName.toLowerCase());
        h.textContent = clean(el.textContent);
        if (h.textContent) out.push(h);
        return;
      }
      if (el.matches('figure, picture')) {
        const img = el.querySelector('img.c-image__embed-item') || el.querySelector('img');
        const src = imgSrc(img);
        if (src) {
          const i = document.createElement('img');
          i.src = absUrl(src);
          i.alt = img.getAttribute('alt') || '';
          out.push(para(document, i));
        }
        const cap = clean(el.querySelector('figcaption')?.textContent);
        if (cap) out.push(para(document, cap));
        return;
      }
      if (el.matches('.c-media__text, .s-richtext')) {
        [...el.children].forEach((child) => {
          if (!clean(child.textContent) && !child.querySelector('img')) return;
          const c = child.cloneNode(true);
          c.querySelectorAll('i.u-icon, svg, script').forEach((n) => n.remove());
          c.querySelectorAll('strong, b, em, i, span').forEach((n) => { if (!n.textContent.trim() && !n.querySelector('img')) n.remove(); });
          c.querySelectorAll('a[href]').forEach((a) => {
            a.setAttribute('href', absUrl(a.getAttribute('href')));
            a.removeAttribute('target');
            a.removeAttribute('rel');
          });
          c.removeAttribute('class');
          c.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
          out.push(c);
        });
        return;
      }
      if (el.matches('a[href]')) {
        const a = document.createElement('a');
        a.href = absUrl(el.getAttribute('href'));
        a.textContent = clean(el.textContent);
        if (a.textContent) out.push(para(document, a));
        return;
      }
      if (el.matches('p, ul, ol, table') && clean(el.textContent)) {
        const c = el.cloneNode(true);
        c.removeAttribute('class');
        c.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
        out.push(c);
        return;
      }
      walk(el);
    });
  };
  walk(panel);
  return out;
}

function itemRows(accordion, document) {
  const rows = [];
  [...accordion.querySelectorAll('.o-accordion__item')]
    .filter((item) => item.closest('.o-accordion') === accordion)
    .forEach((item) => {
      const header = item.querySelector('.o-accordion__header');
      let title = '';
      if (header) {
        const h = header.cloneNode(true);
        h.querySelectorAll('.u-icon, [data-accordion-icon]').forEach((n) => n.remove());
        title = clean(h.textContent);
      }
      const panel = item.querySelector('.o-accordion__content-inner') || item.querySelector('.o-accordion__content');
      const content = panel ? panelNodes(panel, document) : [];
      if (!title && !content.length) return;
      rows.push([title ? para(document, title) : '', content.length ? content : '']);
    });
  return rows;
}

export default function parse(element, { document }) {
  // merged into a sibling-column accordion block already: drop it
  if (element.hasAttribute(MERGED_ATTR)) {
    element.remove();
    return;
  }

  // accordions in sibling columns of the same grid row -> one two-column block
  const col = element.closest('.row > [class*="col"]');
  const row = col ? col.parentElement : null;
  let accordions = [element];
  if (row && row.closest('.o-container__content')) {
    const columnsWithAcc = [...row.children].filter((c) => c.querySelector('.o-accordion'));
    if (columnsWithAcc.length >= 2) {
      accordions = columnsWithAcc.flatMap((c) => [...c.querySelectorAll('.o-accordion')]
        .filter((a) => !a.parentElement.closest('.o-accordion')));
    }
  }
  const twoColumn = accordions.length >= 2 && accordions[0] === element;
  if (!twoColumn) accordions = [element];

  const cells = accordions.flatMap((acc) => itemRows(acc, document));
  if (!cells.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const name = twoColumn ? 'Accordion Lined (two-column)' : 'accordion-lined';
  const block = WebImporter.Blocks.createBlock(document, { name, cells });

  if (twoColumn) {
    accordions.slice(1).forEach((acc) => {
      const accCol = acc.closest('.row > [class*="col"]');
      acc.setAttribute(MERGED_ATTR, '');
      acc.remove();
      // drop the column when nothing but the accordion wrapper is left
      if (accCol && accCol !== col && !clean(accCol.textContent) && !accCol.querySelector('img, iframe')) accCol.remove();
    });
  }
  element.replaceWith(block);
}
