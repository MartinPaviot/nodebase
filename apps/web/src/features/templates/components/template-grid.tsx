"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, DownloadSimple, User, CircleNotch } from "@phosphor-icons/react";
import {
  useSuspenseTemplates,
  useCreateAgentFromTemplate,
} from "../hooks/use-templates";

interface TemplateGridProps {
  category?: string;
  role?: string;
  useCase?: string;
  featured?: boolean;
  community?: boolean;
  search?: string;
}

export function TemplateGrid({
  category,
  role,
  useCase,
  featured,
  community,
  search,
}: TemplateGridProps) {
  const templates = useSuspenseTemplates({ category, role, useCase, featured, community, search });
  const createFromTemplate = useCreateAgentFromTemplate();

  if (templates.data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No templates found{search ? ` for "${search}"` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.data.map((template) => (
        <Card key={template.id} className="flex flex-col">
          {template.coverImage ? (
            <div
              className="h-32 bg-cover bg-center rounded-t-lg"
              style={{ backgroundImage: `url(${template.coverImage})` }}
            />
          ) : (
            <div
              className="h-32 rounded-t-lg"
              style={{
                background: `linear-gradient(135deg, ${template.color || "#6366f1"}30, ${template.color || "#6366f1"}10)`,
              }}
            />
          )}
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="size-8 rounded flex items-center justify-center text-white text-base shrink-0"
                  style={{ backgroundColor: template.color || "#6366f1" }}
                >
                  {template.icon || template.name[0]}
                </div>
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {template.category.toLowerCase().replace("_", " ")}
                    </Badge>
                    {template.isFeatured && (
                      <Badge className="text-xs">Featured</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {template.subtitle || template.description}
            </p>
            {template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {template.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{template.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1" title="Rating">
                <Star className="size-3" weight="fill" style={{ color: "#facc15" }} />
                {template.rating.toFixed(1)}
              </span>
              <span className="flex items-center gap-1" title="Uses">
                <DownloadSimple className="size-3" />
                {template.usageCount}
              </span>
              {template.createdByName && (
                <span
                  className="flex items-center gap-1 truncate max-w-[100px]"
                  title={template.createdByName}
                >
                  <User className="size-3" />
                  {template.createdByName}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() =>
                createFromTemplate.mutate({ templateId: template.id })
              }
              disabled={createFromTemplate.isPending}
            >
              {createFromTemplate.isPending ? (
                <CircleNotch className="size-4 animate-spin" />
              ) : (
                "Use"
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
