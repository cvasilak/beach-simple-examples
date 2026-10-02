/**
 * Minimal actor demo, based on https://cool-ai.org/docs/your-first-actor
 *
 * An actor is a model + a system prompt + a list of tools. Unlike a handler it
 * does not return free text: it must finish by calling the built-in respond()
 * tool, so its output is always typed `{ parts, conversationState }`.
 *
 *   runRespondLoop: provider → search-destinations (tool runs inline) → provider → respond()
 *
 * To keep the demo free of API keys, `fakeProvider` stands in for Claude and
 * plays a fixed script. To use a real model, see "Optional: a real LLM" below.
 *
 * Note: the docs page calls this `callActor`; in @cool-ai/beach-llm 0.8.1 it is
 * `runRespondLoop`, and the actor config type is `LLMHandlerConfig`.
 *
 * Run: npm run actor
 */
import {
  ToolRegistry,
  respondToolSnippet,
  runRespondLoop,
  type LLMHandlerConfig,
  type LLMProvider,
} from '@cool-ai/beach-llm';

// ── Tools the actor may call ─────────────────────────────────────────────────
const tools = new ToolRegistry();

tools.register({
  name: 'search-destinations',
  description: 'Search the destination database for matches by climate.',
  scope: 'generalist',
  inputSchema: {
    type: 'object',
    properties: { climate: { type: 'string', enum: ['warm', 'cold', 'mild'] } },
    required: ['climate'],
  },
  handler: async (args) => {
    const { climate } = args as { climate: string };
    console.log(`  tool search-destinations({ climate: '${climate}' })`);
    return climate === 'warm' ? ['Paxos, Greece', 'Comporta, Portugal'] : [];
  },
});

// ── The actor: model + system prompt + tools ─────────────────────────────────
const concierge: LLMHandlerConfig = {
  id: 'concierge',
  model: 'claude-haiku-4-5',
  systemPrompt: [
    respondToolSnippet,
    'You are Concierge, a friendly assistant for a travel-planning application. Reply concisely.',
  ].join('\n\n'),
  tools: ['search-destinations'], // respond() is added automatically
};

// ── A scripted stand-in for the LLM ──────────────────────────────────────────
// Turn 1: call the search tool. Turn 2 (after the tool result): call respond().
const fakeProvider: LLMProvider = {
  async complete({ messages, tools: offered }) {
    console.log(`  llm called with tools: ${offered.map((t) => t.name).join(', ')}`);
    const usage = { inputTokens: 0, outputTokens: 0 };
    const last = messages.at(-1)?.content;
    const toolResult = Array.isArray(last) ? last.find((c) => c.type === 'tool_result') : undefined;

    if (!toolResult) {
      return {
        stopReason: 'tool_use',
        toolCalls: [{ id: 'call-1', name: 'search-destinations', input: { climate: 'warm' } }],
        textBlocks: [], reasoningBlocks: [], usage,
      };
    }
    return {
      stopReason: 'tool_use',
      toolCalls: [{
        id: 'call-2',
        name: 'respond',
        input: {
          parts: [{ partType: 'response', text: `Try one of these quiet beaches: ${resultText(toolResult.content)}` }],
          conversationState: 'complete',
        },
      }],
      textBlocks: [], reasoningBlocks: [], usage,
    };
  },
};

// Tool output comes back to the model as JSON text, either bare or in text blocks.
function resultText(content: string | Array<{ type: 'text'; text: string }>): string {
  const json = typeof content === 'string' ? content : content.map((c) => c.text).join('');
  return (JSON.parse(json) as string[]).join(' or ');
}

// ── Optional: a real LLM ─────────────────────────────────────────────────────
// To call Claude instead of the script above:
//   1. npm install @anthropic-ai/sdk@^0.36.0
//   2. export ANTHROPIC_API_KEY=sk-ant-...
//   3. Uncomment the two lines below.
// createAnthropicProvider() loads the SDK and reads ANTHROPIC_API_KEY from the
// environment. The model may choose different tools and wording on each run.
let provider: LLMProvider = fakeProvider;

// import { createAnthropicProvider } from '@cool-ai/beach-llm';
// provider = await createAnthropicProvider();

// ── Invoke the actor ─────────────────────────────────────────────────────────
const result = await runRespondLoop({
  config: concierge,
  messages: [{ role: 'user', content: 'Suggest a quiet beach destination in Europe.' }],
  provider,
  registry: tools,
  sessionId: 'demo',
});

console.log('parts:', result.respond.parts);
console.log('conversationState:', result.respond.conversationState);
