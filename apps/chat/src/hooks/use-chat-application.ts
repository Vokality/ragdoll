import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { TaskState } from "@vokality/ragdoll";
import type { ChatMessage } from "../domain/chat";
import { appendMessage, getVisibleMessages } from "../domain/chat";
import type { ChatSettings } from "../domain/settings";
import { DEFAULT_SETTINGS } from "../domain/settings";
import { ChatService } from "../application/chat-service";
import { createElectronChatGateway } from "../infrastructure/electron-chat-gateway";

interface ChatActions {
  sendMessage: (message: string) => Promise<{ success: boolean; error?: string }>;
  changeTheme: (theme: string) => Promise<void>;
  changeVariant: (variant: string) => Promise<void>;
  clearConversation: () => Promise<void>;
  clearApiKey: () => Promise<void>;
}

interface UseChatApplicationResult {
  settings: ChatSettings;
  visibleMessages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  initialTaskState: TaskState | null;
  actions: ChatActions;
  subscribeToFunctionCalls: (
    handler: (name: string, args: Record<string, unknown>) => void
  ) => () => void;
}

export function useChatApplication(): UseChatApplicationResult {
  const serviceRef = useRef<ChatService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new ChatService(createElectronChatGateway());
  }
  const service = serviceRef.current;
  if (!service) {
    throw new Error("Chat service failed to initialize");
  }

  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initialTaskState, setInitialTaskState] = useState<TaskState | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>("");

  const messagesRef = useRef<ChatMessage[]>([]);
  const loadingRef = useRef(false);
  const streamingTextRef = useRef("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { messages: loadedMessages, settings: loadedSettings, initialTaskState } =
          await service.hydrate();
        if (!mounted) return;
        messagesRef.current = loadedMessages;
        setMessages(loadedMessages);
        setSettings(loadedSettings);
        setInitialTaskState(initialTaskState);
      } catch (error) {
        console.error("Failed to hydrate chat state", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [service]);

  useEffect(() => {
    const unsubscribe = service.subscribeToStreaming({
      onText: (text) => {
        streamingTextRef.current += text;
        setStreamingContent(streamingTextRef.current);
      },
      onStreamEnd: () => {
        loadingRef.current = false;
        setIsStreaming(false);
        setIsLoading(false);
        if (streamingTextRef.current) {
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: streamingTextRef.current,
          };
          setMessages((prev) => {
            const next = appendMessage(prev, assistantMessage);
            messagesRef.current = next;
            void service.persistConversation(next).catch((error) => {
              console.error("Failed to persist conversation", error);
            });
            return next;
          });
        }
        streamingTextRef.current = "";
        setStreamingContent("");
      },
    });

    return unsubscribe;
  }, [service]);

  const sendMessage = useCallback<ChatActions["sendMessage"]>(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed) {
        return { success: false, error: "Message is empty" };
      }
      if (loadingRef.current) {
        return { success: false, error: "Already processing" };
      }

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const nextHistory = appendMessage(messagesRef.current, userMessage);
      messagesRef.current = nextHistory;
      setMessages(nextHistory);

      streamingTextRef.current = "";
      setStreamingContent("");
      setIsStreaming(true);
      setIsLoading(true);
      loadingRef.current = true;

      const result = await service.sendMessage(trimmed, nextHistory);
      if (!result.success) {
        loadingRef.current = false;
        setIsStreaming(false);
        setIsLoading(false);
        setStreamingContent("");
      }
      return result;
    },
    [service]
  );

  const changeTheme = useCallback<ChatActions["changeTheme"]>(
    async (theme) => {
      setSettings((prev) => ({ ...prev, theme }));
      await service.updateSettings({ theme });
    },
    [service]
  );

  const changeVariant = useCallback<ChatActions["changeVariant"]>(
    async (variant) => {
      setSettings((prev) => ({ ...prev, variant }));
      await service.updateSettings({ variant });
    },
    [service]
  );

  const clearConversation = useCallback<ChatActions["clearConversation"]>(
    async () => {
      await service.clearConversation();
      messagesRef.current = [];
      setMessages([]);
      streamingTextRef.current = "";
      setStreamingContent("");
    },
    [service]
  );

  const clearApiKey = useCallback<ChatActions["clearApiKey"]>(
    async () => {
      await service.clearApiKey();
    },
    [service]
  );

  const subscribeToFunctionCalls = useCallback<UseChatApplicationResult["subscribeToFunctionCalls"]>(
    (handler) => service.onFunctionCall(handler),
    [service]
  );

  const visibleMessages = useMemo(
    () => getVisibleMessages(messages, isStreaming ? streamingContent : null),
    [messages, isStreaming, streamingContent]
  );

  return {
    settings,
    visibleMessages,
    isStreaming,
    isLoading,
    initialTaskState,
    actions: {
      sendMessage,
      changeTheme,
      changeVariant,
      clearConversation,
      clearApiKey,
    },
    subscribeToFunctionCalls,
  };
}
