"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShareNetwork, CircleNotch, X } from "@phosphor-icons/react";
import { useShareAsTemplate } from "../hooks/use-templates";

const CATEGORIES = [
  { value: "PRODUCTIVITY", label: "Productivity" },
  { value: "SALES", label: "Sales" },
  { value: "SUPPORT", label: "Support" },
  { value: "RESEARCH", label: "Research" },
  { value: "CREATIVE", label: "Creative" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "CUSTOM", label: "Custom" },
] as const;

interface ShareTemplateDialogProps {
  agentId: string;
  agentName: string;
  trigger?: React.ReactNode;
}

export function ShareTemplateDialog({
  agentId,
  agentName,
  trigger,
}: ShareTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState("");

  const shareAsTemplate = useShareAsTemplate();

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && tags.length < 10 && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = () => {
    if (!category) return;

    shareAsTemplate.mutate(
      {
        agentId,
        category: category as (typeof CATEGORIES)[number]["value"],
        tags,
        coverImage: coverImage || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setCategory("");
          setTags([]);
          setCoverImage("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ShareNetwork className="size-4 mr-2" />
            Share as Template
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share as Template</DialogTitle>
          <DialogDescription>
            Share "{agentName}" with the community. Other users will be able to
            create agents based on your template.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">Tags (up to 10)</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={tags.length >= 10}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddTag}
                disabled={tags.length >= 10 || !tagInput.trim()}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <X className="size-3 ml-1" />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="coverImage">Cover Image URL (optional)</Label>
            <Input
              id="coverImage"
              placeholder="https://example.com/image.png"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!category || shareAsTemplate.isPending}
          >
            {shareAsTemplate.isPending ? (
              <>
                <CircleNotch className="size-4 mr-2 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <ShareNetwork className="size-4 mr-2" />
                Share Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
