"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateAgent, useUpdateAgent } from "../hooks/use-agents";
import { useRouter } from "next/navigation";
import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import { Loader2Icon } from "lucide-react";
import type { Agent, Credential } from "@/generated/prisma";

const agentFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(1000).optional(),
  systemPrompt: z.string().min(1, "System prompt is required").max(10000),
  model: z.enum(["ANTHROPIC", "OPENAI", "GEMINI"]),
  temperature: z.number().min(0).max(2),
  credentialId: z.string().optional(),
});

type AgentFormData = z.infer<typeof agentFormSchema>;

interface AgentFormProps {
  agent?: Agent;
  credentials?: Pick<Credential, "id" | "name" | "type">[];
}

export function AgentForm({ agent, credentials = [] }: AgentFormProps) {
  const router = useRouter();
  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();
  const { handleError, modal } = useUpgradeModal();

  const isEditing = !!agent;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AgentFormData>({
    resolver: zodResolver(agentFormSchema),
    defaultValues: {
      name: agent?.name || "",
      description: agent?.description || "",
      systemPrompt:
        agent?.systemPrompt ||
        "You are a helpful AI assistant. Be concise and helpful in your responses.",
      model: (agent?.model as AgentFormData["model"]) || "ANTHROPIC",
      temperature: agent?.temperature || 0.7,
      credentialId: agent?.credentialId || undefined,
    },
  });

  const selectedModel = watch("model");
  const temperature = watch("temperature");

  // Filter credentials by selected model type
  const filteredCredentials = credentials.filter(
    (cred) => cred.type === selectedModel
  );

  const onSubmit = async (data: AgentFormData) => {
    if (isEditing) {
      updateAgent.mutate(
        { id: agent.id, ...data },
        {
          onSuccess: () => {
            router.push(`/agents/${agent.id}`);
          },
          onError: handleError,
        }
      );
    } else {
      createAgent.mutate(data, {
        onSuccess: (newAgent) => {
          router.push(`/agents/${newAgent.id}`);
        },
        onError: handleError,
      });
    }
  };

  const isPending = createAgent.isPending || updateAgent.isPending;

  return (
    <>
      {modal}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            placeholder="My AI Agent"
            {...register("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            placeholder="A brief description of what this agent does..."
            rows={2}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <Textarea
            id="systemPrompt"
            placeholder="You are a helpful AI assistant..."
            rows={6}
            {...register("systemPrompt")}
            aria-invalid={!!errors.systemPrompt}
          />
          {errors.systemPrompt && (
            <p className="text-sm text-destructive">
              {errors.systemPrompt.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            This defines the personality and behavior of your agent.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Model</Label>
            <Controller
              name="model"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANTHROPIC">Claude (Anthropic)</SelectItem>
                    <SelectItem value="OPENAI">GPT-4o (OpenAI)</SelectItem>
                    <SelectItem value="GEMINI">Gemini (Google)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>API Credential</Label>
            <Controller
              name="credentialId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={(value) =>
                    field.onChange(value === "" ? undefined : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select credential" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCredentials.length === 0 ? (
                      <SelectItem value="" disabled>
                        No {selectedModel} credentials found
                      </SelectItem>
                    ) : (
                      filteredCredentials.map((cred) => (
                        <SelectItem key={cred.id} value={cred.id}>
                          {cred.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-xs text-muted-foreground">
              <a href="/credentials/new" className="text-primary underline">
                Add a new credential
              </a>{" "}
              if you don&apos;t have one.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Temperature</Label>
            <span className="text-sm text-muted-foreground">
              {temperature.toFixed(1)}
            </span>
          </div>
          <Controller
            name="temperature"
            control={control}
            render={({ field }) => (
              <Slider
                value={[field.value]}
                onValueChange={([value]) => field.onChange(value)}
                min={0}
                max={2}
                step={0.1}
                className="w-full"
              />
            )}
          />
          <p className="text-xs text-muted-foreground">
            Lower values make responses more focused and deterministic. Higher
            values make responses more creative and varied.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Save changes" : "Create agent"}
          </Button>
        </div>
      </form>
    </>
  );
}
