"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { CaretRight } from "@phosphor-icons/react";
import { useState } from "react";

/**
 * A component that appears on the left edge of the screen when the sidebar is closed.
 * Hovering over it will open the sidebar.
 */
export function SidebarEdgeTrigger() {
  const { open, setOpen, isMobile } = useSidebar();
  const [isHovered, setIsHovered] = useState(false);

  // Don't show on mobile or when sidebar is open
  if (isMobile || open) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed left-0 top-0 h-full w-4 z-50 cursor-pointer",
        "flex items-center justify-center",
        "transition-all duration-200",
        isHovered ? "w-6 bg-primary/10" : "bg-transparent"
      )}
      onMouseEnter={() => {
        setIsHovered(true);
        // Open sidebar after a brief delay to avoid accidental triggers
        setTimeout(() => setOpen(true), 150);
      }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn(
          "absolute left-0 top-1/2 -translate-y-1/2",
          "transition-opacity duration-200",
          isHovered ? "opacity-100" : "opacity-0"
        )}
      >
        <CaretRight className="size-4 text-primary" />
      </div>
    </div>
  );
}
