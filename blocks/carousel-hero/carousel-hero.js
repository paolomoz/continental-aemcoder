import { createOptimizedPicture } from '../../scripts/aem.js';

// light-text: white slide text + controls for darker photos (default: inherited dark text)
const OPTION_CLASSES = ['light-text'];

let carouselId = 0;

function updateActiveSlide(block, slideIndex) {
  block.dataset.activeSlide = slideIndex;

  block.querySelectorAll('.carousel-hero-slide').forEach((slide, idx) => {
    const active = idx === slideIndex;
    slide.setAttribute('aria-hidden', !active);
    slide.querySelectorAll('a, button').forEach((el) => {
      if (active) el.removeAttribute('tabindex');
      else el.setAttribute('tabindex', '-1');
    });
  });

  block.querySelectorAll('.carousel-hero-slide-indicator button').forEach((button, idx) => {
    if (idx === slideIndex) {
      button.setAttribute('disabled', '');
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('disabled');
      button.removeAttribute('aria-current');
    }
  });
}

function showSlide(block, slideIndex) {
  const slides = block.querySelectorAll('.carousel-hero-slide');
  if (!slides.length) return;
  let target = slideIndex;
  if (target < 0) target = slides.length - 1;
  if (target >= slides.length) target = 0;
  block.querySelector('.carousel-hero-slides').scrollTo({
    top: 0,
    left: slides[target].offsetLeft,
    behavior: 'smooth',
  });
  updateActiveSlide(block, target);
}

function bindEvents(block) {
  block.querySelectorAll('.carousel-hero-slide-indicator button').forEach((button) => {
    button.addEventListener('click', () => {
      showSlide(block, parseInt(button.parentElement.dataset.targetSlide, 10));
    });
  });

  block.querySelector('.slide-prev').addEventListener('click', () => {
    showSlide(block, parseInt(block.dataset.activeSlide || '0', 10) - 1);
  });
  block.querySelector('.slide-next').addEventListener('click', () => {
    showSlide(block, parseInt(block.dataset.activeSlide || '0', 10) + 1);
  });

  // keep indicators in sync when the user swipes / scrolls the track
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        updateActiveSlide(block, parseInt(entry.target.dataset.slideIndex, 10));
      }
    });
  }, { root: block.querySelector('.carousel-hero-slides'), threshold: 0.6 });
  block.querySelectorAll('.carousel-hero-slide').forEach((slide) => observer.observe(slide));
}

function createSlide(row, slideIndex, id) {
  const slide = document.createElement('li');
  slide.className = 'carousel-hero-slide';
  slide.dataset.slideIndex = slideIndex;
  slide.id = `carousel-hero-${id}-slide-${slideIndex}`;

  const cells = [...row.children];
  // the image cell is the one holding only a picture; tolerate either order or a missing image
  const imageCell = cells.find((c) => c.querySelector('picture') && !c.textContent.trim());
  const contentCells = cells.filter((c) => c !== imageCell);

  if (imageCell) {
    imageCell.className = 'carousel-hero-slide-image';
    imageCell.querySelectorAll('picture > img').forEach((img) => {
      img.closest('picture').replaceWith(createOptimizedPicture(
        img.src,
        img.alt,
        slideIndex === 0,
        [{ media: '(min-width: 900px)', width: '2000' }, { width: '900' }],
      ));
    });
    slide.append(imageCell);
  } else {
    slide.classList.add('no-image');
  }

  const content = document.createElement('div');
  content.className = 'carousel-hero-slide-content';
  contentCells.forEach((cell) => content.append(...cell.childNodes));
  if (content.textContent.trim() || content.children.length) slide.append(content);

  const heading = content.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading && heading.id) slide.setAttribute('aria-labelledby', heading.id);

  return slide;
}

export default function decorate(block) {
  carouselId += 1;
  const id = carouselId;
  block.id = `carousel-hero-${id}`;

  // options are applied by CSS; unknown classes are left untouched
  const active = [...block.classList].filter((c) => OPTION_CLASSES.includes(c));
  block.dataset.options = active.join(' ');

  const rows = [...block.querySelectorAll(':scope > div')];
  const isSingleSlide = rows.length < 2;

  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'Carousel');

  const container = document.createElement('div');
  container.className = 'carousel-hero-slides-container';

  const slidesWrapper = document.createElement('ul');
  slidesWrapper.className = 'carousel-hero-slides';

  let indicators;
  if (!isSingleSlide) {
    const nav = document.createElement('div');
    nav.className = 'carousel-hero-navigation-buttons';
    nav.innerHTML = `
      <button type="button" class="slide-prev" aria-label="Previous Slide"></button>
      <button type="button" class="slide-next" aria-label="Next Slide"></button>
    `;
    container.append(nav);

    const indicatorsNav = document.createElement('nav');
    indicatorsNav.setAttribute('aria-label', 'Carousel Slide Controls');
    indicators = document.createElement('ol');
    indicators.className = 'carousel-hero-slide-indicators';
    indicatorsNav.append(indicators);
    block.append(indicatorsNav);
  }

  rows.forEach((row, idx) => {
    slidesWrapper.append(createSlide(row, idx, id));
    if (indicators) {
      const li = document.createElement('li');
      li.className = 'carousel-hero-slide-indicator';
      li.dataset.targetSlide = idx;
      li.innerHTML = `<button type="button" aria-label="Show Slide ${idx + 1} of ${rows.length}"></button>`;
      indicators.append(li);
    }
    row.remove();
  });

  container.prepend(slidesWrapper);
  block.prepend(container);

  if (!isSingleSlide) {
    updateActiveSlide(block, 0);
    bindEvents(block);
  }
}
