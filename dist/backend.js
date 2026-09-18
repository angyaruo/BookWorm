// dist/backend.js — BookWorm Backend Worker

const MODE_PROMPTS = {
  tot: `You are the "Tip of the Tongue" assistant. The user will describe a concept, feeling, or word they cannot remember.
Identify 3 to 5 candidate words or terms that match their description.
For each candidate:
- Provide the word in **Bold**.
- Give a brief, razor-sharp 1-line definition.
- Provide a 1-line fiction roleplay example sentence demonstrating its usage.
Keep formatting clean and concise without conversational pleasantries.`,

  thesaurus: `You are an evocative creative writing thesaurus. The user provides a word, emotion, or phrase they find repetitive.
Provide 4 to 6 nuanced alternatives grouped by vibe/register (e.g., Archaic/Gothic, Sensual, Blunt, Whimsical).
Highlight subtle sensory connotations so the writer knows which tone fits best.
Do not chatter; provide direct bullet points.`,

  research: `You are a domain-specific research desk for fictional roleplay writing.
The user is asking for concrete, historically or technically accurate details to enrich their writing.
Provide 3 to 5 distinct, highly immersive, real-world or period-accurate facts, tools, steps, or terminology they can weave into their prose.
Be vivid, accurate, and concise. Avoid academic bloat.`,

  next_step: `You are a narrative roleplay consultant helping a writer overcome writer's block.
Based on the user's question and recent scene context, suggest 3 to 4 distinct, compelling, in-character action or dialogue beats.
Offer varied paths:
1. One focused on subtle character emotion/subtext.
2. One focused on physical action or interacting with the immediate environment.
3. One that injects unexpected tension, friction, or curiosity.
Present each option as a punchy, actionable bullet point.`,

  translate: `You are a literary translator for fiction and roleplay dialogue.
Translate the user's text into the requested language, historical register, cant, or fantasy vernacular while preserving voice, emotion, and subtext.
Give the translation first. Add at most two brief notes only when an idiom, cultural choice, or invented register needs explanation.
Do not add conversational pleasantries or invent details beyond the requested translation.`
};

const MODE_TOKEN_LIMITS = {
  tot: 320,
  thesaurus: 280,
  research: 380,
  next_step: 320,
  translate: 300,
};

const GENERATION_TIMEOUT_MS = 30000;
const activeRequests = new Map();

function requestKey(userId, requestId) {
  return `${userId || 'anonymous'}:${requestId}`;
}

function cleanAnswer(text) {
  return (text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^(Certainly!|Here are|Here is)[^\n]*\n+/i, '')
    .trim();
}

spindle.onFrontendMessage(async (payload, userId) => {
  if (!payload) return;

  if (payload.type === 'bookworm:get_connections') {
    try {
      const connections = await spindle.connections.list(userId);
      const rawList = Array.isArray(connections) ? connections : connections?.data ?? [];
      const list = rawList.map(c => ({ id: c.id, name: c.name || c.model || 'Connection' }));
      spindle.sendToFrontend({ type: 'bookworm:connections', connections: list }, userId);
    } catch (_) {
      spindle.sendToFrontend({ type: 'bookworm:connections', connections: [] }, userId);
    }
    return;
  }

  if (payload.type === 'bookworm:cancel') {
    const key = requestKey(userId, payload.requestId);
    activeRequests.get(key)?.abort();
    activeRequests.delete(key);
    return;
  }

  if (payload.type !== 'bookworm:consult') return;

  const mode = MODE_PROMPTS[payload.mode] ? payload.mode : 'tot';
  const query = payload.query?.trim() || '';
  const requestedConnId = payload.connectionId;
  const sceneContext = payload.sceneContext?.trim() || '';
  const requestId = payload.requestId || `${Date.now()}`;
  const key = requestKey(userId, requestId);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  activeRequests.set(key, controller);

  try {
    const connections = await spindle.connections.list(userId);
    const connArray = Array.isArray(connections) ? connections : connections?.data ?? [];

    let targetConn = null;
    if (requestedConnId) {
      targetConn = connArray.find(c => c.id === requestedConnId);
    }
    if (!targetConn) {
      targetConn = connArray.find(c => c.is_default) ?? connArray[0];
    }
    if (!targetConn) throw new Error('No connection profile available in Lumiverse settings.');

    let userContent = `### Query:\n${query}`;
    if (mode === 'next_step' && sceneContext) {
      userContent = `### Recent Scene Context:\n${sceneContext}\n\n${userContent}`;
    }

    const generationInput = {
      type: 'quiet',
      userId,
      connection_id: targetConn.id,
      messages: [
        { role: 'system', content: MODE_PROMPTS[mode] },
        { role: 'user', content: userContent }
      ],
      parameters: { max_tokens: MODE_TOKEN_LIMITS[mode], temperature: 0.65 },
      reasoning: { source: 'off' },
      signal: controller.signal,
    };

    let answer = '';
    if (typeof spindle.generate.quietStream === 'function') {
      for await (const chunk of spindle.generate.quietStream(generationInput)) {
        if (chunk.type === 'token' && chunk.token) {
          answer += chunk.token;
          spindle.sendToFrontend({
            type: 'bookworm:result_chunk',
            requestId,
            text: chunk.token,
          }, userId);
        } else if (chunk.type === 'done' && chunk.content) {
          answer = chunk.content;
        }
      }
    } else {
      const result = await spindle.generate.quiet(generationInput);
      answer = result?.content ?? '';
    }

    spindle.sendToFrontend({
      type: 'bookworm:result',
      requestId,
      answer: cleanAnswer(answer),
      mode,
    }, userId);
  } catch (err) {
    const wasAborted = err?.name === 'AbortError';
    if (!wasAborted) spindle.log.error('BookWorm Generation Error:', err);
    spindle.sendToFrontend({
      type: 'bookworm:result',
      requestId,
      answer: '',
      error: wasAborted ? 'Buggy stopped looking after 30 seconds. Try a faster model connection.' : (err?.message || 'Failed to consult BookWorm.')
    }, userId);
  } finally {
    clearTimeout(timeout);
    activeRequests.delete(key);
  }
});

spindle.log.info('BookWorm Extension Worker loaded successfully!');
