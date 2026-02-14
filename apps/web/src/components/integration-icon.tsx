"use client";

import { Icon as IconifyIcon } from "@iconify/react";
import type { IntegrationIconData } from "@/hooks/use-integration-icons";

interface IntegrationIconProps {
  data: IntegrationIconData;
  className?: string;
}

export function IntegrationIcon({
  data,
  className = "size-4",
}: IntegrationIconProps) {
  if (data.type === "img") {
    return (
      <img
        src={data.src}
        alt={data.label}
        className={`${className} object-contain`}
      />
    );
  }
  return (
    <IconifyIcon
      icon={data.icon}
      className={className}
      style={data.color ? { color: data.color } : undefined}
    />
  );
}
