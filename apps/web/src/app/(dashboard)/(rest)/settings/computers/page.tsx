"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Gear } from "@phosphor-icons/react";

// Mock data
const COMPUTERS = [
    {
        id: "1",
        name: "Martin's Computer",
        usedBy: "Not in use",
    },
];

export default function ComputersSettingsPage() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Computers</CardTitle>
                <Button>Add computer</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Used by</TableHead>
                            <TableHead className="w-10"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {COMPUTERS.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                    No computers configured
                                </TableCell>
                            </TableRow>
                        ) : (
                            COMPUTERS.map((computer) => (
                                <TableRow key={computer.id}>
                                    <TableCell className="font-medium">{computer.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{computer.usedBy}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="size-8">
                                            <Gear className="size-4" />
                                        </Button>
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
