import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  buildBlock,
  getMetadata,
  readBlockConfig,
  toCamelCase,
  toClassName,
} from './aem.js';

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Turns `/widgets/...` links into widget blocks.
 * @param {Element} main The container element
 */
function buildWidgetAutoBlocks(main) {
  const widgetLinks = [...main.querySelectorAll('a[href*="/widgets/"]')];
  widgetLinks.forEach((link) => {
    if (link.closest('.widget')) return;
    const newLink = link.cloneNode(true);
    const widgetBlock = buildBlock('widget', { elems: [newLink] });
    const p = link.closest('p');
    if (
      p
      && p.querySelectorAll('a').length === 1
      && p.querySelector('a') === link
      && p.textContent.trim() === link.textContent.trim()
    ) {
      p.replaceWith(widgetBlock);
    } else {
      link.replaceWith(widgetBlock);
    }
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
    buildWidgetAutoBlocks(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Applies section metadata: `style` becomes section classes, `background-image`
 * becomes a `.section-background` picture, other keys become data attributes.
 * Runs after decorateSections and before decorateBlocks.
 * @param {Element} main The container element
 */
function decorateSectionMetadata(main) {
  main.querySelectorAll(':scope > .section > div > .section-metadata').forEach((meta) => {
    const section = meta.closest('.section');
    const config = readBlockConfig(meta);
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'style') {
        [value].flat().join(',').split(',')
          .map((s) => toClassName(s.trim()))
          .filter(Boolean)
          .forEach((cls) => section.classList.add(cls));
      } else if (key === 'background-image') {
        const picture = meta.querySelector('picture');
        if (picture) {
          const bg = document.createElement('div');
          bg.className = 'section-background';
          bg.append(picture);
          section.prepend(bg);
          section.classList.add('has-background');
        }
      } else {
        section.dataset[toCamelCase(key)] = [value].flat().join(',');
      }
    });
    const wrapper = meta.parentElement;
    meta.remove();
    if (!wrapper.children.length) wrapper.remove();
  });
}

/**
 * Press release template: breadcrumb + "Press Release | date" eyebrow above the title,
 * and a sidebar with a Latest News list (added when the article has none).
 * Runs after decorateSectionMetadata and before decorateBlocks.
 * @param {Element} main The container element
 */
function decoratePressRelease(main) {
  // only the page itself, not fragments (e.g. contact cards) decorated with decorateMain
  if (!document.body.classList.contains('press-release') || main !== document.querySelector('body > main')) return;
  const h1 = main.querySelector('h1');
  if (h1) {
    const crumbs = document.createElement('nav');
    crumbs.className = 'breadcrumb';
    crumbs.setAttribute('aria-label', 'Breadcrumb');
    const list = document.createElement('ol');
    [['Press', '/en/press/'], ['Press Releases', '/en/press/press-releases/']].forEach(([label, href]) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      li.append(a);
      list.append(li);
    });
    const current = document.createElement('li');
    current.setAttribute('aria-current', 'page');
    current.textContent = h1.textContent.trim();
    list.append(current);
    crumbs.append(list);

    const eyebrow = document.createElement('p');
    eyebrow.className = 'article-eyebrow';
    const label = document.createElement('span');
    label.textContent = getMetadata('eyebrow') || 'Press Release';
    eyebrow.append(label);
    const iso = getMetadata('publication-date');
    const date = iso ? new Date(`${iso}T00:00:00`) : null;
    if (date && !Number.isNaN(date.getTime())) {
      const time = document.createElement('time');
      time.dateTime = iso;
      time.textContent = date.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
      eyebrow.append(time);
    }
    h1.before(eyebrow);

    // the breadcrumb spans both columns, so it gets its own section after the banner
    const crumbSection = document.createElement('div');
    crumbSection.className = 'section breadcrumb-container';
    crumbSection.dataset.sectionStatus = 'initialized';
    crumbSection.style.display = 'none';
    const crumbWrapper = document.createElement('div');
    crumbWrapper.append(crumbs);
    crumbSection.append(crumbWrapper);
    const banner = main.querySelector(':scope > .section.banner');
    if (banner) banner.after(crumbSection);
    else main.prepend(crumbSection);
  }

  let sidebar = main.querySelector(':scope > .section.sidebar');
  if (!sidebar) {
    sidebar = document.createElement('div');
    sidebar.className = 'section sidebar';
    sidebar.dataset.sectionStatus = 'initialized';
    sidebar.style.display = 'none';
    main.append(sidebar);
  }
  if (!sidebar.querySelector('.cards-latest-news')) {
    const heading = document.createElement('h3');
    heading.textContent = 'Latest News';
    const allNews = document.createElement('a');
    allNews.href = '/en/press/press-releases/';
    allNews.textContent = 'All news';
    const wrapper = document.createElement('div');
    wrapper.append(buildBlock('cards-latest-news', [[heading], ['all-news', allNews]]));
    sidebar.append(wrapper);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateSectionMetadata(main);
  decoratePressRelease(main);
  decorateBlocks(main);
  decorateButtons(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('body > header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('body > footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  import('./consent-check.js');
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
