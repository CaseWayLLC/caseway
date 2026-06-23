import { useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  animate,
  type PanInfo,
} from "framer-motion";

interface MobileResultsSheetProps {
  countLabel: string;
  children: React.ReactNode;
}

const SPRING = { type: "spring" as const, damping: 32, stiffness: 320 };

/**
 * Zillow-style draggable bottom sheet for the mobile results view.
 * Sits above a full-screen map; can be dragged (or tapped) between a
 * collapsed peek and a near-full expanded state. Mobile only.
 */
export function MobileResultsSheet({
  countLabel,
  children,
}: MobileResultsSheetProps) {
  const [vh, setVh] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 800,
  );
  const [expanded, setExpanded] = useState(false);
  const y = useMotionValue(
    typeof window !== "undefined" ? window.innerHeight : 800,
  );

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const sheetHeight = vh * 0.9;
  const collapsedY = sheetHeight - vh * 0.4; // ~40vh visible
  const expandedY = vh * 0.05; // ~85vh visible

  useEffect(() => {
    const controls = animate(y, expanded ? expandedY : collapsedY, SPRING);
    return controls.stop;
  }, [expanded, expandedY, collapsedY, y]);

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const next =
      info.offset.y < -40 || info.velocity.y < -350
        ? true
        : info.offset.y > 40 || info.velocity.y > 350
          ? false
          : expanded;
    setExpanded(next);
    animate(y, next ? expandedY : collapsedY, SPRING);
  };

  return (
    <>
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="sheet-backdrop"
            className="md:hidden absolute inset-0 z-20 bg-foreground/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setExpanded(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <motion.div
        className="md:hidden absolute left-0 right-0 bottom-0 z-30 bg-background rounded-t-3xl shadow-2xl border-t border-border/50 flex flex-col"
        style={{ height: sheetHeight, y }}
        drag="y"
        dragConstraints={{ top: expandedY, bottom: collapsedY }}
        dragElastic={0.04}
        onDragEnd={handleDragEnd}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 pt-3 pb-3 px-4 flex flex-col items-center gap-2 cursor-grab active:cursor-grabbing touch-none"
          aria-label={expanded ? "Collapse results" : "Expand results"}
        >
          <span className="h-1.5 w-12 rounded-full bg-border" />
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {countLabel}
          </span>
        </button>
        <div className="flex-1 overflow-y-auto px-4 pb-28">{children}</div>
      </motion.div>
    </>
  );
}
