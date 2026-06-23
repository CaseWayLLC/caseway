/**
 * Semantic design tokens for the Caseway mobile app.
 *
 * Mirrors the sibling web artifact (artifacts/solomatch/src/index.css):
 * warm-white background, forest-green primary, gold accent, deep-green ink.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: "#142620",
    tint: "#214f38",

    // Core surfaces
    background: "#FBFAF7",
    foreground: "#142620",

    // Cards / elevated surfaces
    card: "#FFFFFF",
    cardForeground: "#142620",

    // Primary action color (buttons, links, active states)
    primary: "#214F38",
    primaryForeground: "#F7F4EE",

    // Secondary / less-emphasis interactive surfaces
    secondary: "#E3EAE6",
    secondaryForeground: "#214F38",

    // Muted / subdued elements (dividers, captions, placeholders)
    muted: "#F4F2EC",
    mutedForeground: "#647069",

    // Accent highlights (badges, selected items)
    accent: "#F2EAD9",
    accentForeground: "#182A22",

    // Destructive actions
    destructive: "#C53030",
    destructiveForeground: "#FFFFFF",

    // Borders and input outlines
    border: "#E9E5DE",
    input: "#DCD7CC",

    // Brand gold
    gold: "#C89B48",
    goldForeground: "#112C20",
    goldSoft: "#EFE2C6",
  },

  // Border radius (in px). Synced from the web --radius (0.75rem).
  radius: 14,
};

export default colors;
