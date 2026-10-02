/**
 * Minimal routing-rules demo, based on https://cool-ai.org/docs/your-first-routing-rules
 *
 * Several rules can share one (source, eventType) key. Each may carry a `when`
 * predicate over `event.data`; the router checks them in config order and the
 * first match wins. A rule with no `when` always matches, so put it last as the
 * fallback.
 *
 *   user:message ─┬─ when intent = 'search'              → search
 *                 ├─ when destination AND passengers set → book
 *                 └─ (no when)                           → default-reply
 *
 * Without the fallback, a message that matches no `when` is dropped with a
 * warning in @cool-ai/beach-core 0.13.4 (the docs page says it throws).
 * `RouteNotFoundError` is thrown only when no rule has that key at all.
 *
 * Run: npm run routing-rules
 */
import { EventRouter } from '@cool-ai/beach-core';

const router = new EventRouter();

// ── Handlers: each one just says it ran ─────────────────────────────────────
for (const name of ['search', 'book', 'default-reply']) {
  router.register(name, async (event) => {
    console.log(`  → ${name}`, event.data);
  });
}

// ── Rules: same key, checked top to bottom ──────────────────────────────────
router.loadRoutingConfig({
  rules: [
    {
      source: 'user', eventType: 'message', to: [{ handler: 'search' }],
      when: { payload: { intent: { equals: 'search' } } },
    },
    {
      source: 'user', eventType: 'message', to: [{ handler: 'book' }],
      when: {
        allOf: [
          { payload: { destination: { exists: true } } },
          { payload: { passengers: { exists: true } } },
        ],
      },
    },
    { source: 'user', eventType: 'message', to: [{ handler: 'default-reply' }] },
  ],
});

// ── Dispatch ────────────────────────────────────────────────────────────────
const messages = [
  { label: 'intent is search', data: { intent: 'search', query: 'beach holidays' } },
  { label: 'destination + passengers', data: { destination: 'Paxos', passengers: 2 } },
  { label: 'matches both; first rule wins', data: { intent: 'search', destination: 'Paxos', passengers: 2 } },
  { label: 'matches neither', data: { text: 'hello' } },
];

for (const { label, data } of messages) {
  console.log(`user:message (${label})`);
  await router.routeEvent({ source: 'user', eventType: 'message', data });
  await router.drain(); // wait for the handler, so the output stays in order
}
