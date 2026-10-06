/* eslint-disable */
/* global WebImporter */
// Generated import script for template "press-release" (947 URLs in page-templates.json).

import cardsGalleryParser from './parsers/cards-gallery.js';
import columnsInfoboxParser from './parsers/columns-infobox.js';
import cardsDownloadsParser from './parsers/cards-downloads.js';
import cardsLatestNewsParser from './parsers/cards-latest-news.js';
import tableParser from './parsers/table.js';
import videoPosterParser from './parsers/video-poster.js';

import continentalCleanupTransformer from './transformers/continental-cleanup.js';
import continentalSectionsTransformer from './transformers/continental-sections.js';
import continentalPressMetadataTransformer from './transformers/continental-press-metadata.js';

const parsers = {
  'cards-gallery': cardsGalleryParser,
  'columns-infobox': columnsInfoboxParser,
  'cards-downloads': cardsDownloadsParser,
  'cards-latest-news': cardsLatestNewsParser,
  'table': tableParser,
  'video-poster': videoPosterParser,
};

const PAGE_TEMPLATE = {
  "name": "press-release",
  "description": "Press release article: two-column body + sidebar (date, downloads, contact, share)",
  "urls": [
    "https://www.continental.com/en/press/press-releases/oe-porsche/",
    "https://www.continental.com/en/press/press-release/20230509-sportcontact-7/",
    "https://www.continental.com/en/press/press-releases/-20210908-new-sports-tire-from-continental-starts/",
    "https://www.continental.com/en/press/press-releases/-20241014-americas-ashok-vedanayagam/",
    "https://www.continental.com/en/press/press-releases/-20241028-brabus-supercar-rocket/"
  ],
  "blocks": [
    {
      "name": "cards-gallery",
      "instances": [
        "main .o-container__content > .row > .col-12.col-md-8.col-lg-9 .o-container.is-white.is-nested:has(figure ~ figure, .col figure)",
        "main .o-container__content > .row > .col-12.col-md-8.col-lg-9 .c-content-slider"
      ]
    },
    {
      "name": "columns-infobox",
      "instances": [
        "main .o-container__content > .row > .col-12.col-md-8.col-lg-9 .o-container.is-lightgray.is-nested .o-container__content > .row:not(.o-container__header)"
      ]
    },
    {
      "name": "cards-downloads",
      "instances": [
        "main .o-container__content > .row > .col-12.col-md-8.col-lg-9 .c-pageoptions"
      ]
    },
    {
      "name": "cards-latest-news",
      "instances": [
        "main .o-container__content > .row > .col-12.col-md-4.col-lg-3 .c-news-sidebar"
      ]
    },
    {
      "name": "table",
      "instances": [
        "main .c-table"
      ]
    },
    {
      "name": "video-poster",
      "instances": [
        "main .o-container__content > .row > .col-12.col-md-8.col-lg-9 .c-media__embed.is-video"
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
        ".c-heroteaser img"
      ]
    },
    {
      "id": "2",
      "name": "article-body",
      "selector": [
        "main .o-container__content > .row > .col-12.col-md-8.col-lg-9"
      ],
      "style": null,
      "blocks": [
        "cards-gallery",
        "table"
      ],
      "defaultContent": [
        "header.c-media__header h1",
        ".o-page__ce"
      ]
    },
    {
      "id": "3",
      "name": "infobox",
      "selector": [
        "main .o-container__content > .row > .col-12.col-md-8.col-lg-9 .o-container.is-lightgray.is-nested"
      ],
      "style": "light-grey",
      "blocks": [
        "columns-infobox"
      ],
      "defaultContent": [
        ".o-container__header"
      ]
    },
    {
      "id": "4",
      "name": "downloads",
      "selector": [
        "main .o-container__content > .row > .col-12.col-md-8.col-lg-9 .c-pageoptions"
      ],
      "style": null,
      "blocks": [
        "cards-downloads"
      ],
      "defaultContent": []
    },
    {
      "id": "5",
      "name": "sidebar",
      "selector": [
        "main .o-container__content > .row > .col-12.col-md-4.col-lg-3"
      ],
      "style": "sidebar",
      "blocks": [
        "cards-latest-news"
      ],
      "defaultContent": [
        ".c-contact"
      ]
    }
  ]
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
