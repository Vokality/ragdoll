import { useEffect, useSyncExternalStore } from "react";
import type { ExtensionSlotService } from "../application/extension-slot-service";

export function useExtensionSlots(service: ExtensionSlotService) {
  const slots = useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
    service.getSnapshot,
  );

  useEffect(() => {
    void service.start().catch((error) => {
      console.error("Failed to initialize extension slots", error);
    });
    return () => service.stop();
  }, [service]);

  return slots;
}
