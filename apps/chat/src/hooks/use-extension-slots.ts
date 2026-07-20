import { useEffect, useSyncExternalStore } from "react";
import type { ExtensionSlotService } from "../application/extension-slot-service";

export function useExtensionSlots(service: ExtensionSlotService) {
  const slots = useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
    service.getSnapshot,
  );

  useEffect(() => {
    void service.start();
    return () => service.stop();
  }, [service]);

  return slots;
}
