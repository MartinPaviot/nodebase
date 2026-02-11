"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DotsThree } from "@phosphor-icons/react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data - replace with actual data
const CONNECTIONS = [
    {
        id: "1",
        name: "Microsoft Outlook",
        email: "martin.paviot@outlook.com",
        usedBy: 1,
        status: "connected" as const,
        shared: false,
        icon: "📧",
    },
];

export default function ConnectionsSettingsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Connections</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>App</TableHead>
                            <TableHead>Used by</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Shared</TableHead>
                            <TableHead className="w-10"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {CONNECTIONS.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                    No connections yet
                                </TableCell>
                            </TableRow>
                        ) : (
                            CONNECTIONS.map((connection) => (
                                <TableRow key={connection.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span>{connection.icon}</span>
                                            <div>
                                                <span className="font-medium">{connection.name}</span>
                                                <span className="text-muted-foreground ml-2">• {connection.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-muted-foreground">◇</span> {connection.usedBy}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                                            <span className="mr-1">●</span> Connected
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {connection.shared ? "Shared" : "Not shared"}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="size-8">
                                                    <DotsThree className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem>Disconnect</DropdownMenuItem>
                                                <DropdownMenuItem>Share with workspace</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
