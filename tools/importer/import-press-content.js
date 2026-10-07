/* eslint-disable */
/* global WebImporter */
// Generated import script for template "press-content" (106 URLs in page-templates.json).

import carouselHeroParser from './parsers/carousel-hero.js';
import cardsTeaserParser from './parsers/cards-teaser.js';
import cardsGalleryParser from './parsers/cards-gallery.js';
import cardsStatsParser from './parsers/cards-stats.js';
import columnsVideoParser from './parsers/columns-video.js';
import videoPosterParser from './parsers/video-poster.js';
import accordionLinedParser from './parsers/accordion-lined.js';
import quotePortraitParser from './parsers/quote-portrait.js';
import tableParser from './parsers/table.js';
import columnsInfoboxParser from './parsers/columns-infobox.js';
import columnsContentParser from './parsers/columns-content.js';
import cardsDownloadsParser from './parsers/cards-downloads.js';
import pressSearchParser from './parsers/press-search.js';

import continentalCleanupTransformer from './transformers/continental-cleanup.js';
import continentalSectionsTransformer from './transformers/continental-sections.js';
import continentalPressMetadataTransformer from './transformers/continental-press-metadata.js';

const parsers = {
  'carousel-hero': carouselHeroParser,
  'cards-teaser': cardsTeaserParser,
  'cards-gallery': cardsGalleryParser,
  'cards-stats': cardsStatsParser,
  'columns-video': columnsVideoParser,
  'video-poster': videoPosterParser,
  'accordion-lined': accordionLinedParser,
  'quote-portrait': quotePortraitParser,
  'table': tableParser,
  'columns-infobox': columnsInfoboxParser,
  'columns-content': columnsContentParser,
  'cards-downloads': cardsDownloadsParser,
  'press-search': pressSearchParser,
};

const PAGE_TEMPLATE = {
  "name": "press-content",
  "description": "Modular press section pages: fairs & events, media library, studies & publications, press contacts, white papers",
  "urls": [
    "https://www.continental.com/en/press/fairs-events/ces-2025/",
    "https://www.continental.com/en/press/fairs-events/",
    "https://www.continental.com/en/press/fairs-events/annual-press-conference-2025/",
    "https://www.continental.com/en/press/fairs-events/annual-press-conference-2025/technology-highlights/",
    "https://www.continental.com/en/press/fairs-events/annual-press-conference-2026/"
  ],
  "blocks": [
    {
      "name": "carousel-hero",
      "instances": [
        "main > .c-heroteaser-fixed"
      ]
    },
    {
      "name": "cards-teaser",
      "instances": [
        ".c-content-slider:has(a.c-teaser)",
        ".o-tabs .o-tabs__content-item .o-container__content > .row:not(.o-container__header):has(.c-teaser)",
        ".o-container.has-columns:not(.o-tabs .o-container) > .o-container__content > .row:not(.o-container__header):has(.c-teaser)"
      ]
    },
    {
      "name": "cards-gallery",
      "instances": [
        ".c-content-slider:has(figure.c-image):not(:has(a.c-teaser))",
        ".o-container > .o-container__content > .row:not(.o-container__header):has(> .col-md-3 figure.c-image)",
        ".o-container.is-white.is-nested:has(figure ~ figure, .col figure)"
      ]
    },
    {
      "name": "cards-stats",
      "instances": [
        ".o-container .o-container__content > .row:not(.o-container__header):has(.c-fact-box)"
      ]
    },
    {
      "name": "columns-video",
      "instances": [
        ".o-container .o-container__content > .row:not(.o-container__header):has(> div ~ div):has(.c-media__embed.is-video):has(.c-media__text):not(:has(.o-accordion))"
      ]
    },
    {
      "name": "video-poster",
      "instances": [
        ".c-media__embed.is-video"
      ]
    },
    {
      "name": "accordion-lined",
      "instances": [
        ".o-accordion"
      ]
    },
    {
      "name": "quote-portrait",
      "instances": [
        ".c-quote"
      ]
    },
    {
      "name": "table",
      "instances": [
        ".c-table"
      ]
    },
    {
      "name": "columns-infobox",
      "instances": [
        ".c-media__content.is-image-intext:has(.c-media__gallery, figure)",
        ".o-container.is-lightgray.is-nested .o-container__content > .row:not(.o-container__header)"
      ]
    },
    {
      "name": "columns-content",
      "instances": [
        ".o-container.has-columns > .o-container__content > .row:not(.o-container__header):not(:has(.c-teaser, .c-fact-box, .c-contact, .o-accordion, .c-content-slider, .c-quote, .c-media__embed.is-video, .c-table)):has(> div ~ div)"
      ]
    },
    {
      "name": "cards-downloads",
      "instances": [
        ".c-pageoptions:has(form[data-minicart])",
        ".o-page__ce:has(a.c-link--download)"
      ]
    },
    {
      "name": "press-search",
      "instances": [
        ".o-container.tx_solr:has(.c-search__results)"
      ]
    }
  ],
  "sections": [
    {
      "id": "1",
      "name": "banner",
      "selector": [
        "main > .c-heroteaser.c-heroteaser--small"
      ],
      "style": "banner",
      "blocks": [],
      "defaultContent": [
        "img"
      ]
    },
    {
      "id": "2",
      "name": "hero",
      "selector": [
        "main > .c-heroteaser-fixed"
      ],
      "style": null,
      "blocks": [
        "carousel-hero"
      ],
      "defaultContent": []
    },
    {
      "id": "3",
      "name": "container",
      "selector": [
        "main > .o-container:not(.d-print-none)"
      ],
      "style": null,
      "blocks": [
        "carousel-hero",
        "cards-teaser",
        "cards-gallery",
        "cards-stats",
        "columns-video",
        "video-poster",
        "accordion-lined",
        "quote-portrait",
        "table",
        "columns-infobox",
        "columns-content",
        "cards-downloads"
      ],
      "defaultContent": [
        ".o-container__header",
        ".c-media__text"
      ]
    },
    {
      "id": "4",
      "name": "sidebar",
      "selector": [
        "main .o-container__content > .row > .col-12.col-md-4.col-lg-3"
      ],
      "style": "sidebar",
      "blocks": [],
      "defaultContent": [
        ".c-contact",
        ".o-box"
      ]
    }
  ],
  "sectionMode": "containers",
  "sectionStyles": {
    "is-lightgray": "light-grey",
    "is-gray": "grey",
    "is-pastel-yellow": "pastel-yellow",
    "is-pastel-green": "pastel-green",
    "is-yellow": "yellow",
    "has-image": "background-image"
  }
};

const transformers = [
  continentalCleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [continentalSectionsTransformer] : []),
  continentalPressMetadataTransformer,
];

function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      let elements = [];
      try {
        elements = document.querySelectorAll(selector);
      } catch (e) {
        console.warn(`Invalid selector for "${blockDef.name}": ${selector}`);
      }
      if (elements.length === 0) {
        console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
      }
      elements.forEach((element) => {
        pageBlocks.push({ name: blockDef.name, selector, element, section: blockDef.section || null });
      });
    });
  });
  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;

    executeTransformers('beforeTransform', main, payload);

    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    executeTransformers('afterTransform', main, payload);

    // A transformer may redirect the output (e.g. a shared contact fragment) by marking
    // the root with its target path; such documents carry no page metadata.
    const outputPath = main.getAttribute('data-excat-output-path');
    main.removeAttribute('data-excat-output-path');

    // A transformer-built Metadata block (press-release) replaces the generic one.
    const hasMetadata = [...main.querySelectorAll('table tr:first-child')]
      .some((tr) => tr.textContent.trim().toLowerCase() === 'metadata');
    if (!outputPath && !hasMetadata) {
      const hr = document.createElement('hr');
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document);
    }
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // Keep the source /en/... structure; a bare locale root maps to <locale>/index.
    let rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    if (rawPath === '') rawPath = '/index';
    else if (/^\/[a-z]{2}(-[a-z]{2})?$/.test(rawPath)) rawPath = `${rawPath}/index`;
    const path = WebImporter.FileUtils.sanitizePath(outputPath || rawPath);

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
