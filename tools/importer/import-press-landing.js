/* eslint-disable */
/* global WebImporter */
// Generated import script for template "press-landing" (1 URLs in page-templates.json).

import carouselHeroParser from './parsers/carousel-hero.js';
import searchBoxParser from './parsers/search-box.js';
import cardsLatestNewsParser from './parsers/cards-latest-news.js';
import cardsTeaserParser from './parsers/cards-teaser.js';
import columnsInfoboxParser from './parsers/columns-infobox.js';

import continentalCleanupTransformer from './transformers/continental-cleanup.js';
import continentalSectionsTransformer from './transformers/continental-sections.js';
import continentalPressMetadataTransformer from './transformers/continental-press-metadata.js';

const parsers = {
  'carousel-hero': carouselHeroParser,
  'search-box': searchBoxParser,
  'cards-latest-news': cardsLatestNewsParser,
  'cards-teaser': cardsTeaserParser,
  'columns-infobox': columnsInfoboxParser,
};

const PAGE_TEMPLATE = {
  "name": "press-landing",
  "description": "Press section landing: hero, featured and latest news, category entry points, media/events teasers",
  "urls": [
    "https://www.continental.com/en/press/"
  ],
  "blocks": [
    {
      "name": "carousel-hero",
      "instances": [
        "main > .c-heroteaser-fixed"
      ]
    },
    {
      "name": "search-box",
      "instances": [
        ".o-container.tx_solr .c-search:not(.c-news-sidebar .c-search) .c-search__form"
      ]
    },
    {
      "name": "cards-latest-news",
      "instances": [
        ".o-tabs .o-tabs__content-item"
      ]
    },
    {
      "name": "cards-teaser",
      "instances": [
        ".o-container.has-columns:not(.o-tabs .o-container) > .o-container__content > .row:not(.o-container__header):has(a.c-teaser)"
      ]
    },
    {
      "name": "columns-infobox",
      "instances": [
        ".o-container.is-pastel-yellow .c-media__content.is-image-intext:has(.c-media__gallery)"
      ]
    }
  ],
  "sections": [
    {
      "id": "1",
      "name": "hero-slider",
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
      "id": "2",
      "name": "intro-search",
      "selector": [
        "main > .o-container.is-white:has(> .o-container__content > .o-container__header h1)"
      ],
      "style": null,
      "blocks": [
        "search-box"
      ],
      "defaultContent": [
        ".o-container__header"
      ]
    },
    {
      "id": "3",
      "name": "quick-links",
      "selector": [
        "main > .o-container.is-white:has(.c-media__text a.c-button--internal):not(.has-columns)"
      ],
      "style": "button-row",
      "blocks": [],
      "defaultContent": [
        ".c-media__text p"
      ]
    },
    {
      "id": "4",
      "name": "press-releases-tabs",
      "selector": [
        "main > .o-container.is-lightgray:has(.o-tabs)"
      ],
      "style": "light-grey",
      "blocks": [
        "cards-latest-news"
      ],
      "defaultContent": [
        ".o-container__header"
      ]
    },
    {
      "id": "5",
      "name": "fairs-events",
      "selector": [
        "main > .o-container.is-gray.has-columns"
      ],
      "style": "grey",
      "blocks": [
        "cards-teaser"
      ],
      "defaultContent": [
        ".o-container__header"
      ]
    },
    {
      "id": "6",
      "name": "fairs-events-link",
      "selector": [
        "main > .o-container.is-gray:not(.has-columns)"
      ],
      "style": "grey",
      "blocks": [],
      "defaultContent": [
        ".c-media__text p"
      ]
    },
    {
      "id": "7",
      "name": "mobility-studies",
      "selector": [
        "main > .o-container.is-pastel-yellow"
      ],
      "style": "pastel-yellow",
      "blocks": [
        "columns-infobox"
      ],
      "defaultContent": [
        ".o-container__header"
      ]
    },
    {
      "id": "8",
      "name": "media-library",
      "selector": [
        "main > .o-container.is-white.has-columns:has(a.c-teaser[href*='/media-library/'])"
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
      "id": "9",
      "name": "press-contacts",
      "selector": [
        "main > .o-container.is-white.has-columns:has(a.c-teaser[href*='/press-contacts/'])"
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
