/* eslint-disable */
/* global WebImporter */
// Generated import script for template "homepage" (1 URLs in page-templates.json).

import carouselHeroParser from './parsers/carousel-hero.js';
import cardsTeaserParser from './parsers/cards-teaser.js';
import widgetSharePriceParser from './parsers/widget-share-price.js';
import columnsVideoParser from './parsers/columns-video.js';
import cardsStatsParser from './parsers/cards-stats.js';

import continentalCleanupTransformer from './transformers/continental-cleanup.js';
import continentalSectionsTransformer from './transformers/continental-sections.js';
import continentalPressMetadataTransformer from './transformers/continental-press-metadata.js';

const parsers = {
  'carousel-hero': carouselHeroParser,
  'cards-teaser': cardsTeaserParser,
  'widget-share-price': widgetSharePriceParser,
  'columns-video': columnsVideoParser,
  'cards-stats': cardsStatsParser,
};

const PAGE_TEMPLATE = {
  "name": "homepage",
  "description": "Corporate homepage: hero, teasers, share price, stats, promos",
  "urls": [
    "https://www.continental.com/en/"
  ],
  "blocks": [
    {
      "name": "carousel-hero",
      "instances": [
        ".c-heroteaser-fixed"
      ]
    },
    {
      "name": "cards-teaser",
      "instances": [
        ".o-container .o-container__content > .row:not(.o-container__header):has(a.c-teaser):not(:has(iframe))",
        ".o-container .o-container__content > .row:not(.o-container__header):has(iframe) > div:has(a.c-teaser)"
      ]
    },
    {
      "name": "widget-share-price",
      "instances": [
        ".o-page__ce:has(iframe[src*=\"equitystory\"])"
      ]
    },
    {
      "name": "columns-video",
      "instances": [
        ".o-container.is-pastel-yellow .o-container__content > .row:not(.o-container__header)"
      ]
    },
    {
      "name": "cards-stats",
      "instances": [
        ".o-container .o-container__content > .row:not(.o-container__header):has(.c-fact-box)"
      ]
    }
  ],
  "sections": [
    {
      "id": "1",
      "name": "hero-slider",
      "selector": [
        ".c-heroteaser-fixed"
      ],
      "style": null,
      "blocks": [
        "carousel-hero"
      ],
      "defaultContent": []
    },
    {
      "id": "2",
      "name": "welcome-annual-report-share-price",
      "selector": [
        "main > .o-container:nth-of-type(2)",
        ".o-container.has-columns:has(iframe[src*=\"equitystory\"])"
      ],
      "style": "teaser-widget",
      "blocks": [
        "cards-teaser",
        "widget-share-price"
      ],
      "defaultContent": [
        ".o-container__header"
      ]
    },
    {
      "id": "3",
      "name": "tires-garage-video",
      "selector": [
        ".o-container.is-pastel-yellow"
      ],
      "style": "pastel-yellow",
      "blocks": [
        "columns-video"
      ],
      "defaultContent": [
        ".o-container__header"
      ]
    },
    {
      "id": "4",
      "name": "career",
      "selector": [
        "main > .o-container:nth-of-type(4)"
      ],
      "style": null,
      "blocks": [
        "cards-teaser"
      ],
      "defaultContent": [
        ".o-container__header"
      ]
    },
    {
      "id": "5",
      "name": "sustainability-stats",
      "selector": [
        ".o-container.has-image:has(.c-fact-box)"
      ],
      "style": "background-image",
      "blocks": [
        "cards-stats"
      ],
      "defaultContent": [
        ".o-container__header"
      ]
    },
    {
      "id": "6",
      "name": "facts-and-figures",
      "selector": [
        "main > .o-container:nth-of-type(6)"
      ],
      "style": null,
      "blocks": [
        "cards-teaser"
      ],
      "defaultContent": [
        ".o-container__header"
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
