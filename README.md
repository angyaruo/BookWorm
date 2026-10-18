# BookWorm 2.0

Your miniature literary companion, now with a real dictionary on the shelf.
Buggy lives on your Lumiverse composer and opens a forest-green, paper-lined
writing desk: quiet book-opening/page-turn animations, readable answers, and
one very reasonable fee. A leaf.

## The writing desk

| Tool | How it works |
| --- | --- |
| Thesaurus | Bundled English dictionary: definitions, synonyms, antonyms, examples and related words, grouped by sense. No model, API key, or generation. Click a related word to explore it. |
| Tip of tongue | Describe a meaning; your selected model suggests matching words. |
| Research | Model-assisted facts and terminology for fiction. Verify consequential claims; this is not web search. |
| Consultant | Story suggestions using your question and a bounded excerpt of recent visible chat messages. |
| Translator | Literary translation preserving voice and subtext. Include the target language in your request. |

The English library includes approximately 127,000 headwords and phrases from
Open English WordNet 2025. It recognizes common inflections and suggests nearby
spellings when a word is missing. Coverage is not exhaustive; examples and
antonyms appear only where the source supplies them. It never falls back to AI.
See [data provenance, license, and rebuild instructions](data/README.md).

## Install or update

1. In Lumiverse, open **Settings → Extensions** and install from
   `https://github.com/angyaruo/BookWorm`.
2. When updating from 1.x, use Lumiverse's extension update/reinstall flow so the
   new manifest seeds the dictionary into storage. Replacing just the JavaScript
   files is not sufficient.
3. Open a chat and click Buggy above the composer. Thesaurus is the default tab.
4. For AI tools, choose a model under **Book settings** in the header.

Requires a Lumiverse version supporting Spindle `storage_seed_files` and
`storage.read`. The repository includes built JavaScript and lexical data;
users do not need to run npm to install it. Installation is larger than 1.x
(about 26 MiB of uncompressed dictionary data, plus code and mascot art).

The dictionary and Buggy's sprites are bundled, with no external runtime asset
requests. **Offline** means no online dictionary or AI provider: a local
Lumiverse installation works without the internet after installation. A remote
Lumiverse installation still needs a connection to its server. First lookups
load data from that server's storage; repeat lookups are cached.

## Longer answers, without losing partial work

AI tools use Lumiverse's direct quiet-generation path, outside chat history.
Operator-scoped requests retain the required `userId`. Streaming appears as it
arrives; platforms without `quietStream` use quiet generation instead.

| Setting | Output budget / behavior |
| --- | --- |
| Standard | Tip of tongue: 1,200; Research: 2,400; Consultant: 1,800; Translator: 4,096 output tokens |
| Extended answers | Up to 8,192 output tokens; may increase latency and provider cost |
| Time to wait | 2, 3 (default), or 5 minutes |

Provider/model limits still apply; these settings cannot override them. BookWorm
shows a warning when the provider reports a token limit and keeps text already
received on timeout, cancellation, or stream failure. **Stop** cancels the active
request. Changing tools or closing the book also cancels; stale replies cannot
overwrite a new page. Some providers may continue processing/billing despite
cancellation. There is no automatic retry that could incur duplicate charges.

## Small comforts

- Switching tools clears both the question and answer.
- The last five answers are saved in this browser's local storage; no separate
  BookWorm analytics or cloud history service is used. Avoid sensitive queries
  on shared browser profiles. AI requests still go through your selected provider.
- Copy an answer, or inscribe it after your existing composer draft.
- Headings, blockquotes, lists, emphasis, inline code and fenced code render as
  safe Markdown. Raw HTML is escaped. This is a lightweight Markdown subset,
  not a complete CommonMark renderer.
- Buggy cycles through 20 greetings/thoughts/insect facts when opened. Clicking
  him gives him a leaf: the munching sprite remains until the book closes.
  Hovering does not cycle sprites.
- Responsive layout, keyboard-accessible tabs, Escape to close, and support for
  the system's reduced-motion preference. Enter searches the dictionary;
  Ctrl/Command + Enter asks the model; Shift + Enter inserts a line break.

## Development and checks

Node.js 22+:

```sh
npm ci
npm run build
npm test
npm run test:ui
npm run preview
```

Edit `src/`, then commit rebuilt `dist/` for direct installation. The UI suite
uses headless Microsoft Edge on Windows or Playwright Chromium elsewhere
(`npx playwright install chromium` if needed). `BOOKWORM_BROWSER` can select an
explicit test browser executable. It launches a fresh temporary profile, not
your browsing session. Screenshots go to ignored `work/screenshots/`.

The preview runs at `http://127.0.0.1:4173`, uses the real local dictionary and
clearly labeled **simulated** model responses. Tests cover the corpus, lookup,
operator scope, limits, timeout/cancellation, tab resets, Markdown, Buggy,
history, preserving composer drafts, mobile layout, and cleanup. They do not
replace a live Lumiverse install/update test with your particular provider.
Submission tests also run every tool via buttons and keyboard on a non-loopback
HTTP origin at desktop and mobile widths. Request IDs work on HTTP LAN addresses
as well as HTTPS/localhost; they do not require `crypto.randomUUID`.

Lexical data attribution and license are in [data/README.md](data/README.md) and
`licenses/`. Bundled mascot images are the existing BookWorm sprites, moved from
their original hosted URLs into the extension; no new art license is asserted.
