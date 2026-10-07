/*
 * Shared previous/next controls for a horizontal scroll-snap track
 * (cards-teaser `slider`, cards-gallery `slider`).
 *
 * The block's CSS turns its list into a flex row with `overflow-x: auto` and
 * `scroll-snap-type`; this helper adds `{prefix}-slider-nav` with
 * `{prefix}-slider-prev` / `{prefix}-slider-next` buttons that scroll by one item,
 * disables them at either end and hides the nav when everything fits.
 */

/**
 * @param {Element} block element the nav is appended to
 * @param {Element} track scrollable list
 * @param {object} opts
 * @param {string} opts.prefix class prefix (the block name)
 * @param {string} [opts.label] accessible name of the track, e.g. 'Teasers'
 * @returns {HTMLElement} the nav element
 */
export default function setupScrollSlider(block, track, { prefix, label = 'Items' }) {
  const nav = document.createElement('div');
  nav.className = `${prefix}-slider-nav`;
  const makeButton = (dir, text) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${prefix}-slider-${dir}`;
    button.setAttribute('aria-label', text);
    nav.append(button);
    return button;
  };
  const prev = makeButton('prev', `Previous ${label.toLowerCase()}`);
  const next = makeButton('next', `Next ${label.toLowerCase()}`);

  const step = () => {
    const item = track.firstElementChild;
    if (!item) return track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return item.getBoundingClientRect().width + gap;
  };
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    nav.hidden = max <= 1;
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= max - 1;
  };

  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', update, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(track);

  // the track itself is keyboard scrollable
  track.tabIndex = 0;
  track.setAttribute('aria-label', label);
  block.append(nav);
  update();
  return nav;
}
