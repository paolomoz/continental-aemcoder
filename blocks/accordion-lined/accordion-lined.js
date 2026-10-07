/*
 * Accordion (lined): one row per item, cell 1 = title, cell 2 = panel content.
 * Native <details>/<summary>, so items work without JS once decorated and are
 * found by in-page search in supporting browsers.
 * Option two-column: on desktop the items are laid out in two columns
 * (first half left, second half right, authored order), stacked on mobile.
 */
const OPTION_CLASSES = ['two-column'];

const isEmpty = (el) => !el.querySelector('picture, img, iframe') && !el.textContent.trim();

/** Moves the label content into the summary, unwrapping a lone paragraph. */
function fillSummary(summary, nodes) {
  const elements = nodes.filter((n) => n.nodeType === Node.ELEMENT_NODE);
  const text = nodes.filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
  if (elements.length === 1 && elements[0].tagName === 'P' && !text.length) {
    summary.append(...elements[0].childNodes);
  } else {
    summary.append(...nodes);
  }
}

function buildItem(row) {
  const cells = [...row.children].filter((cell) => !isEmpty(cell));
  if (!cells.length) return null;

  const details = document.createElement('details');
  details.className = 'accordion-lined-item';
  const summary = document.createElement('summary');
  summary.className = 'accordion-lined-item-label';
  const body = document.createElement('div');
  body.className = 'accordion-lined-item-body';

  if (cells.length === 1) {
    // a single cell: its first element is the title, the rest the panel
    const [cell] = cells;
    const first = cell.firstElementChild;
    if (first) {
      fillSummary(summary, [first]);
      first.remove();
      body.append(...cell.childNodes);
    } else {
      summary.textContent = cell.textContent.trim();
    }
  } else {
    const [label, ...rest] = cells;
    fillSummary(summary, [...label.childNodes]);
    // extra cells are tolerated: all of them become panel content
    rest.forEach((cell) => body.append(...cell.childNodes));
  }

  details.append(summary);
  if (!isEmpty(body)) details.append(body);
  else details.classList.add('accordion-lined-item-empty');
  return details;
}

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  const items = [...block.children].map(buildItem).filter(Boolean);

  if (active.includes('two-column') && items.length > 1) {
    const half = Math.ceil(items.length / 2);
    const columns = [items.slice(0, half), items.slice(half)].map((group) => {
      const col = document.createElement('div');
      col.className = 'accordion-lined-column';
      col.append(...group);
      return col;
    });
    block.replaceChildren(...columns);
  } else {
    block.replaceChildren(...items);
  }
}
