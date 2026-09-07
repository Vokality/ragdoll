import type {
  ElectronAPI,
  ExperienceSnapshot,
  ProfileEdit,
  CharacterReaction,
} from "../../electron/electron-api";

type Gateway = Pick<
  ElectronAPI,
  | "getExperience"
  | "beginExperience"
  | "saveProfile"
  | "onExperienceChanged"
  | "onCharacterReaction"
  | "cancelMessage"
>;
export class ExperienceService {
  private snapshot: ExperienceSnapshot | null = null;
  private version = 0;
  private readonly listeners = new Set<() => void>();
  constructor(private readonly api: Gateway) {}
  readonly getSnapshot = () => this.snapshot;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly refresh = async () => {
    const version = ++this.version;
    const snapshot = await this.api.getExperience();
    if (version !== this.version) return;
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  };
  start(reportError: (error: unknown) => void): () => void {
    let active = true;
    const refresh = () => {
      if (active) void this.refresh().catch(reportError);
    };
    const unsubscribe = this.api.onExperienceChanged(refresh);
    refresh();
    void this.api.beginExperience().then(refresh, reportError);
    return () => {
      active = false;
      this.version += 1;
      unsubscribe();
    };
  }
  reactions(callback: (reaction: CharacterReaction) => void) {
    return this.api.onCharacterReaction(callback);
  }
  async save(input: ProfileEdit): Promise<void> {
    await this.api.saveProfile(input);
    await this.refresh();
  }
  async cancel(): Promise<void> {
    const result = await this.api.cancelMessage();
    if (!result.success) throw new Error(result.error);
  }
  async retry(): Promise<void> {
    await this.api.beginExperience();
    await this.refresh();
  }
}
