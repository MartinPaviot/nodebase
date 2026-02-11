"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Robot,
  Sparkle,
  ArrowRight,
  Envelope,
  Calendar,
  ChatCircle,
  Phone,
  Check,
} from "@phosphor-icons/react";
import { useCreateAgentFromPrompt } from "@/features/agents/hooks/use-agents";

const steps = [
  { id: "describe", title: "Describe Your Agent" },
  { id: "capabilities", title: "Choose Capabilities" },
  { id: "integrations", title: "Connect Apps" },
  { id: "create", title: "Create Agent" },
];

const suggestedPrompts = [
  "Build me a meeting scheduler that manages my calendar",
  "Create a customer support agent for my SaaS product",
  "Make an email assistant that drafts replies",
  "Build a research assistant that can search the web",
  "Create a sales SDR that qualifies leads",
];

const capabilities = [
  { id: "email", icon: Envelope, label: "Send & receive emails", integration: "GMAIL" },
  { id: "calendar", icon: Calendar, label: "Manage calendar events", integration: "GOOGLE_CALENDAR" },
  { id: "slack", icon: ChatCircle, label: "Send Slack messages", integration: "SLACK" },
  { id: "phone", icon: Phone, label: "Handle phone calls", integration: null },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const createAgent = useCreateAgentFromPrompt();

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const agent = await createAgent.mutateAsync({
        prompt,
        capabilities: selectedCapabilities,
      });
      router.push(`/agents/${agent.id}`);
    } catch (error) {
      setIsCreating(false);
    }
  };

  return (
    <div className="container max-w-3xl py-8">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={`flex items-center gap-2 ${i <= currentStep ? "text-primary" : "text-muted-foreground"}`}
            >
              <div className={`size-8 rounded-full flex items-center justify-center border-2 ${
                i < currentStep ? "bg-primary border-primary text-white" :
                i === currentStep ? "border-primary" : "border-muted"
              }`}>
                {i < currentStep ? <Check className="size-4" /> : i + 1}
              </div>
              <span className="text-sm hidden sm:inline">{step.title}</span>
            </div>
          ))}
        </div>
        <Progress value={(currentStep / (steps.length - 1)) * 100} />
      </div>

      {/* Step 1: Describe */}
      {currentStep === 0 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkle className="size-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">What would you like your agent to do?</CardTitle>
            <CardDescription>
              Describe your agent in plain English. Be specific about what tasks it should handle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Build me a customer support agent that answers questions about my product, escalates complex issues to humans, and can send follow-up emails..."
              rows={4}
              className="text-lg"
            />

            <div>
              <p className="text-sm text-muted-foreground mb-2">Or try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((suggestion) => (
                  <Badge
                    key={suggestion}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => setPrompt(suggestion)}
                  >
                    {suggestion}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => setCurrentStep(1)}
              disabled={!prompt.trim()}
            >
              Continue
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Capabilities */}
      {currentStep === 1 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>What should your agent be able to do?</CardTitle>
            <CardDescription>
              Select the capabilities your agent needs. You can add more later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {capabilities.map((cap) => (
                <div
                  key={cap.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedCapabilities.includes(cap.id)
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground"
                  }`}
                  onClick={() => {
                    setSelectedCapabilities(prev =>
                      prev.includes(cap.id)
                        ? prev.filter(c => c !== cap.id)
                        : [...prev, cap.id]
                    );
                  }}
                >
                  <cap.icon className="size-6 mb-2" />
                  <p className="font-medium">{cap.label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                Back
              </Button>
              <Button className="flex-1" onClick={() => setCurrentStep(2)}>
                Continue
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Integrations (simplified - just show which need connecting) */}
      {currentStep === 2 && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Connect your apps</CardTitle>
            <CardDescription>
              Connect the apps your agent needs to work with.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show integration buttons for selected capabilities */}
            <p className="text-sm text-muted-foreground text-center">
              You can connect integrations later from the Integrations page.
            </p>
            <Button className="w-full" asChild>
              <a href="/integrations" target="_blank">Go to Integrations</a>
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button className="flex-1" onClick={() => setCurrentStep(3)}>
                Skip for now
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Create */}
      {currentStep === 3 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Robot className="size-8 text-primary" />
            </div>
            <CardTitle>Ready to create your agent!</CardTitle>
            <CardDescription>
              We&apos;ll use AI to generate the perfect configuration based on your description.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Your description:</p>
              <p className="text-sm text-muted-foreground">{prompt}</p>
            </div>

            {selectedCapabilities.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Capabilities:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCapabilities.map(cap => (
                    <Badge key={cap} variant="secondary">{cap}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create Agent"}
                <Sparkle className="size-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
