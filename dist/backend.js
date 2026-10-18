// src/dictionary.js
var normalizeWord = (value) => String(value).normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").replace(/_/g, " ").replace(/\s+/g, " ").trim();
var POS = { n: "noun", v: "verb", a: "adjective", r: "adverb" };
var RULES = {
  n: [["s", ""], ["ses", "s"], ["xes", "x"], ["zes", "z"], ["ches", "ch"], ["shes", "sh"], ["men", "man"], ["ies", "y"]],
  v: [["s", ""], ["ies", "y"], ["es", "e"], ["es", ""], ["ed", "e"], ["ed", ""], ["ing", "e"], ["ing", ""]],
  a: [["er", ""], ["est", ""], ["er", "e"], ["est", "e"], ["ier", "y"], ["iest", "y"]]
};
function createDictionary(read) {
  const cache = /* @__PURE__ */ new Map();
  async function load(path) {
    if (cache.has(path)) {
      const value = cache.get(path);
      cache.delete(path);
      cache.set(path, value);
      return value;
    }
    const pending = Promise.resolve().then(() => read(`lexicon/${path}.json`)).then(JSON.parse);
    cache.set(path, pending);
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    try {
      return await pending;
    } catch (error) {
      cache.delete(path);
      throw error;
    }
  }
  async function refs(word) {
    const shard = /^[a-z]/.test(word) ? word[0] : "_";
    const index = await load(`index/${shard}`);
    return Object.hasOwn(index, word) ? index[word] : [];
  }
  async function suggestions(query) {
    const words = await load("words");
    const found = [];
    const bound = query.length > 5 ? 2 : 1;
    for (const word of words) {
      if (Math.abs(word.length - query.length) > bound) continue;
      const score = editDistance(query, word, bound);
      if (score <= bound) found.push({ word, score });
    }
    return found.sort((a, b) => a.score - b.score || a.word.localeCompare(b.word)).slice(0, 6).map((x) => x.word);
  }
  return {
    async lookup(value) {
      const query = normalizeWord(value);
      if (!query || query.length > 100) throw new Error("Search an English word or short phrase (up to 100 characters).");
      const matches = [];
      const seen = /* @__PURE__ */ new Set();
      async function add(word, pos) {
        for (const id of await refs(word)) {
          if (pos && id[0] !== pos) continue;
          const key = `${word}:${id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          matches.push({ word, id });
        }
      }
      await add(query);
      const exceptions = await load("exceptions");
      if (Object.hasOwn(exceptions, query)) {
        for (const [word, pos] of exceptions[query]) await add(word, pos);
      }
      for (const [pos, rules] of Object.entries(RULES)) {
        if (matches.some((match) => match.word === query && match.id[0] === pos)) continue;
        for (const [ending, replacement] of rules) {
          if (query.length > ending.length + 1 && query.endsWith(ending)) {
            const stem = query.slice(0, -ending.length) + replacement;
            await add(stem, pos);
            if (pos === "v" && /([b-df-hj-np-tv-z])\1$/.test(stem)) await add(stem.slice(0, -1), pos);
          }
        }
      }
      const entries = await Promise.all(matches.map(async ({ word, id }) => {
        const shard = await load(`senses/${id.slice(0, 3)}`);
        const sense = shard[id];
        if (!sense) throw new Error("Dictionary data is incomplete. Update or reinstall BookWorm.");
        return {
          id,
          word,
          partOfSpeech: POS[sense.pos],
          definition: sense.definition,
          examples: sense.examples,
          synonyms: sense.words.filter((w) => normalizeWord(w) !== word),
          antonyms: [...new Set(sense.antonyms.filter(([from]) => from === word).map(([, to]) => to))],
          related: sense.related
        };
      }));
      return { query, entries, suggestions: entries.length ? [] : await suggestions(query), source: "Open English WordNet 2025" };
    }
  };
}
function editDistance(a, b, max) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let minimum = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      minimum = Math.min(minimum, row[j]);
    }
    if (minimum > max) return max + 1;
    previous = row;
  }
  return previous[b.length];
}

// src/backend.js
var PROMPTS = {
  tot: `You help a writer recover a word from a description. Suggest 3\u20135 matching words. Give each word in bold, a short precise definition, and a one-sentence example. Distinguish meanings that differ. Be concise and skip pleasantries.`,
  research: `You are a research desk for fiction writers. Provide 3\u20135 useful, accurate facts, terms, or details relevant to the question. Be clear about uncertainty and historical context. Do not invent citations. Use readable Markdown and avoid unnecessary preamble.`,
  next_step: `You are a fiction consultant. Using the question and optional recent scene, suggest 3\u20134 distinct, actionable story beats: emotional subtext, physical action, and an unexpected source of tension or curiosity. Stay consistent with the provided characters. Use short Markdown sections or bullets.`,
  translate: `You are a literary translator. Translate the user's text into the requested language or register while preserving voice, emotion and subtext. Give the complete translation first. Add brief notes only if useful. Identify invented fantasy vernacular as invented. Do not summarize or omit passages.`
};
var TOKEN_LIMITS = { tot: 1200, research: 2400, next_step: 1800, translate: 4096 };
var TIMEOUTS = [120, 180, 300];
function cleanAnswer(text) {
  return String(text || "").replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim();
}
function abortError() {
  return Object.assign(new Error("Request stopped"), { name: "AbortError" });
}
function untilAborted(promise, signal) {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
function registerBackend(api) {
  const dictionary = createDictionary((path) => api.storage.read(path));
  const active = /* @__PURE__ */ new Map();
  const keyFor = (userId, requestId) => JSON.stringify([userId ?? "", requestId]);
  const handle = async (payload, userId) => {
    if (!payload || typeof payload !== "object") return;
    if (payload.type === "bookworm:get_connections") {
      try {
        const result = await api.connections.list(userId);
        const connections = Array.isArray(result) ? result : result?.data || [];
        api.sendToFrontend({ type: "bookworm:connections", connections: connections.map((c) => ({ id: c.id, name: c.name || c.model || "Connection" })) }, userId);
      } catch {
        api.sendToFrontend({ type: "bookworm:connections", connections: [] }, userId);
      }
      return;
    }
    const requestId = payload.requestId;
    if (typeof requestId !== "string" || !requestId || requestId.length > 150) return;
    const key = keyFor(userId, requestId);
    if (payload.type === "bookworm:cancel") {
      const request2 = active.get(key);
      if (request2) {
        request2.cancelled = true;
        request2.controller.abort();
      }
      return;
    }
    const isLookup = payload.type === "bookworm:lookup_word" || payload.type === "bookworm:consult" && payload.mode === "thesaurus";
    if (!isLookup && payload.type !== "bookworm:consult") return;
    if (active.has(key)) return;
    const mode = isLookup ? "thesaurus" : Object.hasOwn(PROMPTS, payload.mode) ? payload.mode : "tot";
    const query = typeof payload.query === "string" ? payload.query.trim() : "";
    const send = (data) => api.sendToFrontend({ type: "bookworm:result", requestId, mode, ...data }, userId);
    if (!query || query.length > (isLookup ? 100 : 2e4)) {
      send({ error: isLookup ? "Search an English word or short phrase (up to 100 characters)." : "Enter a question of up to 20,000 characters.", answer: "" });
      return;
    }
    const request = { controller: new AbortController(), cancelled: false, timedOut: false };
    active.set(key, request);
    const signal = request.controller.signal;
    const timeoutSeconds = isLookup ? 30 : TIMEOUTS.includes(payload.timeoutSeconds) ? payload.timeoutSeconds : 180;
    const timeout = setTimeout(() => {
      request.timedOut = true;
      request.controller.abort();
    }, timeoutSeconds * 1e3);
    let answer = "";
    let iterator;
    try {
      if (isLookup) {
        const lookup = await untilAborted(dictionary.lookup(query), signal);
        send({ lookup, answer: "" });
        return;
      }
      const result = await untilAborted(api.connections.list(userId), signal);
      const connections = Array.isArray(result) ? result : result?.data || [];
      const connection = payload.connectionId ? connections.find((c) => c.id === payload.connectionId) : connections.find((c) => c.is_default) || connections[0];
      if (!connection) throw new Error("Choose an available model connection in the book settings.");
      const scene = mode === "next_step" && typeof payload.sceneContext === "string" ? payload.sceneContext.slice(0, 6e3) : "";
      const input = {
        type: "quiet",
        userId,
        connection_id: connection.id,
        messages: [
          { role: "system", content: PROMPTS[mode] },
          { role: "user", content: `${scene ? `Recent scene:
${scene}

` : ""}${query}` }
        ],
        parameters: { max_tokens: payload.extendedOutput ? 8192 : TOKEN_LIMITS[mode], temperature: 0.65 },
        reasoning: { source: "off" },
        signal
      };
      let finishReason = "";
      if (typeof api.generate.quietStream === "function") {
        iterator = api.generate.quietStream(input)[Symbol.asyncIterator]();
        while (true) {
          const next = await untilAborted(iterator.next(), signal);
          if (next.done) break;
          const chunk = next.value;
          if (chunk.type === "token" && chunk.token) {
            answer += chunk.token;
            api.sendToFrontend({ type: "bookworm:result_chunk", requestId, text: chunk.token }, userId);
          } else if (chunk.type === "done") {
            if (typeof chunk.content === "string") answer = chunk.content;
            finishReason = chunk.finish_reason || "";
          }
        }
      } else {
        const result2 = await untilAborted(api.generate.quiet(input), signal);
        answer = result2?.content || "";
        finishReason = result2?.finish_reason || "";
      }
      answer = cleanAnswer(answer);
      const limited = /length|max[_ -]?tokens|token_limit/i.test(finishReason);
      const filtered = /content_filter|safety|blocked/i.test(finishReason);
      send({ answer, warning: limited ? "The model reached its output limit. Enable Extended answers in book settings, or ask for a shorter passage." : filtered ? "The provider stopped this response through its content filter." : "", error: !answer ? "The model returned no readable answer. Try another connection." : void 0 });
    } catch (error) {
      if (!signal.aborted) api.log.error("BookWorm request failed:", error);
      const reason = request.timedOut ? `The request reached the ${timeoutSeconds}-second limit. ${isLookup ? "Try updating or reinstalling the dictionary data." : "You can increase the wait in book settings."}` : request.cancelled ? "Stopped. The answer received so far is kept below." : isLookup ? "The local dictionary could not be read. Update or reinstall BookWorm to restore its bundled data." : error?.message || "Buggy could not finish this request.";
      answer = cleanAnswer(answer);
      send({ answer, ...answer ? { warning: reason } : { error: reason } });
    } finally {
      clearTimeout(timeout);
      active.delete(key);
      if (signal.aborted && iterator?.return) Promise.resolve(iterator.return()).catch(() => {
      });
    }
  };
  api.onFrontendMessage(handle);
  return handle;
}
if (typeof spindle !== "undefined") {
  registerBackend(spindle);
  spindle.log.info("BookWorm library ready.");
}
export {
  TOKEN_LIMITS,
  registerBackend
};
