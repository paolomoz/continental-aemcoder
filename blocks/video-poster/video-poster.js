import { createOptimizedPicture } from '../../scripts/aem.js';
import { bindClickToPlay, createPlayIcon, isVideoLink } from '../../scripts/video-embed.js';

const OPTION_CLASSES = [];

const isEmpty = (el) => !el.querySelector('picture, img') && !el.textContent.trim();

/** Removes an element and any wrappers (<p>, <a>) it leaves empty, up to the cell. */
function detach(el) {
  let parent = el.parentElement;
  el.remove();
  while (parent && parent.tagName !== 'DIV' && isEmpty(parent)) {
    const next = parent.parentElement;
    parent.remove();
    parent = next;
  }
}

/** Accessible title: link title, else the caption (minus the copyright line), else link text. */
function videoTitle(link, captionNodes) {
  const caption = captionNodes.map((el) => el.textContent.trim())
    .find((text) => text && !/^(©|\(c\))/i.test(text));
  const text = link?.textContent.trim() || '';
  // decorateButtons copies the link text into title; only a distinct title is meaningful
  const ownTitle = link?.title && link.title !== text ? link.title : '';
  return ownTitle || caption || (/^https?:/i.test(text) ? '' : text) || 'Video';
}

/**
 * Video poster: poster image + link to https://video.continental.com/?v={uuid} + optional caption,
 * in any rows/cells. The poster shows a play button; a click swaps in the player iframe.
 * Nothing third-party loads before the click. A link that is not a Continental video
 * (e.g. a media page) keeps the poster as a plain link.
 */
export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  const links = [...block.querySelectorAll('a[href]')];
  const videoLink = links.find((a) => isVideoLink(a.getAttribute('href')));
  const link = videoLink || links[0] || null;
  const href = link?.href || '';

  const picture = block.querySelector('picture');
  const img = picture?.querySelector('img');
  let optimized = null;
  if (img) {
    optimized = createOptimizedPicture(img.src, img.alt, false, [
      { media: '(min-width: 900px)', width: '1600' },
      { width: '900' },
    ]);
    detach(picture);
  }

  // the link is folded into the poster; drop it with its paragraph when it stands alone
  if (link) {
    const p = link.closest('p');
    if (p && p.textContent.trim() === link.textContent.trim()) detach(p);
    else if (!link.textContent.trim() || /^https?:/i.test(link.textContent.trim())) detach(link);
  }

  // everything left, in authored order, is the caption
  const captionNodes = [];
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => {
      if (isEmpty(cell)) return;
      if (cell.children.length) {
        captionNodes.push(...[...cell.children].filter((el) => !isEmpty(el)));
      } else {
        const p = document.createElement('p');
        p.textContent = cell.textContent.trim();
        captionNodes.push(p);
      }
    });
  });

  const title = videoTitle(link, captionNodes);
  const media = document.createElement('div');
  media.className = 'video-poster-media';

  let posterTag = 'div';
  if (videoLink) posterTag = 'button';
  else if (link) posterTag = 'a';
  const poster = document.createElement(posterTag);
  poster.className = 'video-poster-poster';
  if (optimized) poster.append(optimized);
  else poster.classList.add('video-poster-no-image');

  if (videoLink) {
    poster.type = 'button';
    poster.setAttribute('aria-label', `Play video: ${title}`);
    poster.append(createPlayIcon('video-poster-play'));
    bindClickToPlay(poster, href, { title, frameClass: 'video-poster-frame' });
  } else if (link) {
    poster.href = href;
    if (link.target) poster.target = link.target;
    poster.setAttribute('aria-label', title === 'Video' ? 'Play video' : title);
    poster.append(createPlayIcon('video-poster-play'));
  }
  media.append(poster);

  const nodes = [media];
  if (captionNodes.length) {
    const caption = document.createElement('div');
    caption.className = 'video-poster-caption';
    caption.append(...captionNodes);
    nodes.push(caption);
  }
  block.replaceChildren(...nodes);
}
