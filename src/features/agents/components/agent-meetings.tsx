"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useSuspenseMeetingRecordings,
  useScheduleMeeting,
  useSyncCalendarMeetings,
  useDeleteMeetingRecording,
} from "../hooks/use-agents";
import {
  VideoCamera,
  Plus,
  ArrowsClockwise,
  CircleNotch,
  FileText,
  CheckSquare,
  Trash,
} from "@phosphor-icons/react";
import { format } from "date-fns";

interface AgentMeetingsProps {
  agentId: string;
}

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  JOINING: "bg-yellow-100 text-yellow-800",
  RECORDING: "bg-red-100 text-red-800",
  PROCESSING: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-gray-100 text-gray-800",
};

const platformIcons: Record<string, string> = {
  ZOOM: "Z",
  GOOGLE_MEET: "G",
  MICROSOFT_TEAMS: "T",
  OTHER: "M",
};

export function AgentMeetings({ agentId }: AgentMeetingsProps) {
  const recordings = useSuspenseMeetingRecordings(agentId);
  const scheduleMeeting = useScheduleMeeting();
  const syncCalendar = useSyncCalendarMeetings();
  const deleteMeeting = useDeleteMeetingRecording();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    meetingUrl: "",
    scheduledAt: "",
  });

  const handleSchedule = () => {
    scheduleMeeting.mutate(
      {
        agentId,
        ...formData,
        scheduledAt: new Date(formData.scheduledAt),
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false);
          setFormData({ title: "", meetingUrl: "", scheduledAt: "" });
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteMeeting.mutate({ id });
    if (selectedRecording === id) {
      setSelectedRecording(null);
    }
  };

  const selected = recordings.data.find((r) => r.id === selectedRecording);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <VideoCamera className="size-5" />
            Meeting Recordings
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncCalendar.mutate({ agentId })}
              disabled={syncCalendar.isPending}
            >
              {syncCalendar.isPending ? (
                <CircleNotch className="size-4 animate-spin" />
              ) : (
                <ArrowsClockwise className="size-4 mr-2" />
              )}
              Sync Calendar
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4 mr-2" />
                  Schedule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule Meeting Recording</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Meeting Title</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Weekly standup"
                    />
                  </div>
                  <div>
                    <Label>Meeting URL</Label>
                    <Input
                      value={formData.meetingUrl}
                      onChange={(e) => setFormData({ ...formData, meetingUrl: e.target.value })}
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                    />
                  </div>
                  <div>
                    <Label>Scheduled Time</Label>
                    <Input
                      type="datetime-local"
                      value={formData.scheduledAt}
                      onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                    />
                  </div>
                  <Button onClick={handleSchedule} disabled={scheduleMeeting.isPending} className="w-full">
                    {scheduleMeeting.isPending && <CircleNotch className="size-4 mr-2 animate-spin" />}
                    Schedule Recording
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {recordings.data.length === 0 ? (
            <div className="text-center py-8">
              <VideoCamera className="size-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No meetings recorded yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Schedule a meeting or sync from your calendar to get started.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {recordings.data.map((recording) => (
                  <div
                    key={recording.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors group ${
                      selectedRecording === recording.id ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedRecording(recording.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-6 rounded bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {platformIcons[recording.meetingPlatform]}
                        </span>
                        <span className="font-medium">{recording.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[recording.status]}>
                          {recording.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(recording.id);
                          }}
                          disabled={deleteMeeting.isPending}
                        >
                          <Trash className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(recording.scheduledAt), "PPp")}
                    </p>
                    {recording.duration && (
                      <p className="text-xs text-muted-foreground">
                        Duration: {recording.duration} minutes
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Recording Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Title</p>
                <p className="text-sm text-muted-foreground">{selected.title}</p>
              </div>

              {selected.meetingUrl && (
                <div>
                  <p className="text-sm font-medium">Meeting URL</p>
                  <a
                    href={selected.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {selected.meetingUrl}
                  </a>
                </div>
              )}

              {selected.summary && (
                <div>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <FileText className="size-3" /> Summary
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                    {selected.summary}
                  </p>
                </div>
              )}

              {selected.actionItems && (selected.actionItems as { task: string; assignee?: string }[]).length > 0 && (
                <div>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <CheckSquare className="size-3" /> Action Items
                  </p>
                  <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                    {(selected.actionItems as { task: string; assignee?: string }[]).map((item, i) => (
                      <li key={i}>
                        - {item.task} {item.assignee && `(${item.assignee})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.participants && (selected.participants as string[]).length > 0 && (
                <div>
                  <p className="text-sm font-medium">Participants</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(selected.participants as string[]).join(", ")}
                  </p>
                </div>
              )}

              {selected.transcript && (
                <div>
                  <p className="text-sm font-medium">Transcript</p>
                  <ScrollArea className="h-[200px] mt-1">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {selected.transcript}
                    </p>
                  </ScrollArea>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Select a meeting to view details
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
