"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface InviteMembersDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function InviteMembersDialog({ open, onOpenChange }: InviteMembersDialogProps) {
    const [emails, setEmails] = useState("");
    const [role, setRole] = useState("member");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement invite logic
        console.log("Inviting:", { emails, role });
        onOpenChange(false);
        setEmails("");
        setRole("member");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Invite members</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="emails">Email addresses</Label>
                        <Input
                            id="emails"
                            placeholder="Enter emails, separated by spaces"
                            value={emails}
                            onChange={(e) => setEmails(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="member">
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">Member</span>
                                        <span className="text-xs text-muted-foreground">
                                            Can use and create agents.
                                        </span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="admin">
                                    <div className="flex flex-col items-start">
                                        <span className="font-medium">Admin</span>
                                        <span className="text-xs text-muted-foreground">
                                            Manage billing, add team members, and inspect spend.
                                        </span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={!emails.trim()}>
                            Send invite
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
