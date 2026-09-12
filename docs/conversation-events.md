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
  requiredToolName?: string;
  deduplicationKey?: string;
}
```

The extension supplies the event type, JSON payload, turn policy, optional
required tool name, and optional deduplication key. Core supplies the event ID,
source extension ID, and timestamp. Event types are local to their source
extension; the stored source identity prevents collisions and spoofing.

Lumen requires `type` to match `domain.event`
(`CONVERSATION_EVENT_TYPE_PATTERN` from `@vokality/ragdoll-extensions`).
`requiredToolName` is allowed only with `turnPolicy: "start-turn"` and must name
a tool owned by the publishing extension. The event turn cannot finish until
that tool succeeds.

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

## First-party behavior

- Pomodoro publishes `timer.completed` for completed focus and break phases
  with `turnPolicy: "start-turn"`. Desktop notifications remain a separate
  presentation concern.
- Flash cards publishes `review.completed` when a review finishes.
- Working list publishes `list.item.selected` with `turnPolicy: "start-turn"`
  when the user chooses a row. Filling or clearing the list does not publish.
- Tic-tac-toe publishes `game.started`, `game.reset`, `game.move`, and
  `game.ended`. User-finished games use `start-turn`; a user move can set
  `requiredToolName: "tic_tac_toe_place"` so the agent must play before the
  turn ends. Agent-finished games use `record-only`.

## Acceptance criteria

- Any permitted extension can publish either turn policy through the typed host
  capability.
- Both policies create internal conversation entries visible to future model
  turns.
- Only `start-turn` schedules immediate evaluation.
- Event evaluation can finish silently or append a visible assistant response.
- `requiredToolName` is rejected unless the policy is `start-turn` and the tool
  belongs to the source extension.
- Duplicate completion callbacks do not create duplicate events or turns.
- Pending event turns survive process restart.
- Pomodoro, flash-cards, working-list, and tic-tac-toe use the core capability.
- Type checks, package tests, chat tests, and production builds pass.

## Durable tool execution history

User and extension-event turns record app and extension tool executions in the same conversation timeline. A `tool-execution` entry contains a unique execution ID, original call ID, name, argument JSON, origin, start time, and a discriminated outcome. Before invoking a tool, the runner persists a `started` entry; after execution, it persists the JSON result and completion time before continuing.

Only user and assistant text is projected into the visible chat. Subsequent model turns receive recorded executions as assistant tool calls paired with tool result messages. Execution IDs keep these pairs unique even if a provider reuses a call ID. Past results are observations at execution time; extensions should still be read before editing current state.

A started entry without a completed result has an unknown outcome: the process may have stopped after the action ran. The model receives that uncertainty explicitly. The runner never re-executes historical calls to reconstruct context. If the start record cannot be saved, the action does not run; if saving its result fails, the turn stops and retains the unknown record.

Event records identify their trigger event. Retrying an event after a required action succeeded continues to its response/silent decision without repeating that action. An unknown required action outcome blocks automatic event retry until its state is reconciled. Clearing the conversation removes these records along with messages and queued event turns.

Existing text and extension-event conversations remain valid. Execution history begins with this implementation; it cannot recover tool calls that were never recorded. Canvas undo history remains separately owned by the extension and session-local.

## Responses message lifecycle

User turns use the Responses API with `store: false`. Each completed assistant message is persisted and published separately, retaining its optional native `phase` (`commentary`, `final_answer`, or null). Historical messages without a recorded phase keep it absent; the host does not invent one. The prompt defaults to direct answers and quick actions without a preamble. A short model-authored acknowledgment is optional for work likely to take noticeable time, such as substantial research or several tool calls; tool use alone does not require one. All visible messages originate from the model; the host never inserts canned acknowledgments or fabricates progress. Commentary never finishes the user turn: the busy indicator remains active until a final response or failure. Cancellation preserves completed messages and any current partial text without duplicating already-saved progress.

Within a turn, replay the complete message, function-call, and reasoning output items with each `function_call_output`, using `call_id` to associate results. Request encrypted reasoning so stateless follow-ups preserve model context. Extension-event turns retain explicit respond/silent decision tools and publish no unsolicited commentary. Function schemas remain non-strict at the provider boundary because extension schemas permit optional fields; the owning tool validates its arguments before acting.

See OpenAI's [function-calling guide](https://developers.openai.com/api/docs/guides/function-calling) and [assistant phase guidance](https://developers.openai.com/api/docs/guides/reasoning#phase-parameter).

## App events and personal context

Lumen also publishes host-owned `app-event` entries for `app.onboarding` and `app.focused`. They use the existing durable queue and model respond/silent decisions but have no extension identity or required extension tool; extensions cannot publish this kind. Introduction completion is persisted with its event disposition. Failed introductions remain pending for retry.

`profile` (preferred name, optional short notes, and check-in preference) and `experience` (introduction completion, first successful useful tool, focus cooldown) are separate validated storage domains outside the conversation. Clearing conversation never clears them. Settings edits use a revision check to avoid overwriting concurrent agent memories. User turns can use `lumen_update_profile`; background turns cannot write personal memory. Each turn receives the preferred name, up to 50 working facts, and a long-term summary/count as data, not instructions. Long-term facts have no count cap and are retrieved through paginated `lumen_search_memory` (10 facts per page). `lumen_update_profile` requires a memory tier for remember/move; its use action records IDs actually relied upon, not mere context exposure. Facts carry created/last-used timestamps. Working overflow archives the least recently used fact atomically. Original notes migrate to working memory with their IDs intact. Long-term content changes invalidate the summary immediately; an internal model request rebuilds it in batches of 50 with a 2000-character output limit. Summary writes compare current long-term content to the source snapshot, so concurrent edits cannot publish stale summaries. Failed generation leaves a pending summary and retries next turn without losing facts. No summary request is added to chat history. Settings preserve host-owned timestamps and use revision checks.

Native window blur/focus callbacks admit a focus event only after 15 minutes away, once per four hours, after a successful useful action, with check-ins enabled, and with no active or pending turn. Stale focus events expire after 15 minutes. Timer/focus check-ins can be disabled independently of other extension-event turns. Actual agent lifecycle events drive renderer busy state and character reactions; no assistant messages or memories are synthesized by the host.
