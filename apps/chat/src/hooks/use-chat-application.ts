import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ChatService } from "../application/chat-service";

export function useChatApplication(service: ChatService) {
  const snapshot = useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
    service.getSnapshot,
  );

  useEffect(() => {
    void service.start();
    return () => service.stop();
  }, [service]);

  const actions = useMemo(
    () => ({
      sendMessage: service.sendMessage,
      stopStreaming: service.stopStreaming,
      changeTheme: service.changeTheme,
      changeVariant: service.changeVariant,
      clearConversation: service.clearConversation,
      clearApiKey: service.clearApiKey,
    }),
    [service],
  );

  return {
    ...snapshot,
    actions,
    subscribeToFunctionCalls: service.onFunctionCall,
  };
}
