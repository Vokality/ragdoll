# @vokality/ragdoll-extension-working-list

A short, ranked working set (at most five items) that the agent fills after using
tools or MCP connections, then shows with `lumen_open_card`. The list is a
snapshot of current work, not a live inbox.

State is a Zod-validated document. Mutations write storage first, then update
the slot. Selecting an item publishes `list.item.selected` so the agent can
continue with that row. Clearing the list does not call remote tools.
