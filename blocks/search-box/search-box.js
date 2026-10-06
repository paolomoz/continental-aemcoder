const OPTION_CLASSES = [];

const DEFAULT_PLACEHOLDER = 'Search';
const PARAM = 'q';

let searchBoxId = 0;

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-');

/**
 * Reads the authored content. Every row is optional:
 * - the first link is the search page (href = form target, link text = placeholder)
 * - "placeholder | Search" overrides the placeholder
 * - "label | Search the press portal" sets the accessible label (defaults to the placeholder)
 */
function readConfig(block) {
  const config = { link: null, placeholder: '', label: '' };
  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const key = cells.length > 1 ? normalize(cells[0].textContent) : '';
    const valueCells = key ? cells.slice(1) : cells;
    const link = valueCells.map((c) => c.querySelector('a[href]')).find(Boolean);
    const text = valueCells.map((c) => c.textContent.trim()).filter(Boolean).join(' ');
    if (link && !config.link && key !== 'placeholder' && key !== 'label') config.link = link;
    else if (key === 'placeholder' && text) config.placeholder = text;
    else if (key === 'label' && text) config.label = text;
  });
  return config;
}

/** Builds `{href}?q=<term>`, keeping any query params already on the authored link. */
function buildTargetUrl(href, term) {
  const url = new URL(href, window.location.href);
  if (term) url.searchParams.set(PARAM, term);
  else url.searchParams.delete(PARAM);
  return url;
}

const samePage = (url) => url.origin === window.location.origin
  && url.pathname.replace(/\/+$/, '') === window.location.pathname.replace(/\/+$/, '');

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  const config = readConfig(block);
  // without a target link there is nothing to submit to: leave the authored content as is
  if (!config.link) return;

  searchBoxId += 1;
  const inputId = `search-box-${searchBoxId}-input`;
  const href = config.link.getAttribute('href');
  const placeholder = config.placeholder || config.link.textContent.trim() || DEFAULT_PLACEHOLDER;
  const label = config.label || placeholder;
  const action = buildTargetUrl(href, '');

  const form = document.createElement('form');
  form.className = 'search-box-form';
  form.setAttribute('role', 'search');
  form.method = 'get';
  form.action = action.href;

  const labelEl = document.createElement('label');
  labelEl.className = 'search-box-label';
  labelEl.htmlFor = inputId;
  labelEl.textContent = label;

  const input = document.createElement('input');
  input.className = 'search-box-input';
  input.type = 'search';
  input.name = PARAM;
  input.id = inputId;
  input.placeholder = placeholder;
  input.autocomplete = 'off';
  input.enterKeyHint = 'search';
  // when the box sits on its own results page, show the current term
  const { search: query } = window.location;
  const current = new URLSearchParams(query).get(PARAM);
  if (current && samePage(action)) input.value = current;

  const button = document.createElement('button');
  button.className = 'search-box-submit';
  button.type = 'submit';
  button.setAttribute('aria-label', label);
  button.innerHTML = '<span class="search-box-icon" aria-hidden="true"></span>';

  form.append(labelEl, input, button);

  // navigate explicitly so query params already on the authored link survive
  // (a plain GET form would drop them)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    window.location.href = buildTargetUrl(href, input.value.trim()).href;
  });

  block.replaceChildren(form);
}
