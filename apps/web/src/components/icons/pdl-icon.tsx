"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface PDLIconProps {
  className?: string;
  size?: number;
  /** Use white version (for dark/colored backgrounds) */
  white?: boolean;
}

// People Data Labs official logo - geometric brain/network symbol
// Brand color: Electric Violet #7F35FD
export function PDLIcon({ className, size = 24, white = false }: PDLIconProps) {
  return (
    <Image
      src="/logos/People Data Labs_Symbol_1.png"
      alt="People Data Labs"
      width={size}
      height={size}
      className={cn(
        "object-contain",
        // Apply brightness filter to make it white on dark backgrounds
        white && "brightness-0 invert",
        className
      )}
    />
  );
}
