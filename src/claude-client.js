// ============ Claude Client — Anthropic SDK Wrapper ============
//
// Thin wrapper around @anthropic-ai/sdk. Centralizes:
//   - model routing (defaults to CLAUDE_MODEL env)
//   - system prompt handling
//   - token accounting (for v1 metering)
//   - retry on transient errors (429/503/529)
//
// Future: multi-provider routing layer sits HERE (Claude -> free-tier
// -> self-hosted) per the core pitch. v0.3 is Claude-only for simplicity.
// ============

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-5-20250929';

// Rolling token accounting (v1 metering reads this).
let usage = { input: 0, output: 0, calls: 0 };

export function getUsage() {
  return { ...usage };
}

export function resetUsage() {
  usage = { input: 0, output: 0, calls: 0 };
}

/**
 * Call Claude with retry on transient failures.
 * Returns: { text, model, usage }
 */
export async function chat({
  system,
  messages,
  model = DEFAULT_MODEL,
  maxTokens = 1024,
  temperature = 0.7,
}) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.messages.create({
        model,
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
        usage.input += response.usage.input_tokens;
        usage.output += response.usage.output_tokens;
        usage.calls += 1;
      }
      return { text, model: response.model, usage: response.usage };
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

export const MODELS = {
  default: DEFAULT_MODEL,
  haiku: HAIKU_MODEL,
  sonnet: SONNET_MODEL,
};
