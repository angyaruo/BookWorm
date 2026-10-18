export const normalizeWord = value => String(value).normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const POS = { n: 'noun', v: 'verb', a: 'adjective', r: 'adverb' };
const RULES = {
  n: [['s', ''], ['ses', 's'], ['xes', 'x'], ['zes', 'z'], ['ches', 'ch'], ['shes', 'sh'], ['men', 'man'], ['ies', 'y']],
  v: [['s', ''], ['ies', 'y'], ['es', 'e'], ['es', ''], ['ed', 'e'], ['ed', ''], ['ing', 'e'], ['ing', '']],
  a: [['er', ''], ['est', ''], ['er', 'e'], ['est', 'e'], ['ier', 'y'], ['iest', 'y']],
};

// Reader is injected: the extension reads its installed storage, tests use disk.
export function createDictionary(read) {
  const cache = new Map();
  async function load(path) {
    if (cache.has(path)) {
      const value = cache.get(path);
      cache.delete(path); cache.set(path, value);
      return value;
    }
    const pending = Promise.resolve().then(() => read(`lexicon/${path}.json`)).then(JSON.parse);
    cache.set(path, pending);
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    try { return await pending; }
    catch (error) { cache.delete(path); throw error; }
  }
  async function refs(word) {
    const shard = /^[a-z]/.test(word) ? word[0] : '_';
    const index = await load(`index/${shard}`);
    return Object.hasOwn(index, word) ? index[word] : [];
  }
  async function suggestions(query) {
    const words = await load('words');
    const found = [];
    // Bounded edit distance; cheap length filter keeps misspelling searches fast.
    const bound = query.length > 5 ? 2 : 1;
    for (const word of words) {
      if (Math.abs(word.length - query.length) > bound) continue;
      const score = editDistance(query, word, bound);
      if (score <= bound) found.push({ word, score });
    }
    return found.sort((a, b) => a.score - b.score || a.word.localeCompare(b.word)).slice(0, 6).map(x => x.word);
  }
  return {
    async lookup(value) {
      const query = normalizeWord(value);
      if (!query || query.length > 100) throw new Error('Search an English word or short phrase (up to 100 characters).');
      const matches = [];
      const seen = new Set();
      async function add(word, pos) {
        for (const id of await refs(word)) {
          if (pos && id[0] !== pos) continue;
          const key = `${word}:${id}`;
          if (seen.has(key)) continue;
          seen.add(key); matches.push({ word, id });
        }
      }
      await add(query);
      const exceptions = await load('exceptions');
      if (Object.hasOwn(exceptions, query)) {
        for (const [word, pos] of exceptions[query]) await add(word, pos);
      }
      for (const [pos, rules] of Object.entries(RULES)) {
        // A valid exact lemma wins for its part of speech (e.g. news, not new).
        if (matches.some(match => match.word === query && match.id[0] === pos)) continue;
        for (const [ending, replacement] of rules) {
          if (query.length > ending.length + 1 && query.endsWith(ending)) {
            const stem = query.slice(0, -ending.length) + replacement;
            await add(stem, pos);
            if (pos === 'v' && /([b-df-hj-np-tv-z])\1$/.test(stem)) await add(stem.slice(0, -1), pos);
          }
        }
      }
      const entries = await Promise.all(matches.map(async ({ word, id }) => {
        const shard = await load(`senses/${id.slice(0, 3)}`);
        const sense = shard[id];
        if (!sense) throw new Error('Dictionary data is incomplete. Update or reinstall BookWorm.');
        return {
          id, word, partOfSpeech: POS[sense.pos], definition: sense.definition,
          examples: sense.examples,
          synonyms: sense.words.filter(w => normalizeWord(w) !== word),
          antonyms: [...new Set(sense.antonyms.filter(([from]) => from === word).map(([, to]) => to))],
          related: sense.related,
        };
      }));
      return { query, entries, suggestions: entries.length ? [] : await suggestions(query), source: 'Open English WordNet 2025' };
    },
  };
}

function editDistance(a, b, max) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i]; let minimum = i;
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      minimum = Math.min(minimum, row[j]);
    }
    if (minimum > max) return max + 1;
    previous = row;
  }
  return previous[b.length];
}
