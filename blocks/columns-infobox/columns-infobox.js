const OPTION_CLASSES = [];

const isEmpty = (el) => !el.querySelector('picture, img, video, iframe') && !el.textContent.trim();

const isImageOnly = (cell) => !!cell.querySelector('picture, img') && !cell.textContent.trim();

function isExternal(a) {
  try {
    const url = new URL(a.href, window.location.href);
    return /^https?:$/.test(url.protocol) && url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Turns the trailing link-only paragraph of the text cell into the CTA button,
 * unless scripts.js already buttonized it from authored bold/italic formatting.
 */
function decorateCta(textCell) {
  const paragraphs = [...textCell.querySelectorAll(':scope > p')];
  const last = paragraphs[paragraphs.length - 1];
  const a = last?.querySelector('a[href]');
  if (!a || last.textContent.trim() !== a.textContent.trim()) return;
  last.classList.add('columns-infobox-cta');
  if (!a.classList.contains('button')) {
    last.classList.add('button-wrapper');
    a.classList.add('button', 'primary');
  }
}

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  [...block.children].forEach((row) => {
    row.classList.add('columns-infobox-row');
    [...row.children].forEach((cell) => {
      if (isEmpty(cell)) cell.remove();
    });
    const cells = [...row.children];
    if (!cells.length) {
      row.remove();
      return;
    }

    let hasImage = false;
    cells.forEach((cell, i) => {
      if (!hasImage && isImageOnly(cell)) {
        hasImage = true;
        cell.classList.add('columns-infobox-image');
        // image authored in the second cell renders on the right on desktop
        if (i > 0) row.classList.add('columns-infobox-image-right');
      } else {
        cell.classList.add('columns-infobox-text');
        decorateCta(cell);
      }
    });
    if (!hasImage) row.classList.add('columns-infobox-text-only');

    row.querySelectorAll('a[href]').forEach((a) => {
      if (isExternal(a)) {
        a.target = '_blank';
        a.rel = 'noopener';
        a.classList.add('columns-infobox-external');
      }
    });
  });
}
