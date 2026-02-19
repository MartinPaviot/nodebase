"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  CircleNotch,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react";
import { useSession } from "@/lib/auth-client";
import { useIntegrationIcons } from "@/hooks/use-integration-icons";
import { IntegrationIcon } from "@/components/integration-icon";
import { useComposioConnections } from "@/hooks/use-composio";
import { useCreateAgentFromTemplate } from "@/features/templates/hooks/use-templates";
import {
  getConnectableIntegrations,
  getComposioAppName,
} from "@/features/templates/lib/integration-mapping";
import { getTemplateConfig } from "@/lib/template-display";

type WizardStep = "welcome" | "connect" | "ready";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  suggestedIntegrations: string[];
}

interface TemplateSetupWizardProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: WizardStep;
}

export function TemplateSetupWizard({
  template,
  open,
  onOpenChange,
  initialStep = "welcome",
}: TemplateSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [connectingApp, setConnectingApp] = useState<string | null>(null);
  const { data: session } = useSession();
  const { getIcon } = useIntegrationIcons();
  const createFromTemplate = useCreateAgentFromTemplate();

  const userId = session?.user?.id ?? "";
  const { data: connections, refetch: refetchConnections } =
    useComposioConnections(userId);

  // Get connectable integrations for this template
  const connectableIntegrations = useMemo(() => {
    if (!template) return [];
    return getConnectableIntegrations(template.suggestedIntegrations);
  }, [template]);

  const hasConnectStep = connectableIntegrations.length > 0;

  // Reset step when template changes or dialog opens
  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setConnectingApp(null);
    }
  }, [open, initialStep]);

  // Refetch connections when returning from OAuth (dialog opens at connect step)
  useEffect(() => {
    if (open && initialStep === "connect" && userId) {
      refetchConnections();
    }
  }, [open, initialStep, userId, refetchConnections]);

  // Check if an integration is connected
  const isConnected = useCallback(
    (integrationKey: string): boolean => {
      if (!connections) return false;
      const appName = getComposioAppName(integrationKey).toLowerCase();
      return connections.some(
        (c) =>
          c.appName.toLowerCase() === appName && c.status === "ACTIVE",
      );
    },
    [connections],
  );

  // Count connected integrations
  const connectedCount = useMemo(() => {
    return connectableIntegrations.filter((key) => isConnected(key)).length;
  }, [connectableIntegrations, isConnected]);

  const handleContinue = () => {
    if (step === "welcome") {
      setStep(hasConnectStep ? "connect" : "ready");
    } else if (step === "connect") {
      setStep("ready");
    } else if (step === "ready" && template) {
      createFromTemplate.mutate({ templateId: template.id });
    }
  };

  const handleSkip = () => {
    if (template) {
      createFromTemplate.mutate({ templateId: template.id });
    }
  };

  const handleConnect = async (integrationKey: string) => {
    if (!template) return;
    setConnectingApp(integrationKey);

    try {
      const appName = getComposioAppName(integrationKey);
      const redirectUrl = `${window.location.origin}/templates?setup=${template.id}`;

      const res = await fetch("/api/integrations/composio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName, redirectUrl }),
      });

      if (res.ok) {
        const { data } = await res.json();
        window.location.href = data.redirectUrl;
      }
    } catch {
      setConnectingApp(null);
    }
  };

  if (!template) return null;

  const config = getTemplateConfig(template.name);
  const isPending = createFromTemplate.isPending;

  // Step indicator dots
  const steps: WizardStep[] = hasConnectStep
    ? ["welcome", "connect", "ready"]
    : ["welcome", "ready"];
  const currentStepIndex = steps.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden"
        showCloseButton
      >
        <div className="flex flex-col min-h-[420px]">
          {/* Header bar */}
          <div className="flex items-center gap-2 px-6 pt-5 pb-0">
            <div
              className={`size-6 rounded flex items-center justify-center bg-gradient-to-br ${config.gradient}`}
            >
              <config.icon className="size-3 text-white" weight="fill" />
            </div>
            <span className="text-sm text-muted-foreground">
              Setting up <span className="font-medium text-foreground">{template.name}</span>
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 px-6 pt-4 pb-2">
            {step === "welcome" && (
              <WelcomeStep template={template} />
            )}
            {step === "connect" && (
              <ConnectStep
                integrations={connectableIntegrations}
                getIcon={getIcon}
                isConnected={isConnected}
                connectedCount={connectedCount}
                totalCount={connectableIntegrations.length}
                connectingApp={connectingApp}
                onConnect={handleConnect}
              />
            )}
            {step === "ready" && (
              <ReadyStep template={template} />
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 pt-2 space-y-2">
            {/* Step dots */}
            <div className="flex justify-center gap-1.5 mb-3">
              {steps.map((s, i) => (
                <div
                  key={s}
                  className={`size-1.5 rounded-full transition-colors ${
                    i <= currentStepIndex
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={handleContinue}
              disabled={isPending}
              className="w-full gap-2"
            >
              {isPending ? (
                <>
                  <CircleNotch className="size-4 animate-spin" />
                  Creating agent...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>

            {step !== "welcome" && (
              <button
                onClick={handleSkip}
                disabled={isPending}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Skip agent setup
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Step Components ─────────────────────────────────────

function WelcomeStep({ template }: { template: Template }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">
        Let&apos;s set up your {template.name}!
      </h2>
      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
        {template.description}
      </p>
    </div>
  );
}

function ConnectStep({
  integrations,
  getIcon,
  isConnected,
  connectedCount,
  totalCount,
  connectingApp,
  onConnect,
}: {
  integrations: string[];
  getIcon: ReturnType<typeof useIntegrationIcons>["getIcon"];
  isConnected: (key: string) => boolean;
  connectedCount: number;
  totalCount: number;
  connectingApp: string | null;
  onConnect: (key: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">
        Connect your accounts
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        {connectedCount}/{totalCount} connected
      </p>

      <div className="mt-5 space-y-2">
        {integrations.map((key) => {
          const iconData = getIcon(key);
          const connected = isConnected(key);
          const isConnecting = connectingApp === key;

          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <IntegrationIcon data={iconData} className="size-5" />
                <span className="text-sm font-medium">{iconData.label}</span>
              </div>

              {connected ? (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                  <CheckCircle className="size-4" weight="fill" />
                  Connected
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  className="bg-amber-500 hover:bg-amber-600 text-white h-8 px-4"
                  onClick={() => onConnect(key)}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <CircleNotch className="size-3.5 animate-spin" />
                  ) : (
                    "Connect"
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadyStep({ template }: { template: Template }) {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">
        Your {template.name} is ready to go!
      </h2>
      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
        {template.description}
      </p>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        You can adjust any setting later if needed.
      </p>

      <div className="mt-5 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
        <Warning className="size-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <span className="font-medium">Keep in mind:</span> Each part of
          the flow consumes credits. Start small, review the results, and
          then scale based on your needs.
        </p>
      </div>
    </div>
  );
}
