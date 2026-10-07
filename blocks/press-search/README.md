# press-search

Custom **search** block. Purpose: faceted-press-search.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, one cell of content.

## Supported variations

No variations.

## Universal Editor fields

N/A (Document Authoring project)

## Config rows

Key/value table (column 1 = key, column 2 = value). Every row is optional.

| Key | Value | Default |
| --- | --- | --- |
| Index | link to the query index | `/en/press/press-index.json` |
| Page Size | number of results per page | `9` |
| Facets | comma list, in tab order: `published`, `corporate-topics`, `products-technologies`, `vehicle-types` | all four |
| Filter | `<facet>` (has any tag in the facet) or `<facet> \| <label>` (exact label, e.g. `products-technologies \| Tires`). Repeatable; all presets must match | none |
| Sort | `date-desc`, `date-asc` or `relevance` | `date-desc` (relevance when `?q=` is set and no sort was chosen) |
| Heading | text shown above the search input | none |

Results, counts and pagination are rendered at runtime from the index (rows with `template = press-release`).
View state lives in URL params, so views can be shared: `q`, `page`, `sort`, `published`
(`7d`, `30d`, `6m`, `from:yyyy-mm-dd,to:yyyy-mm-dd`) and one repeatable param per tag facet
(e.g. `corporate-topics=Business%20%26%20Finance`). The parent tag "Tires" is never offered as an
option but can be used in a Filter preset.
