import * as os from "node:os";
import * as path from "node:path";

export const EMOTE_IPC_DIRECTORY = path.join(os.tmpdir(), "ragdoll-vscode");
export const EMOTE_SOCKET_PATH =
  process.platform === "win32"
    ? "\\\\.\\pipe\\ragdoll-emote"
    : path.join(EMOTE_IPC_DIRECTORY, "emote.sock");
