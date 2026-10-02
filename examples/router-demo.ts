/**
 * Minimal EventRouter demo: two lookup tables and dispatch.
 *
 *   Table 1 (handlers): name → function           — filled by router.register()
 *   Table 2 (rules):    (source, eventType) → names — filled by router.loadRoutingConfig()
 *
 * routeEvent() finds the rule matching the event's (source, eventType), then calls
 * every handler named in that rule's `to` list.
 *
 * Run: npm run router
 */
import { EventRouter, type EventHandler } from '@cool-ai/beach-core';

const router = new EventRouter({
  onHandlerError: ({ component, error }) => console.error(`[error] ${component}: ${error.message}`),
});

// ── Table 1: named handlers ──────────────────────────────────────────────────
const greeter: EventHandler = async (event, context) => {
  const { name } = event.data as { name: string };
  console.log(`greeter got ${event.source}:${event.eventType}`, event.data);
  // A handler never calls another handler directly — it routes a new event.
  await context.routeEvent({ source: 'demo', eventType: 'greeted', data: { text: `Hello, ${name}!` } });
};

const printer: EventHandler = async (event) => {
  console.log('printer:', (event.data as { text: string }).text);
};

const auditor: EventHandler = async (event) => {
  console.log('auditor saw:', `${event.source}:${event.eventType}`);
};

router.register('greeter', greeter);
router.register('printer', printer);
router.register('auditor', auditor);

// ── Table 2: routing rules (same shape as config/routing.json) ───────────────
router.loadRoutingConfig({
  rules: [
    { source: 'demo', eventType: 'hello', to: [{ handler: 'greeter' }] },
    // Fan-out: one event, two targets, dispatched in parallel.
    { source: 'demo', eventType: 'greeted', to: [{ handler: 'printer' }, { handler: 'auditor' }] },
  ],
});

// ── Dispatch ─────────────────────────────────────────────────────────────────
// demo:hello → greeter → (routes demo:greeted) → printer + auditor
await router.routeEvent({ source: 'demo', eventType: 'hello', data: { name: 'Ana' } });

// Handlers are non-blocking: routeEvent returns once the event is accepted.
// drain() waits for in-flight handlers to finish.
await router.drain();

// No rule for demo:goodbye → RouteNotFoundError.
try {
  await router.routeEvent({ source: 'demo', eventType: 'goodbye', data: {} });
} catch (err) {
  console.log('no rule →', err instanceof Error ? `${err.constructor.name}: ${err.message}` : err);
}
