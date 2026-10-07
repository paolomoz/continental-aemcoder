const OPTION_CLASSES = [];

// a stat value is a short numeric string such as "0.20", "28.1", "8.1", "+12 %", "1,234"
const VALUE_PATTERN = /^[+\-−~<>≈]?\s*[\d.,]+\s*[%‰]?$/;

/**
 * Tag the parts of one stat box so CSS can lay them out:
 * label (heading or first paragraph), value (big number), unit (bold-only line),
 * description (rest).
 * @param {Element} body
 */
function decorateStat(body) {
  const children = [...body.children];
  const value = children.find((el) => el.tagName === 'P' && VALUE_PATTERN.test(el.textContent.trim()))
    || children.find((el) => /^H[1-6]$/.test(el.tagName) && VALUE_PATTERN.test(el.textContent.trim()));
  if (value) value.classList.add('cards-stats-value');

  const label = children.find((el) => el !== value && /^H[1-6]$/.test(el.tagName))
    || (value && children.indexOf(value) > 0 ? children[0] : null);
  if (label && label !== value) label.classList.add('cards-stats-label');

  children.forEach((el) => {
    if (el === value || el === label) return;
    const onlyStrong = el.tagName === 'P' && el.children.length === 1
      && el.firstElementChild.tagName === 'STRONG'
      && el.textContent.trim() === el.firstElementChild.textContent.trim();
    if (onlyStrong && !body.querySelector('.cards-stats-unit')) el.classList.add('cards-stats-unit');
    else el.classList.add('cards-stats-description');
  });
}

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = 'cards-stats-card';

    // stats have no images: merge every authored cell into one body so extra cells are tolerated
    const body = document.createElement('div');
    body.className = 'cards-stats-card-body';
    [...row.children].forEach((cell) => body.append(...cell.childNodes));
    if (!body.textContent.trim()) return;

    // text directly in a cell (no paragraph) is wrapped so it can be tagged
    [...body.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        const p = document.createElement('p');
        node.replaceWith(p);
        p.append(node);
      } else if (node.nodeType === Node.TEXT_NODE) {
        node.remove();
      }
    });

    decorateStat(body);
    li.append(body);
    ul.append(li);
  });

  // lets CSS put exactly four key figures in one desktop row
  ul.dataset.count = ul.children.length;
  block.replaceChildren(ul);
}
