// ============ Rolling Chat Context ============
//
// v0.3 in-memory rolling window per chat. Keeps the last N messages for
// multi-turn coherence without re-ingesting full chat history on every call.
//
// v0.5 replaces this with the archive.js read path — same interface, but
// messages are streamed from disk instead of held in memory.
//
// Context is keyed by chatId; each entry is an array of { role, content }
// in Anthropic SDK format.
// ============

const MAX_TURNS_PER_CHAT = parseInt(process.env.MAX_CONTEXT_TURNS || '20', 10);

const contexts = new Map(); // chatId -> [{ role, content }]

export function getContext(chatId) {
  return contexts.get(chatId) || [];
}

export function appendMessage(chatId, role, content) {
  const current = contexts.get(chatId) || [];
  current.push({ role, content });
  while (current.length > MAX_TURNS_PER_CHAT) current.shift();
  contexts.set(chatId, current);
}

export function clearContext(chatId) {
  contexts.delete(chatId);
}

export function contextSize(chatId) {
  return (contexts.get(chatId) || []).length;
}
