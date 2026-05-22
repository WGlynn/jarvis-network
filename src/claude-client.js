// ============ LLM Client — Multi-Provider Router ============
//
// v0.7: routes between Anthropic and OpenRouter (free-tier / open-weights).
// env LLM_PROVIDER selects the backend. Shared `chat()` interface across
// providers — the rest of the codebase is provider-agnostic.
//
// This makes the core pitch claim real: "route across providers so we pick
// the cheapest adequate model per task instead of locking in to one
// expensive API."
//
// Supported:
//   anthropic   — @anthropic-ai/sdk (default)
//   openrouter  — openai-compatible API; free-tier models available
//   ollama      — local self-hosted via OpenAI-compatible endpoint
//
// CLAUDE_MODEL env applies to anthropic path; OPENROUTER_MODEL to openrouter.
// All paths accept a `model` override at call time.
// ============

import Anthropic from '@anthropic-ai/sdk';

const PROVIDER = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
const ANTHROPIC_DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const OPENROUTER_DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free';
const OPENROUTER_BASE = process.env.OPENROUTER_BASE || 'https://openrouter.ai/api/v1';
const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://localhost:11434/v1';
const OLLAMA_DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Rolling token accounting per provider
let usage = { anthropic: {in: 0, out: 0, calls: 0}, openrouter: {in: 0, out: 0, calls: 0}, ollama: {in: 0, out: 0, calls: 0} };

export function getUsage() {
  return JSON.parse(JSON.stringify(usage));
}

export function resetUsage() {
  for (const k of Object.keys(usage)) usage[k] = {in: 0, out: 0, calls: 0};
}

export const MODELS = {
  default: ANTHROPIC_DEFAULT_MODEL,
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  openrouter_free: OPENROUTER_DEFAULT_MODEL,
  ollama: OLLAMA_DEFAULT_MODEL,
};

// Anthropic-API model IDs are bare slugs like "claude-haiku-4-5-20251001".
// OpenRouter (and other OpenAI-compat providers) use prefixed slugs like
// "anthropic/claude-haiku-4.5" or "meta-llama/llama-3.2-3b-instruct:free".
// Caller-passed model strings that match the Anthropic-API shape are not
// valid on those providers and must be ignored in favor of the provider's
// configured default.
function looksLikeAnthropicModelId(s) {
  return typeof s === 'string' && /^claude-[a-z0-9-]+$/i.test(s);
}

// ============ Public interface ============

/**
 * Send a chat request. Dispatches by env LLM_PROVIDER.
 * Returns { text, model, usage } consistently across providers.
 */
export async function chat({
  system,
  messages,
  model,
  maxTokens = 1024,
  temperature = 0.7,
}) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (PROVIDER === 'anthropic') {
        return await callAnthropic({ system, messages, model, maxTokens, temperature });
      } else if (PROVIDER === 'openrouter') {
        // Callers often pass Anthropic-API model IDs (e.g. MODELS.haiku =
        // 'claude-haiku-4-5-20251001') that are not valid on OpenRouter,
        // which uses prefixed slugs (e.g. anthropic/claude-haiku-4.5).
        // When provider is openrouter, strip such IDs and fall through
        // to OPENROUTER_DEFAULT_MODEL so the dispatch always sends a
        // model the provider understands.
        const orModel = (model && !looksLikeAnthropicModelId(model))
          ? model
          : OPENROUTER_DEFAULT_MODEL;
        return await callOpenAICompat({
          system,
          messages,
          model: orModel,
          maxTokens,
          temperature,
          base: OPENROUTER_BASE,
          apiKey: process.env.OPENROUTER_API_KEY,
          providerTag: 'openrouter',
        });
      } else if (PROVIDER === 'ollama') {
        const ollamaModel = (model && !looksLikeAnthropicModelId(model))
          ? model
          : OLLAMA_DEFAULT_MODEL;
        return await callOpenAICompat({
          system,
          messages,
          model: ollamaModel,
          maxTokens,
          temperature,
          base: OLLAMA_BASE,
          apiKey: process.env.OLLAMA_API_KEY || 'ollama',
          providerTag: 'ollama',
        });
      } else {
        throw new Error(`Unknown LLM_PROVIDER: ${PROVIDER}`);
      }
    } catch (err) {
      lastErr = err;
      const status = err.status || err.statusCode;
      if (status === 429 || status === 503 || status === 529) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// ============ Anthropic adapter ============

async function callAnthropic({ system, messages, model, maxTokens, temperature }) {
  if (!anthropic) throw new Error('ANTHROPIC_API_KEY not set');
  const response = await anthropic.messages.create({
    model: model || ANTHROPIC_DEFAULT_MODEL,
    max_tokens: maxTokens,
    temperature,
    system,
    messages,
  });
  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');
  if (response.usage) {
    usage.anthropic.in += response.usage.input_tokens;
    usage.anthropic.out += response.usage.output_tokens;
    usage.anthropic.calls += 1;
  }
  return { text, model: response.model, usage: response.usage, provider: 'anthropic' };
}

// ============ OpenAI-compatible adapter (OpenRouter + Ollama + others) ============

async function callOpenAICompat({ system, messages, model, maxTokens, temperature, base, apiKey, providerTag }) {
  if (!apiKey) throw new Error(`API key not set for ${providerTag}`);

  // Translate Anthropic message shape to OpenAI shape:
  //   - Anthropic: system is separate param, messages are [{role: 'user'|'assistant', content}]
  //   - OpenAI: system is a message with role=system prepended to messages array
  const openaiMessages = [];
  if (system) openaiMessages.push({ role: 'system', content: system });
  for (const msg of messages) {
    openaiMessages.push({ role: msg.role, content: msg.content });
  }

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: openaiMessages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`${providerTag} HTTP ${response.status}: ${body.slice(0, 200)}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (data.usage) {
    usage[providerTag].in += data.usage.prompt_tokens || 0;
    usage[providerTag].out += data.usage.completion_tokens || 0;
    usage[providerTag].calls += 1;
  }
  return { text, model: data.model || model, usage: data.usage, provider: providerTag };
}
