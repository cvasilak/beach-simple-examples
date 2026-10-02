/**
 * Minimal handler demo, based on https://cool-ai.org/docs/your-first-handler
 *
 * A handler is a plain function `(event, context) => Promise<void>`: no prompt,
 * no LLM, just code. It reads `event.data`, does its work, and hands the result
 * on by routing a new event with `context.routeEvent()`. A return value would
 * not reach anyone downstream.
 *
 *   user:request_tasks → fetch-tasks → (routes tasks:fetched) → print-tasks
 *
 * Run: npm run handler
 */
import { EventRouter } from '@cool-ai/beach-core';

// Stand-in for a real database, so the demo needs no setup.
const db: Record<string, string[]> = {
  'user-42': ['Book flights', 'Renew passport'],
};

const router = new EventRouter();

// The handler: read the payload, fetch data, emit a follow-on event.
router.register('fetch-tasks', async (event, context) => {
  const { userId } = event.data as { userId: string };
  const tasks = db[userId] ?? [];

  await context.routeEvent({
    source: 'tasks',
    eventType: 'fetched',
    data: { userId, tasks },
  });
});

// A second handler, only here to show the emitted event arriving.
router.register('print-tasks', async (event) => {
  const { userId, tasks } = event.data as { userId: string; tasks: string[] };
  console.log(`tasks for ${userId}:`, tasks);
});

router.loadRoutingConfig({
  rules: [
    { source: 'user', eventType: 'request_tasks', to: [{ handler: 'fetch-tasks' }] },
    { source: 'tasks', eventType: 'fetched', to: [{ handler: 'print-tasks' }] },
  ],
});

await router.routeEvent({
  source: 'user',
  eventType: 'request_tasks',
  data: { userId: 'user-42' },
});

// routeEvent returns once the event is accepted; drain() waits for the handlers.
await router.drain();
