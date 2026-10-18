# The offline library

BookWorm bundles a derived, indexed copy of **Open English WordNet 2025** by the
Open English Wordnet team, licensed under **CC BY 4.0**. It contains 127,311
normalized English headwords/phrases and 107,519 senses, approximately 26 MiB
uncompressed. Definitions, synonyms, lexical antonyms, examples, related words,
and inflection exceptions come from that database; they are not AI-generated.
Not every sense has every field. WordNet is a lexical database, not an exhaustive
dictionary of slang, names, specialist terminology, or other languages.

## Source and attribution

- Project/download page: https://en-word.net/downloads
- Source archive: https://en-word.net/static/english-wordnet-2025.zip
- Archive SHA-256: `38b16326159f51853626b7d24a44c453fa88ab33f06fce5ec8fc5996d1c2be93`
- License: https://creativecommons.org/licenses/by/4.0/
- Full license: [CC-BY-4.0.txt](../licenses/CC-BY-4.0.txt)
- Preserved upstream copyright/disclaimer: [WORDNET-NOTICE.txt](../licenses/WORDNET-NOTICE.txt)

The 2025 archive's WNDB headers identify a 2023 copyright; that notice is retained
verbatim, not relabeled. WordNet 3.1 attribution to Princeton University is also
preserved. Neither project endorses BookWorm. CC BY 4.0 applies to the lexical
data, not automatically to BookWorm's code or original mascot art.

## Rebuilding

Download and verify the archive above, then extract it outside the repository.
With Node.js 22 or newer, run from the repository root:

```sh
npm run build:dictionary -- /absolute/path/to/oewn2025
npm test
```

The converter reads `data.*`, `index.*` and `*.exc` in WNDB format. Modifications
made by BookWorm: normalization of headword keys; underscores converted to spaces;
adjective position markers removed from display words; glosses split into
definitions/examples; selected semantic/lexical pointers resolved into words;
indexes and synsets split into JSON shards. Sense ordering follows the upstream
indexes. Antonyms retain lexical source/target associations. Similar/also-see
terms are labeled **Related words**, not presented as interchangeable synonyms.
Other WordNet relations and verb frames are not included in this reader.

`lexicon/metadata.json` records counts, source version and input hashes. The
converter validates all index references; the tests also check every bundled
reference. Rebuilding the same source should produce identical data.

## Runtime

`spindle.json` seeds `data/lexicon/` into extension storage as `lexicon/` during
installation/update. `src/dictionary.js` reads only installed data through
`spindle.storage.read`; it never fetches a dictionary service or calls a model.
Shards are loaded on demand with a bounded cache. Common inflections resolve to
base words; unknown words get bounded edit-distance suggestions. The frontend
caches the last 20 lookups for instant repeat navigation.

Here, **offline** means no internet dictionary or AI provider is required after
installation. A locally hosted Lumiverse can serve the dictionary without the
internet; a remotely hosted Lumiverse still needs a connection to its server.
The first lookup loads local shards, so timing depends on host/storage latency.
Do not copy only `dist/` when distributing the extension: include the data,
manifest, and license files too.
