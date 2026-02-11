"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DotsThree, UserPlus } from "@phosphor-icons/react";
import { useSession } from "@/lib/auth-client";
import { InviteMembersDialog } from "@/components/invite-members-dialog";

export default function MembersSettingsPage() {
    const { data: session } = useSession();
    const [inviteOpen, setInviteOpen] = useState(false);

    const userName = session?.user?.name || "User";
    const userEmail = session?.user?.email || "";
    const firstName = userName.split(" ")[0];

    // Mock members data
    const members = [
        {
            id: session?.user?.id || "1",
            name: userName,
            email: userEmail,
            image: session?.user?.image,
            role: "Admin",
            status: "Active",
        },
    ];

    return (
        <>
            <div className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Members</CardTitle>
                        <Button className="gap-2" onClick={() => setInviteOpen(true)}>
                            <UserPlus className="size-4" />
                            Invite members
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Member</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-8">
                                                    {member.image ? (
                                                        <AvatarImage src={member.image} alt={member.name} />
                                                    ) : null}
                                                    <AvatarFallback className="bg-indigo-500 text-white text-xs">
                                                        {member.name[0]?.toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-medium">{member.name}</div>
                                                    <div className="text-sm text-muted-foreground">{member.email}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={member.role === "Admin" ? "default" : "secondary"}>
                                                {member.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                                                {member.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="size-8">
                                                        <DotsThree className="size-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem>Change role</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive">
                                                        Remove from workspace
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Groups</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No groups created yet</p>
                        <Button variant="outline" className="mt-4">
                            Create group
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Pending invitations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No pending invitations</p>
                    </CardContent>
                </Card>
            </div>

            <InviteMembersDialog open={inviteOpen} onOpenChange={setInviteOpen} />
        </>
    );
}
