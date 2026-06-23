import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Safe-area insets with web fallbacks. On web (rendered in an iframe), the
 * native insets resolve to 0, so we enforce a minimum status-bar / home-
 * indicator allowance per the Expo skill guidance.
 */
export function useAppInsets() {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "web") {
    return {
      top: Math.max(insets.top, 67),
      bottom: Math.max(insets.bottom, 34),
      left: insets.left,
      right: insets.right,
    };
  }
  return insets;
}
