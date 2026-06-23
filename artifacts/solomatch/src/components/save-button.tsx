import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSavedAttorneys } from "@/lib/saved-attorneys";

interface SaveButtonProps {
  attorneyId: number;
  attorneyName?: string;
  // "icon" = compact circular overlay (cards); "labeled" = button with text.
  variant?: "icon" | "labeled";
  className?: string;
}

export function SaveButton({
  attorneyId,
  attorneyName,
  variant = "icon",
  className,
}: SaveButtonProps) {
  const { isSaved, toggle } = useSavedAttorneys();
  const saved = isSaved(attorneyId);
  const who = attorneyName ?? "this attorney";
  const label = saved ? `Remove ${who} from saved` : `Save ${who}`;

  const handleClick = (e: React.MouseEvent) => {
    // Cards/links wrap this — never trigger their navigation/selection.
    e.preventDefault();
    e.stopPropagation();
    toggle(attorneyId);
  };

  // The parent Card handles Enter/Space to open the profile. Keep keyboard
  // activation of this button isolated so it toggles save instead of navigating.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") e.stopPropagation();
  };

  if (variant === "labeled") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-pressed={saved}
        aria-label={label}
        className={cn(
          "gap-2 rounded-full font-medium",
          saved && "border-primary/40 bg-primary/5 text-primary",
          className,
        )}
      >
        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
        {saved ? "Saved" : "Save"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        saved
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/60 bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-primary",
        className,
      )}
    >
      <Bookmark className={cn("h-[18px] w-[18px]", saved && "fill-current")} />
    </button>
  );
}
