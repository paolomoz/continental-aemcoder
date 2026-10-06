const OPTION_CLASSES = [];

const DEFAULT_SRC = 'https://charts3.equitystory.com/teaser-t1/continental-ag-v31/English/';
const ALLOWED_HOST = /(^|\.)equitystory\.com$/i;

/**
 * Resolve the chart iframe source from the authored links.
 * Authors may link the equitystory chart directly, link a /widgets/share-price.html
 * placeholder, or omit the link entirely - the latter two fall back to DEFAULT_SRC.
 * @param {HTMLAnchorElement[]} links
 * @returns {{ src: string, sourceLink: HTMLAnchorElement | null }}
 */
function resolveSource(links) {
  const chartLink = links.find((a) => {
    try {
      return ALLOWED_HOST.test(new URL(a.href).hostname);
    } catch {
      return false;
    }
  });
  if (chartLink) return { src: chartLink.href, sourceLink: chartLink };

  const placeholder = links.find((a) => {
    try {
      return new URL(a.href, window.location.href).pathname.startsWith('/widgets/');
    } catch {
      return false;
    }
  });
  return { src: DEFAULT_SRC, sourceLink: placeholder || null };
}

function loadIframe(frame, src) {
  if (frame.querySelector('iframe')) return;
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.title = 'Continental share price chart';
  iframe.loading = 'lazy';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  frame.append(iframe);
  frame.classList.add('is-loaded');
}

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  const links = [...block.querySelectorAll('a[href]')];
  const { src, sourceLink } = resolveSource(links);

  // remove the source link (and its wrapper paragraph when it held nothing else)
  if (sourceLink) {
    // a /widgets/ link is auto-blocked by scripts.js into a nested widget div; drop that shell too
    const autoBlock = [...block.querySelectorAll('div')].find(
      (d) => d.classList.contains('widget') && d.contains(sourceLink),
    );
    if (autoBlock) {
      autoBlock.remove();
    }
    const wrapper = autoBlock ? null : sourceLink.closest('p, li');
    if (wrapper && wrapper.textContent.trim() === sourceLink.textContent.trim()) wrapper.remove();
    else if (!autoBlock) sourceLink.remove();
  }

  // everything authored besides the source link becomes the CTA area (e.g. "Share Price Chart")
  const cta = document.createElement('div');
  cta.className = 'widget-share-price-cta';
  [...block.querySelectorAll(':scope > div > div')].forEach((cell) => {
    cta.append(...cell.childNodes);
  });

  const frame = document.createElement('div');
  frame.className = 'widget-share-price-frame';

  block.replaceChildren(frame);
  if (cta.textContent.trim()) block.append(cta);

  // lazy-load the third-party iframe only when the block approaches the viewport
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        loadIframe(frame, src);
      }
    }, { rootMargin: '200px' });
    observer.observe(block);
  } else {
    loadIframe(frame, src);
  }
}
