# @vokality/ragdoll-extension-character

First-party character extension for the Ragdoll ecosystem. It contributes
`setMood`, `triggerAction`, and `setHeadPose` tools and forwards them over the
host `ipc` capability on `extension-tool:character`.

Requires the `ipc` host capability. Lumen grants that capability and routes
tool messages into the chat renderer character.
