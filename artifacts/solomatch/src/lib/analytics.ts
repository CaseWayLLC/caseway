import { useCallback } from "react";
import { useTrackEvent, type EventInput } from "@workspace/api-client-react";

const SESSION_KEY = "caseway_session_id";

function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

export type TrackInput = Omit<EventInput, "sessionId" | "path">;

/**
 * Returns a best-effort `track` function for recording usage analytics.
 * Failures are swallowed so analytics never blocks the user experience.
 */
export function useTrack() {
  const { mutate } = useTrackEvent({
    mutation: { onError: () => {} },
  });

  return useCallback(
    (input: TrackInput) => {
      try {
        mutate({
          data: {
            ...input,
            sessionId: getSessionId(),
            path:
              typeof window !== "undefined" ? window.location.pathname : null,
          },
        });
      } catch {
        // best-effort only
      }
    },
    [mutate],
  );
}
