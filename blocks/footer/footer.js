// media query match that indicates desktop width
const isDesktop = window.matchMedia('(width >= 900px)');

const EXTERNAL_ICON = '<svg class="footer-external-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
const CHEVRON = '<svg class="footer-chevron" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.5" d="m5 9 7 7 7-7"/></svg>';

/**
 * Fetches the footer fragment (metadata-independent): local content folder first, then site root.
 * @returns {Promise<HTMLElement|null>}
 */
async function fetchFooter() {
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) resp = await fetch('/footer.plain.html');
  if (!resp.ok) return null;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = await resp.text();
  return wrapper;
}

/**
 * Resolves relative image paths in the fragment against the fragment location.
 * @param {Element} root
 */
function fixImagePaths(root) {
  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (/^(https?:)?\/\//.test(src) || src.startsWith('/')) return;
    const base = window.location.pathname.startsWith('/content/') ? '/content/' : '/';
    img.src = `${base}${src.replace(/^\.\//, '')}`;
  });
}

/**
 * Links to other hosts open in a new tab and get an external-link icon.
 * @param {Element} root
 */
function decorateExternalLinks(root) {
  root.querySelectorAll('a[href]').forEach((a) => {
    let url;
    try {
      url = new URL(a.getAttribute('href'), window.location.href);
    } catch {
      return;
    }
    if (url.origin === window.location.origin || !/^https?:$/.test(url.protocol)) return;
    a.target = '_blank';
    a.rel = 'noopener';
    if (!a.closest('.footer-social')) a.insertAdjacentHTML('beforeend', EXTERNAL_ICON);
  });
}

/**
 * Turns the columns section (h2 + list pairs) into columns that collapse into
 * accordions on mobile.
 * @param {Element} section
 */
function buildColumns(section) {
  const columns = document.createElement('div');
  columns.className = 'footer-columns';
  [...section.querySelectorAll(':scope > h2')].forEach((h2, i) => {
    const column = document.createElement('div');
    column.className = 'footer-column';
    const list = h2.nextElementSibling && h2.nextElementSibling.tagName === 'UL' ? h2.nextElementSibling : document.createElement('ul');
    list.id = `footer-column-${i}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'footer-column-toggle';
    button.setAttribute('aria-controls', list.id);
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = `<span>${h2.textContent.trim()}</span>${CHEVRON}`;
    h2.replaceChildren(button);
    button.addEventListener('click', () => {
      if (isDesktop.matches) return;
      button.setAttribute('aria-expanded', button.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
    });
    column.append(h2, list);
    columns.append(column);
  });
  return columns;
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const fragment = await fetchFooter();
  block.textContent = '';
  if (!fragment) return;
  fixImagePaths(fragment);

  const [socialSection, columnsSection, legalSection] = [...fragment.children];
  const footer = document.createElement('div');
  footer.className = 'footer-inner';

  if (socialSection) {
    const social = document.createElement('div');
    social.className = 'footer-social';
    social.append(...socialSection.childNodes);
    social.querySelectorAll('a').forEach((a) => {
      a.setAttribute('aria-label', a.textContent.trim());
      const label = document.createElement('span');
      label.className = 'footer-social-label';
      [...a.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .forEach((n) => label.append(n));
      a.append(label);
    });
    block.append(social);
  }
  if (columnsSection) footer.append(buildColumns(columnsSection));
  if (legalSection) {
    const legal = document.createElement('div');
    legal.className = 'footer-copyright';
    legal.append(...legalSection.childNodes);
    footer.append(legal);
  }
  decorateExternalLinks(block);
  decorateExternalLinks(footer);
  block.append(footer);
}
