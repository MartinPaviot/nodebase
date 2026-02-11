"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "@phosphor-icons/react";

interface NewWorkspaceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NewWorkspaceDialog({ open, onOpenChange }: NewWorkspaceDialogProps) {
    const [workspaceName, setWorkspaceName] = useState("");
    const [emails, setEmails] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement workspace creation logic
        console.log("Creating workspace:", { workspaceName, emails });
        onOpenChange(false);
        setWorkspaceName("");
        setEmails("");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden">
                <div className="flex">
                    {/* Left side - Form */}
                    <div className="flex-1 p-8">
                        <h2 className="text-2xl font-semibold mb-1">
                            Create a workspace and
                        </h2>
                        <h2 className="text-2xl font-semibold mb-8">
                            invite others to join.
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Logo upload */}
                            <div className="flex items-center gap-3">
                                <div className="size-12 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center text-muted-foreground text-sm">
                                    Logo
                                </div>
                                <Button variant="link" className="p-0 h-auto text-primary">
                                    Upload your logo
                                </Button>
                            </div>

                            {/* Workspace name */}
                            <div className="space-y-2">
                                <Label htmlFor="workspace-name" className="text-primary font-medium">
                                    Workspace name
                                </Label>
                                <Input
                                    id="workspace-name"
                                    placeholder="Enter workspace name"
                                    value={workspaceName}
                                    onChange={(e) => setWorkspaceName(e.target.value)}
                                    className="border-primary/30 focus-visible:ring-primary"
                                />
                            </div>

                            {/* Invite members */}
                            <div className="space-y-2">
                                <Label htmlFor="invite-emails" className="text-primary font-medium">
                                    Invite members to join
                                </Label>
                                <Textarea
                                    id="invite-emails"
                                    placeholder="Separate emails by comma"
                                    value={emails}
                                    onChange={(e) => setEmails(e.target.value)}
                                    rows={4}
                                    className="resize-none"
                                />
                            </div>

                            {/* Submit button */}
                            <div className="flex justify-center pt-4">
                                <Button
                                    type="submit"
                                    variant="outline"
                                    className="gap-2"
                                    disabled={!workspaceName.trim()}
                                >
                                    Create workspace
                                    <ArrowRight className="size-4" />
                                </Button>
                            </div>
                        </form>
                    </div>

                    {/* Right side - Preview illustration */}
                    <div className="w-80 bg-gradient-to-br from-indigo-50 to-blue-100 p-6 flex items-center justify-center">
                        <div className="w-full max-w-[200px] bg-card rounded-xl shadow-lg p-4 space-y-3">
                            {/* Mock sidebar preview */}
                            <div className="flex items-center gap-2">
                                <div className="size-6 rounded bg-indigo-200" />
                                <div className="flex-1 space-y-1">
                                    <div className="h-2 bg-muted rounded w-3/4" />
                                    <div className="h-1.5 bg-muted rounded w-1/2" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-2 bg-muted rounded w-full" />
                                <div className="h-2 bg-muted rounded w-3/4" />
                                <div className="h-2 bg-muted rounded w-5/6" />
                                <div className="h-2 bg-muted rounded w-2/3" />
                            </div>
                            <div className="pt-2 border-t">
                                <div className="text-[10px] text-muted-foreground mb-1">Your Agents</div>
                                <div className="space-y-1">
                                    <div className="h-2 bg-muted rounded w-full" />
                                    <div className="flex gap-1">
                                        <div className="h-2 bg-muted rounded w-1/3" />
                                        <div className="h-2 bg-muted rounded w-1/3" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
