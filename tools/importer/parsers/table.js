/* eslint-disable */
/* global WebImporter */
/**
 * Parser for table. Base: table (Block Collection).
 * Source: https://www.continental.com/en/press/press-releases/christian-koetz/
 * Generated: 2026-10-06
 *
 * Instance is a `.c-table` wrapper holding one <table>. Library convention: the first
 * data row is the table head; source tables without a <thead>/<th> row get the
 * `no header` variant. `is-striped` on the wrapper maps to `striped`. Each <tr> -> one
 * block row, each <td>/<th> -> one cell with its inline formatting. The scroll-hint
 * overlay next to the table is not content and is dropped with the wrapper.
 */
export default function parse(element, { document }) {
  const table = element.matches('table') ? element : element.querySelector('table');
  if (!table) return;

  const rows = [...table.querySelectorAll('tr')].filter((tr) => tr.closest('table') === table);
  if (!rows.length) return;

  // A single-cell "table" is a layout box (e.g. a status line), not tabular data.
  const allCells = rows.flatMap((tr) => [...tr.children]);
  if (allCells.length === 1) {
    const p = document.createElement('p');
    [...allCells[0].childNodes].forEach((node) => p.append(node));
    element.replaceWith(p);
    return;
  }

  const firstRow = rows[0];
  const hasHeader = !!table.querySelector(':scope > thead')
    || (firstRow.children.length > 0 && [...firstRow.children].every((c) => c.tagName === 'TH'));
  const striped = element.classList && element.classList.contains('is-striped');

  const cells = rows.map((tr) => [...tr.children].map((cell) => {
    const div = document.createElement('div');
    [...cell.childNodes].forEach((node) => div.append(node));
    return div;
  }));

  const variants = [striped && 'striped', !hasHeader && 'no header'].filter(Boolean);
  const name = variants.length ? `Table (${variants.join(', ')})` : 'Table';
  element.replaceWith(WebImporter.Blocks.createBlock(document, { name, cells }));
}
