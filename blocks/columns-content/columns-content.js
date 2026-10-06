import { createOptimizedPicture } from '../../scripts/aem.js';

/*
 * Multi-column rich text: one row, one cell per column (2-3 columns), default content
 * (text, images, buttons) inside each cell. Further rows are laid out the same way.
 * Option wide-left: two columns split 2/3 + 1/3.
 */
const OPTION_CLASSES = ['wide-left'];

const isEmpty = (el) => !el.querySelector('picture, img, iframe') && !el.textContent.trim();

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  [...block.children].forEach((row) => {
    // empty cells authors leave behind would become empty columns
    [...row.children].forEach((cell) => {
      if (isEmpty(cell)) cell.remove();
    });
    if (!row.children.length) {
      row.remove();
      return;
    }
    row.classList.add('columns-content-row');
    row.dataset.cols = row.children.length;

    [...row.children].forEach((cell) => {
      cell.classList.add('columns-content-col');
      // text directly in a cell (no paragraph) gets a paragraph so spacing is consistent
      if (!cell.children.length) {
        const p = document.createElement('p');
        p.textContent = cell.textContent.trim();
        cell.replaceChildren(p);
      }
      // a column holding nothing but an image is an image column
      const onlyPicture = cell.querySelector('picture') && !cell.textContent.trim();
      if (onlyPicture) cell.classList.add('columns-content-image-col');
    });
  });

  block.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [
      { media: '(min-width: 900px)', width: '1000' },
      { width: '750' },
    ]));
  });
}
