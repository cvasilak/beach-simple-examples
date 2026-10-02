# beach-simple-examples

Small, self-contained scripts that show how the routing primitives in
[`@cool-ai/beach-core`](https://www.npmjs.com/package/@cool-ai/beach-core) work.
They need no LLM, API keys or config files (the actor demo uses a scripted
fake model). Each one wires things up in code,
prints what happens to the console and exits.

## Requirements

- Node.js 20+
- npm

## Setup

```bash
npm install
```

## Running the examples

| Command                 | File                                                             | What it shows                                                |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| `npm run handler`       | [examples/handler-demo.ts](examples/handler-demo.ts)             | A handler: read the payload, route a follow-on event         |
| `npm run actor`         | [examples/actor-demo.ts](examples/actor-demo.ts)                 | An actor: model + prompt + tools, finishing with `respond()` |
| `npm run routing-rules` | [examples/routing-rules-demo.ts](examples/routing-rules-demo.ts) | Routing rules: `when` predicates, first match wins, fallback |
| `npm run router`        | [examples/router-demo.ts](examples/router-demo.ts)               | `EventRouter` basics                                         |
| `npm run channels`      | [examples/channels-demo.ts](examples/channels-demo.ts)           | `ChannelRouter` in front of an `EventRouter`                 |
| `npm run all`           | —                                                                | Runs all of them, one after the other                        |

`npm run typecheck` type-checks the examples with `tsc`.

You can also run a single file directly with `npx tsx examples/<file>.ts`.

### `handler-demo.ts`: a handler

Based on [Your First Handler](https://cool-ai.org/docs/your-first-handler). A
handler is a plain `(event, context) => Promise<void>` function, with no LLM
involved. `fetch-tasks` reads `userId` from `event.data`, looks up tasks in an
in-memory stand-in for a database, and passes the result on by routing a
`tasks:fetched` event with `context.routeEvent()`. A return value would not
reach anyone downstream. A second handler, `print-tasks`, receives that event
and prints it.

### `actor-demo.ts`: an actor

Based on [Your First Actor](https://cool-ai.org/docs/your-first-actor). An
actor is a model, a system prompt and a list of tools. It never returns free
text: it ends its turn by calling the built-in `respond()` tool, so the result
is always typed `{ parts, conversationState }`. `runRespondLoop` drives the
loop: it calls the model, runs any tool the model asks for (here
`search-destinations`), feeds the result back, and stops at `respond()`.

The model is `fakeProvider`, a scripted `LLMProvider`, so no API key is
needed. To use Claude instead, install `@anthropic-ai/sdk@^0.36.0`, set
`ANTHROPIC_API_KEY`, and uncomment the two `createAnthropicProvider` lines in
the "Optional: a real LLM" section of the file.
The docs call the entry point `callActor`; in `@cool-ai/beach-llm` 0.8.1 it is
`runRespondLoop`.

### `routing-rules-demo.ts`: routing rules

Based on [Your First Routing Rules](https://cool-ai.org/docs/your-first-routing-rules).
Three rules share the `user:message` key. The router checks them in config
order and the first one whose `when` predicate matches `event.data` wins:

- `search`, when `intent` equals `'search'` (an `equals` predicate),
- `book`, when both `destination` and `passengers` are present (`allOf` of two `exists` predicates),
- `default-reply`, with no `when`, so it catches everything else.

The demo sends four messages. One matches both of the first two rules and
goes to `search`, because that rule comes first.

Without a fallback rule, a message that matches no `when` is dropped with a
warning. The docs page says it throws, but `@cool-ai/beach-core` 0.13.4 only
throws `RouteNotFoundError` when no rule has that `source`/`eventType` at all.

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
