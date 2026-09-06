import type { SerializedSlotState } from "@vokality/ragdoll-extensions";
import type { SlotInfo } from "../electron-api.js";

export interface ExtensionCardSource {
  getAllSlots(): SlotInfo[];
  getSlotState(slotId: string): SerializedSlotState | null;
}

/** App-owned presentation state, independent of extension tool execution. */
export class ExtensionCardService {
  private activeCard: string | null = null;

  constructor(
    private readonly source: ExtensionCardSource,
    private readonly onChange: (slotId: string | null) => void,
  ) {}

  list(): SlotInfo[] {
    return this.source
      .getAllSlots()
      .filter(
        (slot) => this.source.getSlotState(slot.slotId)?.visible === true,
      );
  }

  getActive(): string | null {
    return this.activeCard;
  }

  select(slotId: string | null): void {
    if (
      slotId !== null &&
      !this.list().some((slot) => slot.slotId === slotId)
    ) {
      throw new Error(
        `Card '${slotId}' is unavailable. List available cards before opening one.`,
      );
    }
    if (slotId === this.activeCard) return;
    this.activeCard = slotId;
    this.onChange(slotId);
  }

  reconcile(): void {
    if (
      this.activeCard !== null &&
      !this.list().some((slot) => slot.slotId === this.activeCard)
    ) {
      this.select(null);
    }
  }
}
