"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Robot, User, ChatCircle, Envelope, Phone, Globe, Lightning, Clock } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { ConversationSource, MessageRole } from "@prisma/client";

// Source icons mapping
const sourceIcons = {
  CHAT: ChatCircle,
  EMBED: Globe,
  EMAIL: Envelope,
  PHONE: Phone,
  SLACK: ChatCircle,
  WEBHOOK: Lightning,
  SCHEDULE: Clock,
};

const sourceLabels: Record<string, string> = {
  CHAT: "Chat",
  EMBED: "Widget",
  EMAIL: "Email",
  PHONE: "Phone",
  SLACK: "Slack",
  WEBHOOK: "Webhook",
  SCHEDULE: "Scheduled",
};

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

interface Conversation {
  id: string;
  title: string | null;
  source: ConversationSource;
  agent: {
    name: string;
    avatar: string | null;
  };
  messages: Message[];
}

interface SharedConversationViewProps {
  conversation: Conversation;
}

export function SharedConversationView({ conversation }: SharedConversationViewProps) {
  const SourceIcon = sourceIcons[conversation.source] || ChatCircle;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container max-w-3xl py-8">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">
                  {conversation.title || "Conversation"}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  with {conversation.agent.name}
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <SourceIcon className="size-3" />
                {sourceLabels[conversation.source]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {conversation.messages.length === 0 ? (
              <div className="text-center py-12">
                <ChatCircle className="size-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No messages in this conversation.</p>
              </div>
            ) : (
              <div className="divide-y">
                {conversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 p-4 ${
                      message.role === "ASSISTANT" ? "bg-muted/30" : ""
                    }`}
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback
                        className={
                          message.role === "USER"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary"
                        }
                      >
                        {message.role === "USER" ? (
                          <User className="size-4" />
                        ) : (
                          <Robot className="size-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {message.role === "USER" ? "User" : conversation.agent.name}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(message.createdAt, { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap mt-1">{message.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          This is a shared conversation. The owner can revoke access at any time.
        </p>
      </div>
    </div>
  );
}
