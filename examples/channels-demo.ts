/**
 * Minimal ChannelRouter + EventRouter demo.
 *
 *   outside world ──► ChannelRouter ──► EventRouter ──► handler
 *        ▲                │  (knows channels)  (knows source:eventType)
 *        └── adaptor ◄────┘
 *
 * - ChannelRouter.inbound() picks the adaptor by `channelId`, maps `threadId` → session,
 *   remembers the session's `destinations`, then routes a channel-blind `session:request`.
 * - The handler sees only { sessionId, text }. It replies by routing `session:reply`.
 * - `session:reply` routes to `upstream` — registered by the ChannelRouter itself —
 *   which sends the reply through each destination's adaptor.
 *
 * Run: npm run channels
 */
import { ChannelRouter, EventRouter, type ChannelAdaptor, type EventHandler } from '@cool-ai/beach-core';

// ── Adaptors: one per channel, they only know how to send ────────────────────
function consoleAdaptor(channelId: string): ChannelAdaptor {
  return {
    channelId,
    async send({ sessionId, data, metadata }) {
      const to = metadata?.to ? ` to ${String(metadata.to)}` : '';
      console.log(`  [${channelId} out${to}] (${sessionId.slice(0, 8)}) ${(data as { text: string }).text}`);
    },
  };
}

// ── The event router and a handler ───────────────────────────────────────────
const router = new EventRouter({
  onHandlerError: ({ component, error }) => console.error(`[error] ${component}: ${error.message}`),
});

const shouter: EventHandler = async (event, context) => {
  // The ChannelRouter wrapped the inbound `data` as `parts`.
  const { sessionId, parts } = event.data as { sessionId: string; parts: string };
  // Note: no channelId here — the handler cannot tell chat from sms.
  console.log(`  shouter got ${event.source}:${event.eventType}`, event.data);
  await context.routeEvent({
    source: 'session',
    eventType: 'reply',
    data: { sessionId, text: parts.toUpperCase() + '!' },
  });
};
router.register('shouter', shouter);

// ── The channel router: registers 'upstream' on the event router ─────────────
const channels = new ChannelRouter({
  router,
  adaptors: [consoleAdaptor('chat'), consoleAdaptor('sms')],
  onInboundArrival: ({ channelId, threadId, sessionId }) =>
    console.log(`  [${channelId} in] thread ${threadId} → session ${sessionId.slice(0, 8)}`),
});

// ── Rules: must come after both 'shouter' and 'upstream' are registered ──────
router.loadRoutingConfig({
  rules: [
    { source: 'session', eventType: 'request', to: [{ handler: 'shouter' }] },
    { source: 'session', eventType: 'reply', to: [{ handler: 'upstream' }] },
  ],
});

// ── Try it ───────────────────────────────────────────────────────────────────
// Hands one message to the ChannelRouter, then waits for the handlers to finish.
async function send(channelId: string, threadId: string, text: string, destinations: { channelId: string; metadata?: Record<string, unknown> }[]) {
  await channels.inbound({ channelId, threadId, raw: null, data: text, destinations });
  await router.drain();
}

console.log('1) chat in → chat out');
await send('chat', 'thread-A', 'hello', [{ channelId: 'chat' }]);

console.log('\n2) same thread again → same session');
await send('chat', 'thread-A', 'still me', [{ channelId: 'chat' }]);

console.log('\n3) sms in → reply goes to BOTH sms and chat (destinations ≠ inbound channel)');
await send('sms', 'thread-B', 'hi from my phone', [{ channelId: 'sms', metadata: { to: '+30 690 000 0000' } }, { channelId: 'chat' }]);

console.log('\n4) unknown channel → ChannelRouter rejects before any event is routed');
try {
  await send('fax', 'thread-C', 'beep', [{ channelId: 'fax' }]);
} catch (err) {
  console.log(`  ${err instanceof Error ? err.message : String(err)}`);
}
