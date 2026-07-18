import type { ExtensionManager } from "./extension-manager.js";
import type { RendererEventService } from "./renderer-event-service.js";

export class OAuthCallbackService {
  constructor(
    private readonly protocolScheme: string,
    private readonly extensions: ExtensionManager,
    private readonly rendererEvents: RendererEventService,
  ) {}

  async handle(url: string): Promise<void> {
    const parsed = new URL(url);
    if (
      parsed.protocol !== `${this.protocolScheme}:` ||
      parsed.host !== "oauth"
    ) {
      throw new Error(`Invalid OAuth callback URL: ${url}`);
    }
    const extensionId = parsed.pathname.slice(1);
    if (!extensionId) throw new Error("OAuth callback is missing extension id");

    const oauthError = parsed.searchParams.get("error");
    if (oauthError) {
      this.rendererEvents.oauthFailed({ extensionId, error: oauthError });
      return;
    }
    const code = parsed.searchParams.get("code");
    if (!code) throw new Error("OAuth callback is missing authorization code");

    try {
      await this.extensions.handleOAuthCallback(extensionId, code);
      this.rendererEvents.oauthSucceeded({ extensionId });
      this.rendererEvents.focus();
    } catch (error) {
      this.rendererEvents.oauthFailed({
        extensionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
