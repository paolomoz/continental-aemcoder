import { createOptimizedPicture } from '../../scripts/aem.js';
import setupScrollSlider from '../../scripts/scroll-slider.js';

/*
 * Options (optional; without any the block is the 1/2/3-up photo grid):
 * - four-up: 4 photos per row on desktop
 * - slider:  one horizontal scroll-snap row with previous/next buttons
 */
const OPTION_CLASSES = ['four-up', 'slider'];

const isEmpty = (el) => !el.querySelector('picture, img') && !el.textContent.trim();

/**
 * Strips the button decoration scripts.js may have applied to an authored link,
 * so the hi-res link renders as a plain caption link.
 */
function unbutton(a) {
  a.classList.remove('button', 'primary', 'secondary', 'accent');
  const p = a.closest('.button-wrapper, .button-container');
  if (p) p.classList.remove('button-wrapper', 'button-container');
}

/**
 * Removes the picture from its cell, dropping wrappers (<p>, <a>) it leaves empty.
 */
function detachPicture(picture) {
  let parent = picture.parentElement;
  picture.remove();
  while (parent && parent.tagName !== 'DIV' && isEmpty(parent)) {
    const next = parent.parentElement;
    parent.remove();
    parent = next;
  }
}

function buildItem(row) {
  const cells = [...row.children].filter((cell) => !isEmpty(cell));
  if (!cells.length) return null;

  const li = document.createElement('li');
  li.className = 'cards-gallery-item';
  const figure = document.createElement('figure');
  figure.className = 'cards-gallery-figure';

  // image: the first picture anywhere in the row (normally cell 1)
  const picture = row.querySelector('picture');
  const img = picture?.querySelector('img');
  let imageWrap;
  if (picture && img) {
    // an author may have linked the image directly to the original
    const imageLink = picture.closest('a[href]');
    const imageHref = imageLink?.getAttribute('href');
    detachPicture(picture);
    imageWrap = document.createElement('div');
    imageWrap.className = 'cards-gallery-image';
    imageWrap.append(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
    if (imageHref) imageWrap.dataset.href = imageHref;
    figure.append(imageWrap);
  }

  // caption: everything else in the row, in authored order
  const caption = document.createElement('figcaption');
  caption.className = 'cards-gallery-caption';
  cells.forEach((cell) => {
    if (isEmpty(cell)) return;
    if (cell.children.length) caption.append(...cell.childNodes);
    else {
      const p = document.createElement('p');
      p.textContent = cell.textContent.trim();
      caption.append(p);
    }
  });

  const links = [...caption.querySelectorAll('a[href]')];
  links.forEach((a) => {
    unbutton(a);
    a.classList.add('cards-gallery-link');
  });

  // hi-res original: the explicit image link, else the first caption link
  const hiRes = imageWrap?.dataset.href || links[0]?.getAttribute('href');
  if (imageWrap && hiRes) {
    const a = document.createElement('a');
    a.href = hiRes;
    a.className = 'cards-gallery-original';
    // the caption link is the accessible target; the image link is a pointer shortcut
    a.tabIndex = -1;
    a.setAttribute('aria-hidden', 'true');
    a.append(...imageWrap.childNodes);
    imageWrap.append(a);
    delete imageWrap.dataset.href;
  }
  links.forEach((a) => {
    if (a.getAttribute('href') === hiRes) a.classList.add('cards-gallery-download');
  });

  if (caption.childNodes.length) figure.append(caption);
  if (!figure.children.length) return null;
  li.append(figure);
  return li;
}

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = buildItem(row);
    if (li) ul.append(li);
  });
  ul.dataset.count = ul.children.length;

  block.replaceChildren(ul);
  if (active.includes('slider')) setupScrollSlider(block, ul, { prefix: 'cards-gallery', label: 'Photos' });
}
