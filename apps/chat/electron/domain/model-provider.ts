import { z } from "zod";

export const modelProviderIdSchema = z.enum(["openai", "grok"]);
export type ModelProviderId = z.infer<typeof modelProviderIdSchema>;

export interface ModelProviderInfo {
  id: ModelProviderId;
  name: string;
  model: string;
  apiKeyUrl: string;
  keyPlaceholder: string;
  configured: boolean;
  selected: boolean;
}

export const providerKeySchema = z.strictObject({
  provider: modelProviderIdSchema,
  key: z.string().trim().min(20).max(4096),
});
export type ProviderKey = z.infer<typeof providerKeySchema>;
