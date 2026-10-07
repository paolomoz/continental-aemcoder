import { createOptimizedPicture } from '../../scripts/aem.js';

const OPTION_CLASSES = [];

/* normalized file kinds, keyed by label words and file extensions */
const KINDS = {
  word: ['word', 'doc', 'docx', 'rtf'],
  pdf: ['pdf'],
  image: ['image', 'images', 'photo', 'jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'webp', 'svg'],
  excel: ['excel', 'xls', 'xlsx', 'csv'],
  powerpoint: ['powerpoint', 'ppt', 'pptx'],
  video: ['video', 'mp4', 'mov'],
  audio: ['audio', 'mp3', 'wav'],
  archive: ['zip', 'archive'],
};

const LABELS = {
  word: 'Word',
  pdf: 'PDF',
  image: 'Image',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
  video: 'Video',
  audio: 'Audio',
  archive: 'ZIP',
};

const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*(bytes?|b|kb|mb|gb)\b/i;

const isEmpty = (el) => !el.querySelector('picture, img, a[href]') && !el.textContent.trim();

function kindOf(word) {
  const w = (word || '').trim().toLowerCase().replace(/^\./, '');
  if (!w) return '';
  return Object.keys(KINDS).find((k) => KINDS[k].includes(w)) || '';
}

function extensionOf(href) {
  try {
    const { pathname } = new URL(href, window.location.href);
    const m = pathname.match(/\.([a-z0-9]{2,5})$/i);
    const ext = m ? m[1].toLowerCase() : '';
    // page URLs are not files
    return ['html', 'htm', 'php', 'asp', 'aspx', 'jsp'].includes(ext) ? '' : ext;
  } catch {
    return '';
  }
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function unbutton(a) {
  a.classList.remove('button', 'primary', 'secondary', 'accent');
  const p = a.closest('.button-wrapper, .button-container');
  if (p) p.classList.remove('button-wrapper', 'button-container');
}

/**
 * Reads one authored row into { picture, link, typeText, sizeText }.
 * Accepts: [type | link + size], [link + "TYPE size"], [image | type | link + size].
 */
function readRow(row) {
  const cells = [...row.children].filter((cell) => !isEmpty(cell));
  const data = {
    picture: null, link: null, typeText: '', sizeText: '',
  };

  cells.forEach((cell) => {
    const picture = cell.querySelector('picture');
    const link = cell.querySelector('a[href]');
    if (picture && !data.picture && !cell.textContent.trim()) {
      data.picture = picture;
      return;
    }
    if (link && !data.link) {
      data.link = link;
      // remaining text in the link cell is the size (optionally prefixed by the type)
      const clone = cell.cloneNode(true);
      clone.querySelectorAll('a[href]').forEach((a) => a.remove());
      const rest = clone.textContent.replace(/\s+/g, ' ').trim();
      if (rest) data.sizeText = rest;
      return;
    }
    if (!data.typeText) data.typeText = cell.textContent.replace(/\s+/g, ' ').trim();
  });

  // "PDF 1.2 MB" in the size slot: split off the type
  if (data.sizeText) {
    const [first, ...others] = data.sizeText.split(' ');
    if (!data.typeText && kindOf(first) && others.length) {
      data.typeText = first;
      data.sizeText = others.join(' ');
    }
  }
  // a type cell that also carries the size ("PDF | 1.2 MB" collapsed into one cell)
  if (!data.sizeText && SIZE_RE.test(data.typeText) && data.typeText.split(' ').length > 1) {
    const [first, ...others] = data.typeText.split(' ');
    data.typeText = first;
    data.sizeText = others.join(' ');
  }
  // raw byte counts become human readable
  if (/^\d+$/.test(data.sizeText)) data.sizeText = formatBytes(Number(data.sizeText));
  return data;
}

function buildItem(row) {
  const {
    picture, link, typeText, sizeText,
  } = readRow(row);
  if (!link) return null;

  const href = link.getAttribute('href');
  const ext = extensionOf(href);
  const kind = kindOf(typeText) || kindOf(ext) || 'file';
  const label = typeText || LABELS[kind] || (ext ? ext.toUpperCase() : 'File');

  const li = document.createElement('li');
  li.className = `cards-downloads-item cards-downloads-${kind}`;

  if (picture) {
    const img = picture.querySelector('img');
    const thumb = document.createElement('div');
    thumb.className = 'cards-downloads-thumb';
    thumb.append(img
      ? createOptimizedPicture(img.src, img.alt || '', false, [{ width: '200' }])
      : picture);
    li.append(thumb);
    li.classList.add('cards-downloads-has-thumb');
  }

  const type = document.createElement('span');
  type.className = 'cards-downloads-type';
  type.dataset.kind = kind;
  type.innerHTML = '<span class="cards-downloads-icon" aria-hidden="true"></span>';
  const typeLabel = document.createElement('span');
  typeLabel.className = 'cards-downloads-type-label';
  typeLabel.textContent = label;
  type.append(typeLabel);
  li.append(type);

  const info = document.createElement('div');
  info.className = 'cards-downloads-info';
  unbutton(link);
  link.classList.add('cards-downloads-link');
  if (!link.textContent.trim()) link.textContent = decodeURIComponent(href.split('/').pop() || href);
  if (ext) {
    // a direct file: let the browser save it (same-origin) and open cross-origin files in a new tab
    link.setAttribute('download', '');
    link.target = '_blank';
    link.rel = 'noopener';
  } else {
    // unresolved file: link points to the source article
    li.classList.add('cards-downloads-unresolved');
    link.target = '_blank';
    link.rel = 'noopener';
  }
  link.title = link.title || link.textContent.trim();
  info.append(link);

  if (sizeText) {
    const size = document.createElement('span');
    size.className = 'cards-downloads-size';
    size.textContent = sizeText;
    info.append(size);
  }
  li.append(info);
  return li;
}

export default function decorate(block) {
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  const ul = document.createElement('ul');
  const extras = [];
  [...block.children].forEach((row) => {
    const li = buildItem(row);
    if (li) ul.append(li);
    else if (!isEmpty(row)) extras.push(...[...row.children].flatMap((c) => [...c.childNodes]));
  });

  // rows without a link (e.g. an authored heading) stay above the list
  const nodes = [];
  if (extras.length) {
    const head = document.createElement('div');
    head.className = 'cards-downloads-header';
    head.append(...extras);
    nodes.push(head);
  }
  if (ul.children.length) nodes.push(ul);
  block.replaceChildren(...nodes);
}
