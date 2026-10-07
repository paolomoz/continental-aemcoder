/* eslint-disable */
/* global WebImporter */
/**
 * Parser for columns-video. Base: columns.
 * Source: https://www.continental.com/en/ (.o-container.is-pastel-yellow row with AC video player + text),
 *         https://www.continental.com/en/press/fairs-events/ces-2025/ (text column left, video right)
 * Generated: 2026-10-06
 *
 * Output: one row, two columns, in source column order (the video may be in either column):
 *   media cell: poster image, video link, caption (title / "© Continental AG")
 *   text cell:  CE heading(s) + rich text paragraphs with their links
 *
 * Video reference: the AdmiralCloud media UUID, read from the inline AcPlayer init
 * script (`link: '<uuid>'`), the rendered player's `poster` attribute or the
 * .vjs-poster background. With a UUID:
 *   poster https://images.admiralcloud.com/v5/deliverEmbed/{uuid}/image/1280
 *   link   https://video.continental.com/?v={uuid}  (click-to-play in the block)
 * Without a UUID (fallback, previous behaviour): the poster <img> found in the player
 * and a link to the video/media page (a link in the media area, else a media-library /
 * video link in the text column, else the Tires Garage page).
 *
 * Rows with a single column (video + text stacked in one CE, e.g. Tires Garage
 * episode pages) are not two-column layouts: they are left for video-poster.
 * Eyebrow/heading live in .o-container__header (outside the matched row) as default content.
 */
const FALLBACK_VIDEO_PAGE = '/en/press/media-library/the-continental-tires-garage/';
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function findVideoUuid(scope) {
  const scripts = [...scope.querySelectorAll('script')].map((s) => s.textContent).join(' ');
  let m = scripts.match(/link:\s*['"]([0-9a-f-]{36})['"]/i);
  if (m) return m[1];
  const posterEl = scope.querySelector('[poster*="admiralcloud"]');
  const bgEl = scope.querySelector('.vjs-poster[style*="admiralcloud"]');
  const imgEl = scope.querySelector('img[src*="admiralcloud"]');
  const raw = [
    posterEl && posterEl.getAttribute('poster'),
    bgEl && bgEl.getAttribute('style'),
    imgEl && imgEl.getAttribute('src'),
  ].filter(Boolean).join(' ').replace(/&quot;/g, '');
  m = raw.match(/deliverEmbed\/([0-9a-f-]{36})\//i);
  if (m) return m[1];
  const dataEl = scope.querySelector('[data-ac-link], [data-link], [data-video-id]');
  const dataVal = dataEl && (dataEl.getAttribute('data-ac-link') || dataEl.getAttribute('data-link') || dataEl.getAttribute('data-video-id'));
  m = (dataVal || '').match(UUID_RE);
  return m ? m[0] : '';
}

export default function parse(element, { document }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // a single-column row is not a columns layout: leave it to video-poster
  const columns = [...element.children].filter((c) => clean(c.textContent) || c.querySelector('img, iframe, video, script'));
  if (element.matches('.row') && columns.length < 2) return;

  // --- media ---
  const media = element.querySelector('.c-media__embed.is-video, .c-media__gallery, figure.c-image');
  const scope = media || element;
  const posterImg = scope.querySelector('.vjs-poster img, img[src*="admiralcloud"], figure img:not([src^="data:"])');
  const mediaCol = media ? (columns.find((c) => c.contains(media)) || null) : null;
  // text: the .c-media__text outside the media column (either side), else any
  const textBox = [...element.querySelectorAll('.c-media__text')].find((t) => !mediaCol || !mediaCol.contains(t))
    || element.querySelector('.c-media__text');
  const textCol = textBox ? (columns.find((c) => c.contains(textBox)) || null) : null;

  const uuid = findVideoUuid(scope);

  let posterSrc = '';
  if (uuid) {
    posterSrc = `https://images.admiralcloud.com/v5/deliverEmbed/${uuid}/image/1280`;
  } else {
    posterSrc = posterImg ? posterImg.getAttribute('src') : '';
  }

  // caption: title span (filled at runtime) + copyright
  const captionScope = media ? media.closest('figure') || media : element;
  const figcaption = captionScope.querySelector('figcaption');
  let title = '';
  let copyright = '';
  if (figcaption) {
    const creator = figcaption.querySelector('.c-image__creator');
    copyright = clean(creator ? creator.textContent : '');
    const clone = figcaption.cloneNode(true);
    clone.querySelectorAll('.c-image__creator').forEach((n) => n.remove());
    title = clean(clone.textContent);
  } else {
    const creator = captionScope.querySelector('.c-image__creator');
    copyright = clean(creator ? creator.textContent : '');
  }

  const mediaCell = [];
  if (posterSrc) {
    const img = document.createElement('img');
    img.src = posterSrc;
    img.alt = title || (posterImg && posterImg.getAttribute('alt')) || '';
    const p = document.createElement('p');
    p.append(img);
    mediaCell.push(p);
  }

  let videoHref;
  if (uuid) {
    videoHref = `https://video.continental.com/?v=${uuid}`;
  } else {
    // fallback: a link inside the media area, else a link in the text column, else the default page
    const mediaLink = media ? media.querySelector('a[href]:not([href^="blob:"]):not([href^="#"])') : null;
    const textLink = textBox ? textBox.querySelector('a[href*="/media-library/"], a[href*="video"]') : null;
    videoHref = (mediaLink && mediaLink.getAttribute('href'))
      || (textLink && textLink.getAttribute('href'))
      || FALLBACK_VIDEO_PAGE;
  }
  const linkP = document.createElement('p');
  const videoLink = document.createElement('a');
  videoLink.href = videoHref;
  videoLink.textContent = title || clean(posterImg && posterImg.getAttribute('alt')) || 'Play video';
  linkP.append(videoLink);
  mediaCell.push(linkP);

  [title, copyright].filter(Boolean).forEach((t) => {
    const p = document.createElement('p');
    p.textContent = t;
    mediaCell.push(p);
  });

  // --- text: CE heading(s) in the text column + rich text ---
  const textCell = [];
  if (textCol && textCol !== mediaCol) {
    textCol.querySelectorAll('header.c-media__header h1, header.c-media__header h2, header.c-media__header h3, header.c-media__header h4, header.c-media__header h5, header.c-media__header h6')
      .forEach((h) => {
        const nh = document.createElement(h.tagName.toLowerCase());
        nh.textContent = clean(h.textContent);
        if (nh.textContent) textCell.push(nh);
      });
  }
  if (textBox) {
    const blocks = [...textBox.children].filter((el) => clean(el.textContent));
    blocks.forEach((el) => {
      const clone = el.cloneNode(true);
      clone.removeAttribute('class');
      clone.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
      textCell.push(clone);
    });
  }

  if (!posterSrc && !textCell.length) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // source column order: text first when its column precedes the video column
  const textFirst = !!(textCol && mediaCol && textCol !== mediaCol
    && (textCol.compareDocumentPosition(mediaCol) & 4));
  const textValue = textCell.length ? textCell : '';
  const cells = [textFirst ? [textValue, mediaCell] : [mediaCell, textValue]];
  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-video', cells });
  element.replaceWith(block);
}
