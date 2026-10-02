# beach-simple-examples

Small, self-contained scripts that show how the routing primitives in
[`@cool-ai/beach-core`](https://www.npmjs.com/package/@cool-ai/beach-core) work.
They need no LLM, API keys or config files: each one wires things up in code,
prints what happens to the console and exits.

## Requirements

- Node.js 20+
- npm

## Setup

```bash
npm install
```

## Running the examples

| Command            | File                                                     | What it shows |
| ------------------ | -------------------------------------------------------- | ------------- |
| `npm run router`   | [examples/router-demo.ts](examples/router-demo.ts)       | `EventRouter` basics |
| `npm run channels` | [examples/channels-demo.ts](examples/channels-demo.ts)   | `ChannelRouter` in front of an `EventRouter` |
| `npm run all`      | —                                                        | Runs both, one after the other |

`npm run typecheck` type-checks the examples with `tsc`.

You can also run a single file directly with `npx tsx examples/<file>.ts`.

### `router-demo.ts`: EventRouter

The `EventRouter` is two lookup tables plus dispatch:

- **Handlers:** name → function, filled by `router.register()`.
- **Rules:** `(source, eventType)` → handler names, filled by `router.loadRoutingConfig()`.

`routeEvent()` finds the rule that matches the event and calls every handler
the rule names. The demo covers:

- a handler that routes a new event instead of calling another handler directly,
- fan-out, where one event goes to two handlers in parallel,
- `drain()`, which waits for in-flight handlers to finish (`routeEvent` returns as soon as the event is accepted),
- `RouteNotFoundError` when no rule matches.

### `channels-demo.ts`: ChannelRouter + EventRouter

```
outside world ──► ChannelRouter ──► EventRouter ──► handler
     ▲                │
     └── adaptor ◄────┘
```

- `ChannelRouter.inbound()` picks the adaptor by `channelId`, maps `threadId`
  to a session and remembers that session's `destinations`. It then routes a
  `session:request` event that carries no channel information.
- The handler sees only `{ sessionId, parts }`, so it cannot tell chat from SMS.
  It replies by routing a `session:reply` event.
- `session:reply` is routed to the `upstream` handler, which the
  `ChannelRouter` registers itself. `upstream` sends the reply through each
  destination's adaptor.

The demo covers:

1. a chat message in, and the reply going back out on chat,
2. a second message on the same thread, which reuses the same session,
3. an SMS message in, with the reply going to **both** SMS and chat,
4. an unknown channel being rejected before any event is routed.

## Project layout

```
examples/        demo scripts, run with tsx
package.json     npm scripts and dependencies
tsconfig.json    strict TypeScript, NodeNext modules, no emit
```
