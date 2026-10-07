import { createOptimizedPicture } from '../../scripts/aem.js';

/*
 * Quote with portrait.
 * Row 1: portrait image | quote text. Row 2: attribution (bold name, role).
 * Cells may come in either order; a missing portrait or attribution is tolerated.
 * Without a second row, a trailing paragraph that starts with bold text (or with
 * a dash) in the quote cell is used as the attribution.
 */
const OPTION_CLASSES = [];

const isEmpty = (el) => !el.querySelector('picture, img') && !el.textContent.trim();

const asParagraphs = (cell) => {
  if (cell.children.length) return [...cell.children].filter((el) => !isEmpty(el));
  const p = document.createElement('p');
  p.textContent = cell.textContent.trim();
  return [p];
};

const looksLikeAttribution = (el) => el.tagName === 'P'
  && (el.firstElementChild?.tagName === 'STRONG' || /^[-–—]\s/.test(el.textContent.trim()));

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  const picture = block.querySelector('picture');
  const img = picture?.querySelector('img');

  const quoteNodes = [];
  const authorNodes = [];
  let quoteRowSeen = false;
  [...block.children].forEach((row) => {
    const textCells = [...row.children].filter((cell) => cell.textContent.trim());
    if (!textCells.length) return;
    const nodes = textCells.flatMap(asParagraphs);
    if (!quoteRowSeen) {
      quoteNodes.push(...nodes);
      quoteRowSeen = true;
    } else {
      authorNodes.push(...nodes);
    }
  });

  // single text row: split off a trailing attribution paragraph
  if (!authorNodes.length && quoteNodes.length > 1) {
    const last = quoteNodes[quoteNodes.length - 1];
    if (looksLikeAttribution(last)) authorNodes.push(quoteNodes.pop());
  }
  // pictures inside text cells are not quote content
  quoteNodes.forEach((el) => el.querySelectorAll('picture').forEach((pic) => pic.remove()));

  const figure = document.createElement('figure');
  figure.className = 'quote-portrait-figure';

  if (img) {
    const portrait = document.createElement('div');
    portrait.className = 'quote-portrait-image';
    portrait.append(createOptimizedPicture(img.src, img.alt, false, [{ width: '400' }]));
    figure.append(portrait);
  } else {
    block.classList.add('quote-portrait-no-image');
  }

  const content = document.createElement('div');
  content.className = 'quote-portrait-content';

  const quote = document.createElement('blockquote');
  quote.className = 'quote-portrait-text';
  quote.append(...quoteNodes.filter((el) => !isEmpty(el)));
  if (quote.children.length) content.append(quote);

  if (authorNodes.length) {
    const author = document.createElement('figcaption');
    author.className = 'quote-portrait-author';
    author.append(...authorNodes);
    content.append(author);
  }

  figure.append(content);
  block.replaceChildren(figure);
}
