import type { OperationResult } from "../electron-api.js";

export class ExternalNavigationService {
  constructor(private readonly openUrl: (url: string) => Promise<void>) {}

  /**
   * `allowLoopbackHttp` is for sign-in pages of MCP servers running on this
   * machine, which connections may use over plain HTTP.
   */
  async open(
    url: string,
    options: { allowLoopbackHttp?: boolean } = {},
  ): Promise<OperationResult> {
    try {
      const parsed = new URL(url);
      const loopbackHttp =
        options.allowLoopbackHttp === true &&
        parsed.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !loopbackHttp) {
        return { success: false, error: "Only HTTPS URLs may be opened" };
      }
      await this.openUrl(parsed.toString());
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
