import { trackEvent, type EventInput } from "@workspace/api-client-react";

/**
 * Fire-and-forget analytics. Mirrors the web app's event tracking
 * (search, category_select, attorney_view, consultation_click, website_click).
 */
export function track(event: EventInput): void {
  trackEvent(event).catch(() => {
    // Analytics is best-effort; never block the UI on failures.
  });
}
