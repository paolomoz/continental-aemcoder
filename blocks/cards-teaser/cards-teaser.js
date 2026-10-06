import { createOptimizedPicture } from '../../scripts/aem.js';
import groupTabbedBlocks from '../../scripts/tab-group.js';
import setupScrollSlider from '../../scripts/scroll-slider.js';
import { createPlayIcon, isVideoLink, openVideoDialog } from '../../scripts/video-embed.js';

/*
 * Options (all optional; without any the block is the responsive 1/2/3-up teaser grid):
 * - two-up:  at most 2 teasers per row
 * - four-up: 4 teasers per row on desktop
 * - slider:  one horizontal scroll-snap row with previous/next buttons
 * - tabbed:  adjacent tabbed instances in one section share one tab bar, labelled by each
 *            block's heading row (or the heading directly before the block)
 * Cards whose link points to video.continental.com get a play overlay and open the
 * player in a dialog.
 */
const OPTION_CLASSES = ['two-up', 'four-up', 'slider', 'tabbed'];

const HEADING = /^H[1-6]$/;

/**
 * Pick the link that represents the whole teaser: the last link in the body
 * (the "Find out more" CTA), falling back to the first link in the card.
 */
function findPrimaryLink(li) {
  const body = li.querySelector('.cards-teaser-card-body');
  const links = body ? [...body.querySelectorAll('a[href]')] : [];
  return links[links.length - 1] || li.querySelector('a[href]');
}

/** A row holding only heading(s) and no image or link: the block heading (tab label). */
function isHeadingRow(row) {
  if (row.querySelector('picture, img, a[href]')) return false;
  const elements = [...row.children].flatMap((cell) => [...cell.children]);
  return elements.length > 0 && elements.every((el) => HEADING.test(el.tagName));
}

function decorateVideoCard(li, link, block) {
  li.classList.add('cards-teaser-card-video');
  const image = li.querySelector('.cards-teaser-card-image');
  if (image) image.append(createPlayIcon('cards-teaser-play'));
  const title = li.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim()
    || link.textContent.trim();
  link.addEventListener('click', (e) => {
    e.preventDefault();
    openVideoDialog(link.href, {
      title, parent: block, className: 'cards-teaser-video', returnFocus: link,
    });
  });
}

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  // group tabs first (synchronously), while every instance's heading is still in the DOM
  if (active.includes('tabbed')) {
    groupTabbedBlocks(block, {
      blockName: 'cards-teaser',
      precedingHeadings: true,
      // only a heading row labels the tab - card titles are headings too
      getHeading: (el) => {
        const row = el.querySelector(':scope > .cards-teaser-header')
          || (isHeadingRow(el.firstElementChild || el) ? el.firstElementChild : null);
        return row?.querySelector('h1, h2, h3, h4, h5, h6') || null;
      },
    });
  }

  let header = null;
  const rows = [...block.children];
  if (rows.length && isHeadingRow(rows[0])) {
    header = document.createElement('div');
    header.className = 'cards-teaser-header';
    [...rows[0].children].forEach((cell) => header.append(...cell.children));
    rows.shift();
  }

  const ul = document.createElement('ul');
  rows.forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-teaser-card';
    while (row.firstElementChild) li.append(row.firstElementChild);

    [...li.children].forEach((cell) => {
      const onlyPicture = cell.querySelector('picture') && !cell.textContent.trim();
      cell.className = onlyPicture ? 'cards-teaser-card-image' : 'cards-teaser-card-body';
    });

    // drop empty cells authors may leave behind
    li.querySelectorAll(':scope > div').forEach((cell) => {
      if (!cell.children.length && !cell.textContent.trim()) cell.remove();
    });
    if (!li.children.length) return;

    const link = findPrimaryLink(li);
    if (link) {
      // the CTA link stretches over the whole card (see CSS), making the teaser one click target
      li.classList.add('cards-teaser-card-linked');
      link.classList.add('cards-teaser-card-link');
      if (/\.pdf($|[?#])/i.test(link.getAttribute('href'))) link.classList.add('cards-teaser-link-download');
      if (isVideoLink(link.getAttribute('href'))) decorateVideoCard(li, link, block);
    }

    ul.append(li);
  });
  ul.dataset.count = ul.children.length;

  ul.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });

  block.replaceChildren(...(header ? [header] : []), ul);
  if (active.includes('slider')) setupScrollSlider(block, ul, { prefix: 'cards-teaser', label: 'Teasers' });
}
