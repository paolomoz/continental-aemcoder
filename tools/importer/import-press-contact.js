/* eslint-disable */
/* global WebImporter */
// Generated import script for template "press-contact" (43 URLs in page-templates.json).



import continentalCleanupTransformer from './transformers/continental-cleanup.js';
import continentalSectionsTransformer from './transformers/continental-sections.js';
import continentalPressMetadataTransformer from './transformers/continental-press-metadata.js';

const parsers = {

};

const PAGE_TEMPLATE = {
  "name": "press-contact",
  "description": "Shared spokesperson contact fragments (/en/press/fragments/contacts/*)",
  "urls": [
    "https://www.continental.com/en/press/press-releases/-20241029-remondis-sachsen/#contact=1",
    "https://www.continental.com/en/press/press-release/20230509-sportcontact-7/#contact=1",
    "https://www.continental.com/en/press/press-releases/2021-01-18-contionlinecontact/#contact=1",
    "https://www.continental.com/en/press/press-releases/2021-01-12-ces-2021/#contact=1",
    "https://www.continental.com/en/press/press-releases/20240131-mercedes-e-class/#contact=1"
  ],
  "blocks": [],
  "sections": []
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
