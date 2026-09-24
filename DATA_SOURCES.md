# Dictionary data attribution

The extracted dictionary text and adaptations in `data/dictionary-*.json` are distributed under **Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0)**.
License: https://creativecommons.org/licenses/by-sa/4.0/

## Sources

- Mongolian Wiktionary contributors, https://mn.wiktionary.org/. Retrieved through the public MediaWiki API. Each record preserves its source revision ID and permanent revision URL, providing the source page and attribution history.
- English Wiktionary contributors, Mongolian entries: https://en.wiktionary.org/. Machine-readable extraction by **Kaikki / Wiktextract**, https://kaikki.org/dictionary/Mongolian/index.html. Kaikki's September 2026 snapshot was downloaded from its published JSONL link. Source language is `en` and English definitions remain explicitly labeled in the application. Kaikki extraction software: https://github.com/tatuylonen/wiktextract.

Changes: wikitext markup removed, explicitly defined compounds and idioms extracted into separate records, duplicate meanings merged, machine-readable fields and category labels added. The scripts do not translate or invent source definitions. Category classifications are navigation aids, not expert validation. The source sites may contain errors or incomplete content.

Reuse of this extracted dataset or adaptations must retain appropriate credit, indicate modifications, link to this license, and comply with ShareAlike. No additional restrictions are applied. Attribution and license links are visible in the website footer; every source record contains a source link.

The small editorial starter set in `lib/seed.ts` is separate, labeled `editorial`, and has not received expert review. Live AI explanations and newly composed examples are displayed as AI output and are never silently added to the sourced dataset.

## Updating

1. `python scripts/fetch-dictionary.py /path/to/wiki-cache` fetches public source revisions with a modest concurrency limit and resumable batches.
2. Download the published Mongolian JSONL file linked from Kaikki's Mongolian index page.
3. `python scripts/build-dictionary.py /path/to/wiki-cache /path/to/mn-kaikki.jsonl` rebuilds shards and actual-count metadata.
4. Review changes, run `npm test` and `npm run build`, then commit the resulting data. Source text changes are not automatically certified correct.
