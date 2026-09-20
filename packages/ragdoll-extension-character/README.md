# @vokality/ragdoll-extension-character

First-party character extension for Ragdoll. It contributes the tools an agent
uses to drive the character's face and head:

| Tool                | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `setMood`           | Set a named mood                                              |
| `setExpression`     | Patch facial axes on top of the mood                          |
| `resetExpression`   | Hand patched axes back to the mood                            |
| `triggerAction`     | Play a wink, talk, or shake                                   |
| `clearAction`       | Stop the running action early                                 |
| `setHeadPose`       | Rotate the head                                               |
| `getCharacterState` | Read the mood, action, head pose in degrees, and patched axes |

Requires the `ipc` and `timers` host capabilities.

## Host contract

The character is rendered elsewhere (in Lumen, the chat renderer), so every
tool forwards a `CharacterCommand` on `extension-tool:character`. A host parses
the forwarded call with `parseCharacterCommand(tool, args)`; the argument shapes
and ranges are declared once, here.

`getCharacterState` forwards a command carrying a `requestId`. The host answers
by publishing `{ requestId, state: CharacterStateSnapshot }` on
`CHARACTER_STATE_TOPIC` (`character:state`). The read travels the same ordered
route as the commands, so it reflects every command issued before it. Without a
reply within two seconds the tool reports that the character is not on screen.
