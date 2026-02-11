"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function WorkspaceSettingsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Workspace settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Workspace Logo */}
                <div className="space-y-2">
                    <Label>Workspace logo</Label>
                    <div className="flex items-center gap-4">
                        <Avatar className="size-16">
                            <AvatarFallback className="bg-indigo-500 text-white text-xl">
                                M
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-2">
                            <Button variant="default" size="sm">
                                Upload Logo
                            </Button>
                            <Button variant="outline" size="sm">
                                Remove Logo
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Workspace Name */}
                <div className="space-y-2">
                    <Label htmlFor="workspace-name">Workspace name</Label>
                    <Input
                        id="workspace-name"
                        defaultValue="Martin's Workspace"
                        className="max-w-md"
                    />
                </div>

                {/* Workspace URL */}
                <div className="space-y-2">
                    <Label htmlFor="workspace-url">Workspace URL</Label>
                    <div className="flex items-center gap-2 max-w-md">
                        <span className="text-muted-foreground text-sm">nodebase.app/</span>
                        <Input
                            id="workspace-url"
                            defaultValue="martins-workspace"
                        />
                    </div>
                </div>

                {/* Save Button */}
                <Button>Save changes</Button>

                {/* Danger Zone */}
                <div className="pt-6 border-t space-y-4">
                    <h3 className="font-medium text-destructive">Danger zone</h3>
                    <Button variant="outline" className="text-destructive hover:text-destructive">
                        Delete Workspace
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
