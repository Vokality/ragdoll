# Tic-Tac-Toe

Built-in Ragdoll extension that lets the user and agent play tic-tac-toe on a shared grid slot.

- **Tools:** `tic_tac_toe_start`, `tic_tac_toe_place`, `tic_tac_toe_get_board`
- **Slot:** 3×3 grid panel; only the user clicks cells
- **Events** (`start-turn` unless noted):
  - `game.started` / `game.reset` from panel actions
  - `game.move` after non-terminal user moves
  - `game.ended` after a win/draw (user finish → `start-turn`; agent finish → `record-only`)
- **Optional:** `canDisable: true` — toggle in settings
