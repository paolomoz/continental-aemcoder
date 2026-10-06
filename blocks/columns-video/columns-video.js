import { createOptimizedPicture } from '../../scripts/aem.js';
import { bindClickToPlay, createPlayIcon, isVideoLink } from '../../scripts/video-embed.js';

const OPTION_CLASSES = [];

/** Removes a folded-in link, and its paragraph when the link was all it held. */
function removeLink(link) {
  if (!link.isConnected) return;
  const linkBlock = link.closest('p');
  if (linkBlock && linkBlock.textContent.trim() === link.textContent.trim()) linkBlock.remove();
  else link.remove();
}

/** Accessible title: link title, else the caption (minus the copyright line), else link text. */
function videoTitle(link, captionNodes) {
  const caption = captionNodes.map((el) => el.textContent.trim())
    .find((text) => text && !/^(©|\(c\))/i.test(text));
  const text = link.textContent.trim();
  // decorateButtons copies the link text into title; only a distinct title is meaningful
  const ownTitle = link.title && link.title !== text ? link.title : '';
  return ownTitle || caption || (/^https?:/i.test(text) ? '' : text) || 'Video';
}

/**
 * Turn the media column into a video poster: poster picture, a play affordance, the caption below.
 * - a video.continental.com link (in either column) makes the poster a click-to-play button
 *   that swaps in the player iframe (nothing third-party loads before the click)
 * - any other link (e.g. the video/media page) wraps the poster as a plain link (fallback)
 * @param {Element} col
 * @param {Element} row
 */
function decorateMediaColumn(col, row) {
  col.classList.add('columns-video-media');
  const picture = col.querySelector('picture');
  const videoLink = [...row.querySelectorAll('a[href]')].find((a) => isVideoLink(a.getAttribute('href')));
  const link = videoLink
    || [...col.querySelectorAll('a[href]')].find((a) => !a.contains(picture))
    || col.querySelector('a[href]');

  const img = picture.querySelector('img');
  const optimized = createOptimizedPicture(img.src, img.alt, false, [{ media: '(min-width: 900px)', width: '800' }, { width: '600' }]);
  // replace the picture's paragraph only when it holds nothing else (e.g. a caption)
  const pictureP = picture.closest('p');
  const pictureBlock = pictureP && !pictureP.textContent.trim() ? pictureP : picture;

  let posterTag = 'div';
  if (videoLink) posterTag = 'button';
  else if (link) posterTag = 'a';
  const poster = document.createElement(posterTag);
  poster.className = 'columns-video-poster';
  poster.append(optimized);
  // insert the poster first so it survives if the picture and link share a paragraph
  pictureBlock.replaceWith(poster);
  // a picture sharing its paragraph with the caption: lift the poster out to the column
  if (poster.parentElement !== col) col.prepend(poster);

  if (link) {
    if (videoLink) poster.type = 'button';
    else {
      poster.href = link.href;
      if (link.target) poster.target = link.target;
    }
    poster.append(createPlayIcon('columns-video-play'));
    // the authored link is folded into the poster; drop it (and its now-empty paragraph)
    if (!videoLink || videoLink.closest('p')?.textContent.trim() === videoLink.textContent.trim()) {
      removeLink(link);
    }
  }

  // remaining text in the media column is the caption (e.g. "(c) Continental AG")
  const captionNodes = [...col.children].filter((el) => el !== poster && el.textContent.trim());
  if (captionNodes.length) {
    const caption = document.createElement('div');
    caption.className = 'columns-video-caption';
    caption.append(...captionNodes);
    col.append(caption);
  }
  // clean up empty leftovers
  [...col.children].forEach((el) => {
    if (el !== poster && !el.textContent.trim() && !el.querySelector('picture')) el.remove();
  });

  if (link) {
    const title = videoTitle(link, captionNodes);
    poster.setAttribute('aria-label', videoLink ? `Play video: ${title}` : (link.title || link.textContent.trim() || 'Play video'));
    if (videoLink) {
      bindClickToPlay(poster, videoLink.href, { title, frameClass: 'columns-video-frame' });
    }
  }
}

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  [...block.children].forEach((row) => {
    row.classList.add('columns-video-row');
    const cols = [...row.children];
    cols.forEach((col) => {
      if (!col.textContent.trim() && !col.querySelector('picture')) {
        col.remove();
        return;
      }
      if (col.querySelector('picture')) decorateMediaColumn(col, row);
      else col.classList.add('columns-video-text');
    });
    const count = row.children.length;
    row.classList.add(`columns-video-${count}-cols`);
  });
}
