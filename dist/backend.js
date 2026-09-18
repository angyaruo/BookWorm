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
Present each option as a punchy, actionable bullet point.`
};

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
  }

  if (payload.type === 'bookworm:consult') {
    const mode = payload.mode || 'tot';
    const query = payload.query?.trim() || '';
    const requestedConnId = payload.connectionId;
    const sceneContext = payload.sceneContext?.trim() || '';

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

      const systemInstruction = MODE_PROMPTS[mode] || MODE_PROMPTS.tot;

      let userContent = `### Query:\n${query}`;
      if (mode === 'next_step' && sceneContext) {
        userContent = `### Recent Scene Context:\n${sceneContext}\n\n${userContent}`;
      }

      const messages = [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent }
      ];

      const result = await spindle.generate.quiet({
        type: 'quiet',
        userId,
        connection_id: targetConn.id,
        messages: messages,
        parameters: { max_tokens: 500, temperature: 0.7 },
        reasoning: { source: 'off' },
      });

      let cleanAnswer = (result?.content ?? '').trim();
      cleanAnswer = cleanAnswer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      cleanAnswer = cleanAnswer.replace(/^(Certainly!|Here are|Here is)[^\n]*\n+/i, '').trim();

      spindle.sendToFrontend({ type: 'bookworm:result', answer: cleanAnswer, mode }, userId);
    } catch (err) {
      spindle.log.error('BookWorm Generation Error:', err);
      spindle.sendToFrontend({
        type: 'bookworm:result',
        answer: '',
        error: err?.message || 'Failed to consult BookWorm.'
      }, userId);
    }
  }
});

spindle.log.info('BookWorm Extension Worker loaded successfully!');
