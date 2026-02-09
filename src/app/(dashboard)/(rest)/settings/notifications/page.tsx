"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const EMAIL_NOTIFICATIONS = [
    {
        id: "confirmation",
        label: "Confirmation",
        description: "Get notified when the agent needs your confirmation",
        defaultChecked: true,
    },
    {
        id: "auth-requests",
        label: "Authentication requests",
        description: "Get notified when the agent needs authentication",
        defaultChecked: true,
    },
    {
        id: "errors",
        label: "Errors",
        description: "Get notified when the agent encounters an error",
        defaultChecked: true,
    },
    {
        id: "messages",
        label: "Messages",
        description: "Get notified when the agent sends you a message",
        defaultChecked: true,
    },
    {
        id: "weekly-summary",
        label: "Weekly activity summary",
        description: "Receive weekly summaries of your task activity",
        defaultChecked: true,
    },
    {
        id: "team-summary",
        label: "Team weekly activity summary",
        description: "Receive weekly summaries of your team's task activity",
        defaultChecked: true,
    },
];

const IN_APP_NOTIFICATIONS = [
    {
        id: "task-finished",
        label: "Task finished",
        description: "Play a sound when a task is finished",
        defaultChecked: true,
    },
];

export default function NotificationsSettingsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Manage your email notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {EMAIL_NOTIFICATIONS.map((notification) => (
                    <div key={notification.id} className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor={notification.id}>{notification.label}</Label>
                            <p className="text-sm text-muted-foreground">
                                {notification.description}
                            </p>
                        </div>
                        <Switch id={notification.id} defaultChecked={notification.defaultChecked} />
                    </div>
                ))}

                <div className="pt-6 border-t">
                    <h3 className="font-medium mb-4">Manage your in-app notifications</h3>
                    {IN_APP_NOTIFICATIONS.map((notification) => (
                        <div key={notification.id} className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor={notification.id}>{notification.label}</Label>
                                <p className="text-sm text-muted-foreground">
                                    {notification.description}
                                </p>
                            </div>
                            <Switch id={notification.id} defaultChecked={notification.defaultChecked} />
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
