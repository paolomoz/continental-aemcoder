/*
 * Shared click-to-play helper for Continental (AdmiralCloud) videos.
 *
 * AdmiralCloud only streams to whitelisted referers, but the hosted player page
 * https://video.continental.com/?v={uuid} plays inside an iframe on any origin.
 * Blocks show a poster with a play button and only create the iframe on click,
 * so no third-party resource is requested before the visitor asks for the video.
 */

const PLAYER_ORIGIN = 'https://video.continental.com';
const PLAYER_HOSTS = ['video.continental.com', 'player.admiralcloud.com'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the AdmiralCloud video id of a player link, or null for any other link.
 * @param {string} href
 * @returns {string|null}
 */
export function getVideoId(href) {
  if (!href) return null;
  try {
    const url = new URL(href, window.location.href);
    if (!PLAYER_HOSTS.includes(url.hostname)) return null;
    const id = url.searchParams.get('v');
    return id && UUID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** True when the link points to a Continental video player page. */
export const isVideoLink = (href) => !!getVideoId(href);

/**
 * The canonical (iframe-able) player URL for a video link, or null.
 * @param {string} href
 * @returns {string|null}
 */
export function getEmbedUrl(href) {
  const id = getVideoId(href);
  return id ? `${PLAYER_ORIGIN}/?v=${encodeURIComponent(id)}` : null;
}

/**
 * Builds the player iframe (16:9, full width). Styles are inline so the iframe
 * renders the same in every block that uses it.
 * @param {string} href video link
 * @param {string} [title] accessible title, e.g. the caption
 * @returns {HTMLIFrameElement|null}
 */
export function createVideoIframe(href, title = '') {
  const src = getEmbedUrl(href);
  if (!src) return null;
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = title || 'Video';
  // `fullscreen` in allow grants fullscreen (allowfullscreen would only trigger a console warning)
  iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.style.cssText = 'display:block;width:100%;height:auto;aspect-ratio:16/9;border:0;';
  return iframe;
}

/**
 * Replaces `target` with the player iframe (wrapped in `frameClass`) and focuses it.
 * @param {Element} target element to replace (the poster)
 * @param {string} href video link
 * @param {object} [opts]
 * @param {string} [opts.title] accessible iframe title
 * @param {string} [opts.frameClass] class of the wrapper that replaces the poster
 * @returns {HTMLElement|null} the wrapper, or null when the link is not a video
 */
export function playInPlace(target, href, { title = '', frameClass = '' } = {}) {
  const iframe = createVideoIframe(href, title);
  if (!iframe) return null;
  const frame = document.createElement('div');
  if (frameClass) frame.className = frameClass;
  frame.append(iframe);
  target.replaceWith(frame);
  iframe.focus();
  return frame;
}

/**
 * Wires a trigger (button/link) so a click swaps `target` for the player iframe.
 * @param {Element} trigger clickable element
 * @param {string} href video link
 * @param {object} [opts] see playInPlace; `target` defaults to the trigger
 */
export function bindClickToPlay(trigger, href, opts = {}) {
  if (!isVideoLink(href)) return;
  const { target = trigger, ...rest } = opts;
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    playInPlace(target, href, rest);
  }, { once: true });
}

/**
 * Creates the decorative play icon element.
 * @param {string} className
 * @returns {HTMLSpanElement}
 */
export function createPlayIcon(className) {
  const play = document.createElement('span');
  play.className = className;
  play.setAttribute('aria-hidden', 'true');
  return play;
}

/**
 * Opens the video in a modal <dialog> (lightbox). The dialog is appended to
 * `parent` so the calling block can style it; it is removed again on close,
 * which also stops playback.
 * @param {string} href video link
 * @param {object} [opts]
 * @param {string} [opts.title] accessible title
 * @param {Element} [opts.parent] where to append the dialog (default: body)
 * @param {string} [opts.className] dialog class prefix, e.g. 'cards-teaser-video'
 * @param {Element} [opts.returnFocus] element to focus after closing
 * @returns {HTMLDialogElement|null}
 */
export function openVideoDialog(href, {
  title = '', parent = document.body, className = 'video-dialog', returnFocus = null,
} = {}) {
  const iframe = createVideoIframe(href, title);
  if (!iframe) return null;

  const dialog = document.createElement('dialog');
  dialog.className = `${className}-dialog`;
  if (title) dialog.setAttribute('aria-label', title);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = `${className}-close`;
  close.setAttribute('aria-label', 'Close video');
  close.addEventListener('click', () => dialog.close());

  const frame = document.createElement('div');
  frame.className = `${className}-frame`;
  frame.append(iframe);

  dialog.append(close, frame);
  // a click on the backdrop (outside the content) closes the dialog
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
  });

  parent.append(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  close.focus();
  return dialog;
}
