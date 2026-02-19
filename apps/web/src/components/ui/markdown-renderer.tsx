"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        // Tight spacing for chat context
        "prose-p:my-1 prose-p:leading-relaxed",
        // Headings as subtle labels, not document titles
        "prose-headings:my-1.5 prose-headings:text-xs prose-headings:font-semibold prose-headings:uppercase prose-headings:tracking-wide prose-headings:text-muted-foreground",
        "prose-ul:my-1 prose-ol:my-1",
        "prose-li:my-0",
        // Code blocks
        "prose-pre:my-1.5 prose-pre:rounded-lg prose-pre:bg-muted",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none",
        // Subtle blockquote
        "prose-blockquote:my-1.5 prose-blockquote:border-l-primary/50 prose-blockquote:text-muted-foreground",
        // Links: underline on hover only
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-table:my-1.5",
        // Softer bold
        "prose-strong:font-medium",
        "text-xs",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          // Flatten headings to avoid size jumps in chat bubbles
          h1: ({ children, ...props }) => <h4 {...props}>{children}</h4>,
          h2: ({ children, ...props }) => <h5 {...props}>{children}</h5>,
          h3: ({ children, ...props }) => <h6 {...props}>{children}</h6>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
