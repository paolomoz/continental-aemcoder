/* eslint-disable */
/* global WebImporter */
/**
 * Parser for video-poster. Base: video (library convention: 1 column; the cell
 * holds the video link plus an optional poster image).
 * Source: https://www.continental.com/en/press/fairs-events/ces-2025/ (third column video),
 *         https://www.continental.com/en/press/media-library/the-continental-tires-garage/the-continental-tires-garage-episode-1/
 * Generated: 2026-10-06
 *
 * Instance: .c-media__embed.is-video (AdmiralCloud player)
 *   <figure class="c-image"><div data-ac-container="{ceId}"></div>
 *   <script>new AcPlayer({ ..., link: '{uuid}' })</script>
 *   <figcaption><span data-ac-description>{title}</span><div class="c-image__creator">© Continental AG</div></figcaption>
 * The media UUID comes from the init script (`link: '<uuid>'`), else from the
 * rendered player (`poster` attribute / .vjs-poster background / admiralcloud img).
 *
 * Output (one column):
 *   Row 1: poster image https://images.admiralcloud.com/v5/deliverEmbed/{uuid}/image/1280
 *          + link https://video.continental.com/?v={uuid} (text = video title, else "Play video")
 *   Row 2: caption / copyright paragraphs (title, "© Continental AG") when present
 * Videos sitting beside a text column are handled earlier by columns-video.
 */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function findVideoUuid(scope) {
  // 1. inline AcPlayer init script: link: '<uuid>'
  const scripts = [...scope.querySelectorAll('script')].map((s) => s.textContent).join(' ');
  let m = scripts.match(/link:\s*['"]([0-9a-f-]{36})['"]/i);
  if (m) return m[1];
  // 2. rendered player: poster attribute / .vjs-poster background / poster <img>
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
  // 3. data attributes carrying the embed id
  const dataEl = scope.querySelector('[data-ac-link], [data-link], [data-video-id]');
  const dataVal = dataEl && (dataEl.getAttribute('data-ac-link') || dataEl.getAttribute('data-link') || dataEl.getAttribute('data-video-id'));
  m = (dataVal || '').match(UUID_RE);
  return m ? m[0] : '';
}

export default function parse(element, { document }) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const figure = element.closest('figure') || element.querySelector('figure') || element;
  const uuid = findVideoUuid(element);

  // caption: title span (filled by the player at runtime) + copyright line
  const figcaption = figure.querySelector('figcaption') || element.querySelector('figcaption');
  let title = '';
  let copyright = '';
  if (figcaption) {
    const creator = figcaption.querySelector('.c-image__creator');
    copyright = clean(creator ? creator.textContent : '');
    const clone = figcaption.cloneNode(true);
    clone.querySelectorAll('.c-image__creator').forEach((n) => n.remove());
    title = clean(clone.textContent);
  }
  if (!title) {
    const vjsTitle = element.querySelector('.vjs-title, .vjs-dock-title, [class*="title"]:not(script)');
    title = clean(vjsTitle ? vjsTitle.textContent : '');
  }

  if (!uuid) {
    // no stable video reference: keep whatever readable content there is
    element.replaceWith(...[...element.childNodes].filter((n) => n.nodeName !== 'SCRIPT'));
    return;
  }

  const mediaCell = [];
  const img = document.createElement('img');
  img.src = `https://images.admiralcloud.com/v5/deliverEmbed/${uuid}/image/1280`;
  img.alt = title;
  const imgP = document.createElement('p');
  imgP.append(img);
  mediaCell.push(imgP);

  const linkP = document.createElement('p');
  const a = document.createElement('a');
  a.href = `https://video.continental.com/?v=${uuid}`;
  a.textContent = title || 'Play video';
  linkP.append(a);
  mediaCell.push(linkP);

  const cells = [[mediaCell]];
  const captionCell = [];
  [title, copyright].filter(Boolean).forEach((t) => {
    const p = document.createElement('p');
    p.textContent = t;
    captionCell.push(p);
  });
  if (captionCell.length) cells.push([captionCell]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'video-poster', cells });
  element.replaceWith(block);
}
