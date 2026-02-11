"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MagnifyingGlass,
  CaretRight,
  Package,
  Calendar,
  Star,
  TrendUp,
  Briefcase,
  Headset,
  Users,
  CircleNotch,
} from "@phosphor-icons/react";
import Link from "next/link";
import Image from "next/image";
import { useSuspenseTemplates, useCreateAgentFromTemplate } from "@/features/templates/hooks/use-templates";

const categories = [
  { id: "all", label: "Product", icon: Package, role: "PRODUCT" },
  { id: "PRODUCTIVITY", label: "Meetings", icon: Calendar, role: "OPERATIONS" },
  { id: "popular", label: "Most popular", icon: Star, role: "" },
  { id: "SALES", label: "Productivity", icon: TrendUp, role: "OPERATIONS" },
  { id: "sales2", label: "Sales", icon: Briefcase, role: "SALES" },
  { id: "SUPPORT", label: "Support", icon: Headset, role: "SUPPORT" },
  { id: "hr", label: "Human Resources", icon: Users, role: "HUMAN_RESOURCES" },
];

// Hero section config for each category
const categoryHero: Record<string, { tagline: string; illustration: string; bgColor: string; textColor: string }> = {
  all: {
    tagline: "From specs to shipping,\nget it done.",
    illustration: "/illustrations/paper-map-animate.svg",
    bgColor: "#FEF3E2",
    textColor: "#D97706",
  },
  PRODUCTIVITY: {
    tagline: "Book, reschedule, and\nfollow up, automatically.",
    illustration: "/illustrations/calendar-animate.svg",
    bgColor: "#FEF3E2",
    textColor: "#D97706",
  },
  popular: {
    tagline: "Our most loved\nagents.",
    illustration: "/illustrations/paper-map-animate.svg",
    bgColor: "#F3E8FF",
    textColor: "#9333EA",
  },
  SALES: {
    tagline: "Stay organized,\nstay productive.",
    illustration: "/illustrations/timeline-animate.svg",
    bgColor: "#ECFDF5",
    textColor: "#059669",
  },
  sales2: {
    tagline: "Close more deals,\nfaster.",
    illustration: "/illustrations/sales-consulting-animate.svg",
    bgColor: "#EFF6FF",
    textColor: "#2563EB",
  },
  SUPPORT: {
    tagline: "Delight customers,\nat scale.",
    illustration: "/illustrations/live-collaboration-animate.svg",
    bgColor: "#FDF2F8",
    textColor: "#DB2777",
  },
  hr: {
    tagline: "Streamline hiring\nand onboarding.",
    illustration: "/illustrations/live-collaboration-animate.svg",
    bgColor: "#F0FDF4",
    textColor: "#16A34A",
  },
};

export function HomeTemplates() {
  const [activeCategory, setActiveCategory] = useState("all");
  const templates = useSuspenseTemplates({});
  const createFromTemplate = useCreateAgentFromTemplate();

  // Filter templates based on category
  const filteredTemplates = activeCategory === "all" || activeCategory === "popular"
    ? templates.data.slice(0, 6)
    : templates.data.filter(t => t.category === activeCategory).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Button variant="ghost" size="icon" className="shrink-0">
          <MagnifyingGlass className="size-4" />
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={activeCategory === cat.id ? "secondary" : "ghost"}
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </Button>
        ))}
        <Link href={`/templates?role=${categories.find(c => c.id === activeCategory)?.role || "PRODUCT"}`}>
          <Button variant="ghost" size="sm" className="shrink-0 rounded-full">
            See all
            <CaretRight className="size-4 ml-1" />
          </Button>
        </Link>
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {categories.find(c => c.id === activeCategory)?.label || "Templates"}
          </h2>
        </div>
        <Link
          href={`/templates?role=${categories.find(c => c.id === activeCategory)?.role || "PRODUCT"}`}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          See all
          <CaretRight className="size-4" />
        </Link>
      </div>

      {/* Templates grid with hero */}
      {filteredTemplates.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {/* Hero card with illustration */}
          <Card
            className="lg:col-span-2 lg:row-span-2 overflow-hidden border-0"
            style={{ backgroundColor: categoryHero[activeCategory]?.bgColor || "#FEF3E2" }}
          >
            <CardContent className="p-6 h-full flex items-center justify-between">
              <p
                className="text-xl sm:text-2xl font-medium whitespace-pre-line leading-tight"
                style={{ color: categoryHero[activeCategory]?.textColor || "#D97706" }}
              >
                {categoryHero[activeCategory]?.tagline || "Get things done."}
              </p>
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 shrink-0">
                <Image
                  src={categoryHero[activeCategory]?.illustration || "/illustrations/paper-map-animate.svg"}
                  alt=""
                  fill
                  className="object-contain"
                />
              </div>
            </CardContent>
          </Card>

          {/* Template cards */}
          {filteredTemplates.slice(0, 4).map((template) => (
            <Card
              key={template.id}
              className="group cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all bg-white"
              onClick={() => createFromTemplate.mutate({ templateId: template.id })}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  {/* Icon */}
                  <div
                    className="size-7 rounded flex items-center justify-center text-white text-sm shrink-0"
                    style={{ backgroundColor: template.color || "#3B82F6" }}
                  >
                    {template.icon || template.name[0]}
                  </div>

                  {/* Content */}
                  <div>
                    <h3 className="font-semibold text-sm">{template.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {template.subtitle || template.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No templates in this category yet.
        </div>
      )}

      {/* Loading overlay */}
      {createFromTemplate.isPending && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <CircleNotch className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Creating your agent...</p>
          </div>
        </div>
      )}
    </div>
  );
}
