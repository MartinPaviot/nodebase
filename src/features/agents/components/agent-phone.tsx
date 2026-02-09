"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useSuspensePhoneNumber,
  usePurchasePhoneNumber,
  useReleasePhoneNumber,
  useUpdatePhoneSettings,
  useSuspenseCallHistory,
  useMakeOutboundCall,
} from "../hooks/use-agents";
import {
  Phone,
  Plus,
  Trash,
  CircleNotch,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneX,
  Gear,
  Clock,
} from "@phosphor-icons/react";
import { formatDistanceToNow, format } from "date-fns";
import { CallDirection, CallStatus } from "@/generated/prisma";

interface AgentPhoneProps {
  agentId: string;
}

const callStatusConfig: Record<CallStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  INITIATED: { label: "Initiated", variant: "secondary" },
  RINGING: { label: "Ringing", variant: "outline" },
  IN_PROGRESS: { label: "In Progress", variant: "default" },
  COMPLETED: { label: "Completed", variant: "default" },
  FAILED: { label: "Failed", variant: "destructive" },
  NO_ANSWER: { label: "No Answer", variant: "secondary" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AgentPhone({ agentId }: AgentPhoneProps) {
  const phoneNumber = useSuspensePhoneNumber(agentId);
  const callHistory = useSuspenseCallHistory(agentId);
  const purchaseNumber = usePurchasePhoneNumber();
  const releaseNumber = useReleasePhoneNumber();
  const updateSettings = useUpdatePhoneSettings();
  const makeCall = useMakeOutboundCall();

  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [callToNumber, setCallToNumber] = useState("");
  const [callMessage, setCallMessage] = useState("");
  const [voiceGreeting, setVoiceGreeting] = useState(phoneNumber.data?.voiceGreeting || "");
  const [voiceEnabled, setVoiceEnabled] = useState(phoneNumber.data?.voiceEnabled ?? true);

  const handlePurchase = () => {
    purchaseNumber.mutate(
      { agentId, areaCode: areaCode || undefined },
      {
        onSuccess: () => {
          setIsPurchaseDialogOpen(false);
          setAreaCode("");
        },
      }
    );
  };

  const handleRelease = () => {
    releaseNumber.mutate({ agentId });
  };

  const handleMakeCall = () => {
    makeCall.mutate(
      {
        agentId,
        toNumber: callToNumber,
        message: callMessage || undefined,
        conversational: true,
      },
      {
        onSuccess: () => {
          setIsCallDialogOpen(false);
          setCallToNumber("");
          setCallMessage("");
        },
      }
    );
  };

  const handleSaveSettings = () => {
    updateSettings.mutate(
      {
        agentId,
        voiceEnabled,
        voiceGreeting: voiceGreeting || undefined,
      },
      {
        onSuccess: () => {
          setIsSettingsDialogOpen(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Phone Number Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="size-5" />
              Voice / Phone
            </CardTitle>
            <CardDescription>
              Enable your agent to make and receive phone calls via Twilio.
            </CardDescription>
          </div>
          {phoneNumber.data && (
            <div className="flex gap-2">
              <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Gear className="size-4 mr-2" />
                    Settings
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Phone Settings</DialogTitle>
                    <DialogDescription>
                      Configure voice settings for your agent.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Voice Enabled</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow incoming calls to this number
                        </p>
                      </div>
                      <Switch
                        checked={voiceEnabled}
                        onCheckedChange={setVoiceEnabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="greeting">Voice Greeting</Label>
                      <Textarea
                        id="greeting"
                        value={voiceGreeting}
                        onChange={(e) => setVoiceGreeting(e.target.value)}
                        placeholder="Hello, you've reached our AI assistant. How can I help you today?"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        This message will be spoken when someone calls this number.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsSettingsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveSettings}
                      disabled={updateSettings.isPending}
                    >
                      {updateSettings.isPending && (
                        <CircleNotch className="size-4 mr-2 animate-spin" />
                      )}
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isCallDialogOpen} onOpenChange={setIsCallDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <PhoneOutgoing className="size-4 mr-2" />
                    Make Call
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Make Outbound Call</DialogTitle>
                    <DialogDescription>
                      Your agent will call this number and have a conversation.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="toNumber">Phone Number</Label>
                      <Input
                        id="toNumber"
                        value={callToNumber}
                        onChange={(e) => setCallToNumber(e.target.value)}
                        placeholder="+1 555 123 4567"
                      />
                      <p className="text-xs text-muted-foreground">
                        Include country code (e.g., +1 for US)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Opening Message (optional)</Label>
                      <Textarea
                        id="message"
                        value={callMessage}
                        onChange={(e) => setCallMessage(e.target.value)}
                        placeholder="Hello, this is a call from..."
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        The agent will say this when the call connects, then listen for a response.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCallDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleMakeCall}
                      disabled={makeCall.isPending || !callToNumber}
                    >
                      {makeCall.isPending && (
                        <CircleNotch className="size-4 mr-2 animate-spin" />
                      )}
                      Call
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!phoneNumber.data ? (
            <div className="text-center py-8">
              <Phone className="size-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">
                No phone number assigned to this agent.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Purchase a phone number to enable voice calls.
              </p>
              <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="size-4 mr-2" />
                    Purchase Phone Number
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Purchase Phone Number</DialogTitle>
                    <DialogDescription>
                      A US phone number will be purchased and assigned to this agent.
                      Twilio charges apply.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="areaCode">Area Code (optional)</Label>
                      <Input
                        id="areaCode"
                        value={areaCode}
                        onChange={(e) => setAreaCode(e.target.value)}
                        placeholder="e.g., 415, 212"
                        maxLength={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty for any available US number.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsPurchaseDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handlePurchase}
                      disabled={purchaseNumber.isPending}
                    >
                      {purchaseNumber.isPending && (
                        <CircleNotch className="size-4 mr-2 animate-spin" />
                      )}
                      Purchase
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-mono font-medium text-lg">
                      {phoneNumber.data.phoneNumber}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={phoneNumber.data.voiceEnabled ? "default" : "secondary"}>
                        {phoneNumber.data.voiceEnabled ? "Voice Enabled" : "Voice Disabled"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="text-destructive">
                      <Trash className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Release Phone Number?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will release the phone number {phoneNumber.data.phoneNumber} from Twilio.
                        This action cannot be undone and you may not be able to reclaim this number.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleRelease}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {releaseNumber.isPending && (
                          <CircleNotch className="size-4 mr-2 animate-spin" />
                        )}
                        Release Number
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {phoneNumber.data.voiceGreeting && (
                <div className="p-3 rounded-lg border">
                  <p className="text-sm font-medium mb-1">Voice Greeting:</p>
                  <p className="text-sm text-muted-foreground italic">
                    "{phoneNumber.data.voiceGreeting}"
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call History Card */}
      {phoneNumber.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-5" />
              Call History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {callHistory.data.items.length === 0 ? (
              <div className="text-center py-8">
                <PhoneCall className="size-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No calls yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Incoming and outgoing calls will appear here.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {callHistory.data.items.map((call) => (
                    <div
                      key={call.id}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {call.direction === "INBOUND" ? (
                              call.status === "COMPLETED" ? (
                                <PhoneIncoming className="size-5 text-green-500" />
                              ) : call.status === "NO_ANSWER" || call.status === "FAILED" ? (
                                <PhoneX className="size-5 text-destructive" />
                              ) : (
                                <PhoneIncoming className="size-5 text-muted-foreground" />
                              )
                            ) : (
                              <PhoneOutgoing className="size-5 text-blue-500" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">
                                {call.direction === "INBOUND" ? call.fromNumber : call.toNumber}
                              </span>
                              <Badge variant={callStatusConfig[call.status].variant}>
                                {callStatusConfig[call.status].label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>
                                {call.direction === "INBOUND" ? "Incoming" : "Outgoing"}
                              </span>
                              <span>
                                {format(new Date(call.startedAt), "MMM d, yyyy h:mm a")}
                              </span>
                              {call.duration && (
                                <span>Duration: {formatDuration(call.duration)}</span>
                              )}
                            </div>
                            {call.transcript && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                  View Transcript
                                </summary>
                                <pre className="mt-2 p-2 rounded bg-muted text-xs whitespace-pre-wrap">
                                  {call.transcript}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
