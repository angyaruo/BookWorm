# BookWorm 2.2

Your miniature literary companion, now with a real dictionary on the shelf.
Buggy lives on your Lumiverse composer and opens a forest-green, paper-lined
writing desk: quiet book-opening/page-turn animations, readable answers, and
one very reasonable fee. A leaf.

## The writing desk

| Tool | How it works |
| --- | --- |
| Thesaurus | Bundled English dictionary: definitions, synonyms, antonyms, examples and related words, grouped by sense. No model, API key, or generation. Click a related word to explore it. |
| Tip of tongue | Describe a meaning; your selected model suggests matching words. |
| Research | Model-assisted facts and terminology, optionally grounded in explicit online searches with real source links. |
| Consultant | Story suggestions using your question and a bounded excerpt of recent visible chat messages. |
| Translator | Literary translation preserving voice and subtext. Include the target language in your request. |

The English library includes approximately 127,000 headwords and phrases from
Open English WordNet 2025. It recognizes common inflections and suggests nearby
spellings when a word is missing. Coverage is not exhaustive; examples and
antonyms appear only where the source supplies them. It never falls back to AI.
See [data provenance, license, and rebuild instructions](data/README.md).

## Buggy in the margins

With the book closed, highlight a word in a chat message for a local English
definition, or in the native composer for definitions and clickable synonyms.
A small helper opens near Buggy without taking keyboard focus. Synonyms are
grouped by meaning; check inflection before using one. Clicking Buggy while
the helper is open focuses its additional tools. **Open writing desk** returns
to the full book. Escape or the × dismisses the helper.

Highlight a phrase or passage to **Explain meaning**, **Translate**, **Polish
draft**, or give a **Custom rewrite** direction. For example, “a weary cowboy
telling the story.” AI actions use your selected writing model and current
timeout/output settings. No model or online search runs just from highlighting.
Only the captured passage and your direction are sent to the writing model;
surrounding private chat/draft text is not added. Local dictionary lookups still
go through your Lumiverse server, not an external dictionary service.

For a composer selection, Translate, Polish, and Custom rewrite replace **only
that selection** after a complete response, with **Undo replacement**. The
original draft remains untouched while the response streams. BookWorm never
sends the chat message. Read the result before sending it yourself. If you edit
the draft, change chats, start IME composition, stop the request, or receive a
reported partial/filtered response, BookWorm will not apply it. Stale draft
results remain as a copyable preview; changing chats cancels pending work.
Undo also refuses to overwrite intervening edits, and lasts only while that
helper remains open. Providers cannot always report truncation reliably, so
always review the replacement. Selections are limited to 20,000 characters.

Selection assistance is enabled by default and can be turned off in **Book
settings → Selection companion**. The helper follows Paper/Dark/System theme.
It targets Lumiverse's native `textarea[name="chat-message"]`, not extension
editors. Selection answers and rewrite drafts are transient, not added to your
saved search history.

## Optional online research

**Look this up online…** is available on the AI writing-desk tabs, including
after an unsuccessful answer. **Search online…** also appears in the selection
helper. Enter short search terms yourself; long selections are never silently
used as search queries. Search alone returns up to five clickable, host-provided
source links and snippets and uses **no model**. It leaves existing answers and
your draft unchanged, including when permission, configuration, or upstream
search fails.

In Research, **Search before answering** explicitly opts the next question into
web-grounded generation. Fill in the separate search-terms field, then Ask
Buggy. Your model receives your question and bounded source snippets, with
numbered references and genuine source cards below its answer. Only the search
terms go to the search provider. This option resets when changing tabs or
reopening the book; it is never enabled automatically. Saved Research answers
retain their source cards. Search snippets are not full-page verification and
can be incomplete or wrong: open the links to check lore and consequential facts.

Setup: update BookWorm, grant **Web Search** in Lumiverse **Settings → Extensions**,
and enable/configure a provider under **Settings → Web Search**. BookWorm uses
Lumiverse's host-backed `webSearch.query` directly, so **model function calling
does not need to be enabled**. It uses the host's configured SearXNG, Exa, or
Tavily provider (depending on your Lumiverse version); it never reads API keys
or supplies its own endpoint. Search requires internet and may incur provider
costs. Denying this permission does not change the offline thesaurus or ordinary
AI tools. Older hosts without this API get an actionable error only when searching.

Searches use `scrape: false` for quick snippets, a 500-character query limit and
bounded results. Standalone searches have a 45-second backend deadline; grounded
Research shares the configured AI deadline. Closing/changing tools cancels the
local wait and ignores late replies, but the host may still finish or bill its
upstream search. Remote content is treated as untrusted evidence, never as
instructions. BookWorm does not try to automatically classify “invalid answers”:
a model can sound confident and still be wrong, so research is an explicit choice.

Host API references: [Web Search](https://docs.lumiverse.chat/backend-api/web-search/)
and [Generation](https://docs.lumiverse.chat/backend-api/generation/).

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
| Standard | Tip of tongue: 1,200; Research: 2,400; Consultant: 1,800; Translator/rewrite: 4,096; selection explanation: 1,600 output tokens |
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
- **Appearance** in Book settings offers Paper (the original/default), Dark
  (a midnight-green library), or Follow system. The choice is saved in this
  browser and changes only BookWorm, not the surrounding Lumiverse theme.
- **Saved searches** in Book settings accepts any whole number from 1 to 50
  (default: 5). Recent questions retains each search and its full result, including
  dictionary meanings, examples and related words or the original AI answer.
  Reopening a saved entry makes no dictionary/model request and preserves your
  chat draft. Repeating the same query in the same tool replaces its old entry;
  different tools keep separate entries. Partial-answer warnings are retained.
- Lowering the history limit removes the oldest entries; raising it cannot
  recover previously removed results. Existing 2.0 history/settings are kept.
  History persists across book closures and page reloads via browser local
  storage. If storage is blocked/full, results remain available for the current
  session and a warning explains that they could not be saved.
- Preferences/history are local to this browser and site address, not synced
  across devices or between HTTP/HTTPS addresses. There is no separate BookWorm
  analytics or cloud history service. Avoid sensitive queries on shared browser
  profiles. AI requests still go through your selected provider.
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
Appearance/history checks cover migration, reload persistence, system-theme
changes, input validation, retention/eviction, reopening without requests,
storage quota failures, and dark desktop/mobile screenshots.
Selection/search checks cover Unicode selections, real offline meanings,
HTTP desktop/mobile viewports, selected-range replacement, native input events,
Undo, edited drafts, chat-scope changes, IME, truncated responses, cancellation,
explicit query privacy, source escaping, permission/configuration failures,
search cancellation and source-bearing history. Model/search responses in the
browser harness are simulated; no paid provider calls are made by the tests.

Lexical data attribution and license are in [data/README.md](data/README.md) and
`licenses/`. Bundled mascot images are the existing BookWorm sprites, moved from
their original hosted URLs into the extension; no new art license is asserted.
