// media query match that indicates desktop width
const isDesktop = window.matchMedia('(width >= 900px)');

const ICONS = {
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.95a15.6 15.6 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.9 8ZM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96ZM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26Zm.84 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.1 16ZM8.05 8H5.1a7.99 7.99 0 0 1 4.33-3.56A15.6 15.6 0 0 0 8.05 8ZM12 19.96A14.1 14.1 0 0 1 10.09 16h3.82A14.1 14.1 0 0 1 12 19.96ZM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4Zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56ZM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4h-3.38Z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.5" d="m5 9 7 7 7-7"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.5"/><path stroke="currentColor" stroke-width="2.5" stroke-linecap="round" d="m15.5 15.5 5 5"/></svg>',
};

const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Fetches the nav fragment (metadata-independent): local content folder first, then site root.
 * @returns {Promise<HTMLElement|null>}
 */
async function fetchNav() {
  let resp = await fetch('/content/nav.plain.html');
  if (!resp.ok) resp = await fetch('/nav.plain.html');
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
 * Builds the brand (logo box) from the first fragment section.
 * @param {Element} section
 */
function buildBrand(section) {
  const brand = document.createElement('div');
  brand.className = 'nav-brand';
  const link = section.querySelector('a[href]');
  const box = document.createElement('a');
  box.href = link ? link.getAttribute('href') : '/';
  box.className = 'nav-brand-link';
  box.setAttribute('aria-label', (section.querySelector('img') || {}).alt || 'Home');
  section.querySelectorAll('img').forEach((img, i) => {
    img.className = i === 0 ? 'nav-brand-logo' : 'nav-brand-tagline';
    img.loading = 'eager';
    box.append(img);
  });
  brand.append(box);
  return brand;
}

/**
 * Builds the tools row (country link, language menu, search) from the second fragment section.
 * @param {Element} section
 */
function buildTools(section) {
  const tools = document.createElement('div');
  tools.className = 'nav-tools';
  const items = [...section.querySelectorAll(':scope ul > li')].filter((li) => li.parentElement.closest('li') === null);
  items.forEach((li, i) => {
    const sub = li.querySelector(':scope > ul');
    const link = li.querySelector(':scope > a');
    if (sub) {
      // language menu: label + dropdown list
      const wrap = document.createElement('div');
      wrap.className = 'nav-language';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', `Language: ${li.firstChild.textContent.trim()}`);
      btn.innerHTML = `<span>${li.firstChild.textContent.trim()}</span>${ICONS.chevron}`;
      sub.className = 'nav-language-list';
      btn.addEventListener('click', () => {
        btn.setAttribute('aria-expanded', btn.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      });
      wrap.append(btn, sub);
      tools.append(wrap);
    } else if (link && i === items.length - 1) {
      // search: link href is the results page, link text the placeholder
      const form = document.createElement('form');
      form.className = 'nav-search';
      form.action = link.getAttribute('href');
      form.method = 'get';
      form.setAttribute('role', 'search');
      const label = link.textContent.trim() || 'Search';
      form.innerHTML = `<label class="nav-search-label" for="nav-search-input">${label}</label>
        <input id="nav-search-input" type="search" name="q" placeholder="${label}" autocomplete="off">
        <button type="submit" aria-label="${label}">${ICONS.search}</button>`;
      tools.append(form);
    } else if (link) {
      link.className = 'nav-country';
      link.insertAdjacentHTML('afterbegin', ICONS.globe);
      tools.append(link);
    }
  });
  return tools;
}

/**
 * Turns one panel section (h2 intro, description, intro links, h3 groups + lists) into
 * an intro column and a grid of link groups.
 * @param {Element} section
 * @param {string} id
 */
function buildPanel(section, id) {
  const panel = document.createElement('div');
  panel.className = 'nav-panel-content';
  panel.id = id;
  panel.hidden = true;

  const intro = document.createElement('div');
  intro.className = 'nav-panel-intro';
  const groups = document.createElement('div');
  groups.className = 'nav-panel-groups';

  let currentGroup = null;
  [...section.children].forEach((el) => {
    if (el.tagName === 'H3') {
      currentGroup = document.createElement('div');
      currentGroup.className = 'nav-panel-group';
      currentGroup.append(el);
      groups.append(currentGroup);
    } else if (currentGroup) {
      currentGroup.append(el);
    } else {
      if (el.tagName === 'UL') el.className = 'nav-panel-intro-links';
      intro.append(el);
    }
  });
  panel.append(intro, groups);
  return panel;
}

/**
 * Wires a single shared panel + overlay to the nav triggers.
 * @param {Element} nav
 */
function setupPanels(nav, panelHost, overlay) {
  const triggers = [...nav.querySelectorAll('.nav-sections button[aria-controls]')];
  // open state is tracked here, not read back from aria-expanded
  let active = null;
  const close = () => {
    triggers.forEach((t) => t.setAttribute('aria-expanded', 'false'));
    panelHost.querySelectorAll('.nav-panel-content').forEach((p) => { p.hidden = true; });
    nav.classList.remove('is-open');
    overlay.hidden = true;
    active = null;
  };
  const open = (trigger) => {
    close();
    trigger.setAttribute('aria-expanded', 'true');
    panelHost.querySelector(`#${trigger.getAttribute('aria-controls')}`).hidden = false;
    nav.classList.add('is-open');
    if (isDesktop.matches) overlay.hidden = false;
    active = trigger;
  };
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      if (active === trigger) close();
      else open(trigger);
    });
  });
  overlay.addEventListener('click', close);
  panelHost.querySelector('.nav-panel-close').addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !active) return;
    const trigger = active;
    close();
    trigger.focus();
  });
  return close;
}

/**
 * Reads a panel section into { title, groups: [{ label, href, links }] } (non-destructive).
 * @param {Element} section
 */
function readPanelTree(section) {
  const link = (a) => ({ label: a.textContent.trim(), href: a.getAttribute('href') });
  const titleLink = section.querySelector('h2 a');
  const groups = [...section.querySelectorAll(':scope > h3')].map((h3) => {
    const a = h3.querySelector('a');
    const next = h3.nextElementSibling;
    return {
      label: h3.textContent.trim(),
      href: a ? a.getAttribute('href') : null,
      links: next && next.tagName === 'UL' ? [...next.querySelectorAll('a')].map(link) : [],
    };
  });
  return { title: titleLink ? link(titleLink) : null, groups };
}

/**
 * Builds the mobile drill-down drawer: each level slides in and has a back link.
 * @param {Array} items top-level { label, href, tree }
 * @param {Array} languages { label, href }
 */
function buildDrawer(items, languages) {
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  const levels = new Map();

  const makeLevel = (id, parentId) => {
    const level = document.createElement('div');
    level.className = 'nav-level';
    level.id = id;
    level.hidden = id !== 'nav-level-root';
    if (parentId) {
      level.dataset.parent = parentId;
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'nav-level-back';
      back.innerHTML = `${ICONS.chevron}<span>Back</span>`;
      level.append(back);
    }
    const ul = document.createElement('ul');
    level.append(ul);
    levels.set(id, level);
    drawer.append(level);
    return ul;
  };
  const addLink = (ul, label, href) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    li.append(a);
    ul.append(li);
  };
  const addDrill = (ul, label, target) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.target = target;
    btn.innerHTML = `<span>${label}</span>${ICONS.chevron}`;
    li.append(btn);
    ul.append(li);
    return li;
  };

  const root = makeLevel('nav-level-root');
  items.forEach((item, i) => {
    if (!item.tree) {
      addLink(root, item.label, item.href);
      return;
    }
    const levelId = `nav-level-${i}`;
    addDrill(root, item.label, levelId);
    const ul = makeLevel(levelId, 'nav-level-root');
    if (item.tree.title) addLink(ul, item.tree.title.label, item.tree.title.href);
    item.tree.groups.forEach((g, j) => {
      if (!g.links.length) {
        if (g.href) addLink(ul, g.label, g.href);
        return;
      }
      const groupId = `${levelId}-${j}`;
      addDrill(ul, g.label, groupId);
      const gul = makeLevel(groupId, levelId);
      if (g.href) addLink(gul, g.label, g.href);
      g.links.forEach((l) => addLink(gul, l.label, l.href));
    });
  });
  if (languages.length) {
    addDrill(root, 'Select Language', 'nav-level-language').classList.add('nav-level-language');
    const lul = makeLevel('nav-level-language', 'nav-level-root');
    languages.forEach((l) => addLink(lul, l.label, l.href));
  }

  const show = (id, direction) => {
    levels.forEach((level) => { level.hidden = true; level.classList.remove('slide-in', 'slide-back'); });
    const target = levels.get(id);
    target.hidden = false;
    if (direction) target.classList.add(direction);
  };
  drawer.addEventListener('click', (e) => {
    const drill = e.target.closest('button[data-target]');
    const back = e.target.closest('.nav-level-back');
    if (drill) show(drill.dataset.target, 'slide-in');
    else if (back) show(back.closest('.nav-level').dataset.parent, 'slide-back');
  });
  drawer.reset = () => show('nav-level-root');
  return drawer;
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await fetchNav();
  block.textContent = '';
  if (!fragment) return;
  fixImagePaths(fragment);

  const [brandSection, toolsSection, listSection, ...panelSections] = [...fragment.children];
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main');

  const tools = toolsSection ? buildTools(toolsSection) : document.createElement('div');
  const languages = [...tools.querySelectorAll('.nav-language-list a')]
    .map((a) => ({ label: a.textContent.trim(), href: a.getAttribute('href') }));

  // mobile-only search toggle: reveals the search form below the bar
  const searchForm = tools.querySelector('.nav-search');
  if (searchForm) {
    const searchToggle = document.createElement('button');
    searchToggle.type = 'button';
    searchToggle.className = 'nav-search-toggle';
    searchToggle.setAttribute('aria-expanded', 'false');
    searchToggle.setAttribute('aria-label', 'Search');
    searchToggle.innerHTML = ICONS.search;
    searchToggle.addEventListener('click', () => {
      const expanded = searchToggle.getAttribute('aria-expanded') === 'true';
      searchToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if (!expanded) searchForm.querySelector('input').focus();
    });
    searchForm.before(searchToggle);
  }

  // main nav list; items whose label matches a panel heading become panel triggers
  const sections = document.createElement('div');
  sections.className = 'nav-sections';
  const panelHost = document.createElement('div');
  panelHost.className = 'nav-panel';
  const panelsByLabel = new Map(panelSections.map((s) => [normalize((s.querySelector('h2') || {}).textContent), s]));
  const drawerItems = [];
  const list = listSection ? listSection.querySelector('ul') : null;
  if (list) {
    [...list.children].forEach((li, i) => {
      const link = li.querySelector('a');
      const label = link ? link.textContent.trim() : li.textContent.trim();
      const panelSection = panelsByLabel.get(normalize(label));
      drawerItems.push({ label, href: link ? link.getAttribute('href') : '#', tree: panelSection ? readPanelTree(panelSection) : null });
      if (!panelSection) return;
      const id = `nav-panel-${i}`;
      panelHost.append(buildPanel(panelSection, id));
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', id);
      li.classList.add('nav-drop');
      li.replaceChildren(button);
    });
    sections.append(list);
  }

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'nav-panel-close';
  closeButton.setAttribute('aria-label', 'Close menu');
  closeButton.innerHTML = ICONS.chevron;
  panelHost.append(closeButton);

  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  overlay.hidden = true;

  const drawer = buildDrawer(drawerItems, languages);

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  hamburger.innerHTML = '<button type="button" aria-controls="nav" aria-label="Open navigation"><span class="nav-hamburger-icon"></span></button>';
  const hamburgerButton = hamburger.querySelector('button');
  const setMenu = (open) => {
    nav.setAttribute('aria-expanded', open ? 'true' : 'false');
    hamburgerButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.body.style.overflowY = open && !isDesktop.matches ? 'hidden' : '';
    if (open) drawer.reset();
  };
  hamburgerButton.addEventListener('click', () => setMenu(nav.getAttribute('aria-expanded') !== 'true'));

  if (brandSection) nav.append(buildBrand(brandSection));
  nav.append(tools, sections, hamburger, panelHost, drawer);
  setMenu(false);
  const closePanels = setupPanels(nav, panelHost, overlay);

  // reset menu/panel state when crossing the desktop breakpoint
  isDesktop.addEventListener('change', () => {
    closePanels();
    setMenu(false);
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  // overlay sits outside the header bar so it dims the page but not the header itself
  block.append(navWrapper, overlay);
}
