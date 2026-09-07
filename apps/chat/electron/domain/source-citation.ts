import type { ToolResult } from "@vokality/ragdoll-extensions";
import type { SourceCitation } from "../electron-api.js";

export interface AgentToolResult extends ToolResult {
  sources?: SourceCitation[];
}
