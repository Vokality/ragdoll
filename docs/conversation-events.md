# Conversation events

## Purpose

Conversation events let an extension add a durable, agent-visible fact to the
canonical conversation. An extension can either record the fact for a future
turn or request immediate agent evaluation.

This is a host capability. Extensions publish events; they do not write storage,
invoke the model, or communicate with the renderer directly.

## Contract

```ts
type EventTurnPolicy = "record-only" | "start-turn";

interface ConversationEventInput {
  type: string;
  payload: Record<string, JsonValue>;
  turnPolicy: EventTurnPolicy;
  deduplicationKey?: string;
}
```

The extension supplies the event type, JSON payload, turn policy, and optional
deduplication key. Core supplies the event ID, source extension ID, and
timestamp. Event types are local to their source extension; the stored source
identity prevents collisions and spoofing.

`record-only` and `start-turn` have deliberately narrow meanings:

| Policy        | Required core behavior                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `record-only` | Append the event to the conversation and stop. The event is available as context on the next turn. |
| `start-turn`  | Append the event and a pending agent-turn job in one durable update, then schedule evaluation.     |

The turn policy does not control visibility. Extension events are always
internal. It also does not control the agent's response. An event-triggered turn
must finish with one of these outcomes:

```ts
type EventTurnOutcome =
  { disposition: "silent" } | { disposition: "respond"; content: string };
```

Only a `respond` outcome creates a visible assistant message.

## Ownership and data flow

1. The extension calls `host.conversationEvents.publish()`.
2. The extension manager binds the call to the calling extension's identity.
3. The conversation event service validates and durably appends the event.
4. For `start-turn`, the same storage update appends a pending turn job.
5. The agent-turn coordinator serializes the job with all other turns.
6. The context builder converts the ordered conversation entries into model
   input. Event payloads are represented as data inside a core-authored envelope.
7. The agent explicitly chooses `silent` or `respond`.
8. Core atomically completes the pending job and, for `respond`, appends the
   assistant message.
9. The renderer receives only the visible user/assistant projection.

The Electron main process is the sole conversation writer. Renderer APIs are
command-oriented: send one user message, clear the conversation, fetch the
visible projection, and subscribe to projection changes. The renderer never
sends or saves authoritative conversation history.

## Durability and ordering invariants

- An accepted event is persisted before `publish()` resolves.
- A `start-turn` event and its pending job are committed together.
- A deduplication key is unique within its source extension.
- User turns and event turns never execute concurrently.
- A pending event job is removed in the same update that stores its outcome.
- Failed event turns remain pending and can be resumed after restart.
- Clearing the conversation clears both entries and pending turns.
- Internal events are never exposed through the renderer conversation DTO.

## Extension permissions

An extension must declare `conversationEvents` in `requiredCapabilities`.
Hosts that do not provide the capability reject the extension during loading.
The host validates every request at runtime and controls model configuration,
conversation ownership, scheduling, persistence, and presentation.

## Pomodoro behavior

The Pomodoro extension publishes `timer.completed` for completed focus and
break phases with `turnPolicy: "start-turn"`. Desktop notifications remain a
separate presentation concern. The event turn decides whether an additional
assistant message is useful.

## Acceptance criteria

- Any permitted extension can publish either turn policy through the typed host
  capability.
- Both policies create internal conversation entries visible to future model
  turns.
- Only `start-turn` schedules immediate evaluation.
- Event evaluation can finish silently or append a visible assistant response.
- Duplicate completion callbacks do not create duplicate events or turns.
- Pending event turns survive process restart.
- Pomodoro focus and break completion use the core capability.
- Type checks, package tests, chat tests, and production builds pass.
