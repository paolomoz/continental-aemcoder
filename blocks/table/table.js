/*
 * Table Block
 * Renders authored rows/cells as a semantic <table>.
 * Structural reference: https://www.aem.live/developer/block-collection/table
 *
 * The first authored row becomes <thead> with <th scope="col"> cells (library convention).
 *
 * Options:
 *  - no-header: every authored row is a body row
 *  - striped:   zebra rows on <tbody>
 */

/**
 * Links in table cells are inline text, not CTAs: undo any buttonization
 * applied by scripts.js decorateButtons() before the block ran.
 * @param {Element} cell
 */
function unbuttonize(cell) {
  cell.querySelectorAll('.button-wrapper').forEach((p) => p.classList.remove('button-wrapper'));
  cell.querySelectorAll('a.button').forEach((a) => {
    a.classList.remove('button', 'primary', 'secondary', 'accent');
    if (!a.className) a.removeAttribute('class');
  });
}

/**
 * Builds a table cell, moving the authored nodes (keeps strong, br, links, etc.).
 * A single wrapping <p> is unwrapped so cells hold inline content directly.
 * @param {Element|null} source authored cell, or null for a padding cell
 * @param {string} tag 'td' | 'th'
 * @returns {HTMLTableCellElement}
 */
function buildCell(source, tag) {
  const cell = document.createElement(tag);
  if (!source) return cell;
  unbuttonize(source);
  const nodes = [...source.childNodes]
    .filter((n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent.trim()));
  const singleP = nodes.length === 1 && nodes[0].tagName === 'P';
  cell.append(...(singleP ? nodes[0].childNodes : source.childNodes));
  return cell;
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const hasHeader = !block.classList.contains('no-header');

  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return;

  // keep the grid regular when authors omit trailing cells
  const columnCount = Math.max(...rows.map((row) => row.children.length));

  const table = document.createElement('table');
  const tbody = document.createElement('tbody');

  rows.forEach((row, i) => {
    const isHead = hasHeader && i === 0;
    const tr = document.createElement('tr');
    const cells = [...row.children];
    for (let c = 0; c < columnCount; c += 1) {
      const cell = buildCell(cells[c] || null, isHead ? 'th' : 'td');
      if (isHead) cell.setAttribute('scope', 'col');
      tr.append(cell);
    }
    if (isHead) {
      const thead = document.createElement('thead');
      thead.append(tr);
      table.append(thead);
    } else {
      tbody.append(tr);
    }
  });

  table.append(tbody);
  table.classList.add(`table-cols-${columnCount}`);

  const scroller = document.createElement('div');
  scroller.className = 'table-scroll';
  // keyboard users can scroll overflowing tables
  scroller.tabIndex = 0;
  scroller.setAttribute('role', 'region');
  const label = hasHeader
    ? [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim()).filter(Boolean).join(', ')
    : '';
  scroller.setAttribute('aria-label', label || 'Table');
  scroller.append(table);

  block.replaceChildren(scroller);
}
