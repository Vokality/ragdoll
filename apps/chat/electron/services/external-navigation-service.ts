import type { OperationResult } from "../electron-api.js";

export class ExternalNavigationService {
  constructor(private readonly openUrl: (url: string) => Promise<void>) {}

  async open(url: string): Promise<OperationResult> {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return { success: false, error: "Only HTTPS URLs may be opened" };
    }
    await this.openUrl(parsed.toString());
    return { success: true };
  }
}
