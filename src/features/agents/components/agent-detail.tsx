"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useSuspenseAgent,
  useSuspenseConversations,
  useCreateConversation,
  useDeleteConversation,
} from "../hooks/use-agents";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  BotIcon,
  MessageSquareIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
  Loader2Icon,
  WrenchIcon,
} from "lucide-react";
import Link from "next/link";

interface AgentDetailProps {
  agentId: string;
}

export function AgentDetail({ agentId }: AgentDetailProps) {
  const router = useRouter();
  const agent = useSuspenseAgent(agentId);
  const conversations = useSuspenseConversations(agentId);
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  const handleNewConversation = () => {
    createConversation.mutate(
      { agentId },
      {
        onSuccess: (conversation) => {
          router.push(`/agents/${agentId}/chat/${conversation.id}`);
        },
      }
    );
  };

  const handleDeleteConversation = (conversationId: string) => {
    deleteConversation.mutate({ id: conversationId });
  };

  const modelLabels = {
    ANTHROPIC: "Claude",
    OPENAI: "GPT-4o",
    GEMINI: "Gemini",
  };

  return (
    <div className="container py-8">
      {/* Agent Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {agent.data.avatar ? (
              <AvatarImage src={agent.data.avatar} alt={agent.data.name} />
            ) : null}
            <AvatarFallback className="bg-primary/10">
              <BotIcon className="size-8 text-primary" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold">{agent.data.name}</h1>
            {agent.data.description && (
              <p className="text-muted-foreground mt-1">
                {agent.data.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">
                {modelLabels[agent.data.model]}
              </Badge>
              <Badge variant="outline">
                Temp: {agent.data.temperature.toFixed(1)}
              </Badge>
              {agent.data.agentTools.length > 0 && (
                <Badge variant="outline">
                  <WrenchIcon className="size-3 mr-1" />
                  {agent.data.agentTools.length} tool
                  {agent.data.agentTools.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleNewConversation}
            disabled={createConversation.isPending}
          >
            {createConversation.isPending ? (
              <Loader2Icon className="size-4 animate-spin mr-2" />
            ) : (
              <PlusIcon className="size-4 mr-2" />
            )}
            New chat
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/agents/${agentId}/edit`}>
              <SettingsIcon className="size-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Conversations List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareIcon className="size-5" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {conversations.data.items.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquareIcon className="size-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No conversations yet.</p>
                <Button
                  className="mt-4"
                  onClick={handleNewConversation}
                  disabled={createConversation.isPending}
                >
                  Start your first conversation
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {conversations.data.items.map((conversation) => (
                    <div
                      key={conversation.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
                    >
                      <Link
                        href={`/agents/${agentId}/chat/${conversation.id}`}
                        className="flex-1 min-w-0"
                      >
                        <p className="font-medium truncate">
                          {conversation.title || "New conversation"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {conversation.messages[0]?.content
                            ? conversation.messages[0].content.slice(0, 60) +
                              (conversation.messages[0].content.length > 60
                                ? "..."
                                : "")
                            : "No messages yet"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(conversation.updatedAt, {
                            addSuffix: true,
                          })}
                        </p>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          handleDeleteConversation(conversation.id)
                        }
                        disabled={deleteConversation.isPending}
                      >
                        <TrashIcon className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Agent Info */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">System Prompt</p>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-4">
                {agent.data.systemPrompt}
              </p>
            </div>

            {agent.data.credential && (
              <div>
                <p className="text-sm font-medium">API Credential</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {agent.data.credential.name}
                </p>
              </div>
            )}

            {agent.data.agentTools.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Connected Tools</p>
                <div className="space-y-2">
                  {agent.data.agentTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="text-sm p-2 rounded bg-muted/50"
                    >
                      <p className="font-medium">{tool.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {tool.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
