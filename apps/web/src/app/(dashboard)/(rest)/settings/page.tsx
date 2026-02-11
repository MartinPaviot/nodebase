"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function GeneralSettingsPage() {
    const { data: session } = useSession();
    const [theme, setTheme] = useState("light");

    const userName = session?.user?.name || "User";
    const userEmail = session?.user?.email || "";
    const firstName = userName.split(" ")[0];

    return (
        <Card>
            <CardHeader>
                <CardTitle>General settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* Profile Picture */}
                <div className="space-y-2">
                    <Label>Profile picture</Label>
                    <div className="flex items-center gap-4">
                        <Avatar className="size-16">
                            {session?.user?.image ? (
                                <AvatarImage src={session.user.image} alt={userName} />
                            ) : null}
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xl">
                                {firstName[0]?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-2">
                            <Button variant="default" size="sm">
                                Upload Avatar
                            </Button>
                            <Button variant="outline" size="sm">
                                Delete Avatar
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Full Name */}
                <div className="flex items-center justify-between">
                    <div>
                        <Label>Full name</Label>
                        <p className="text-sm text-muted-foreground">{userName}</p>
                    </div>
                    <Button variant="link" className="text-primary">
                        Edit
                    </Button>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between">
                    <div>
                        <Label>Email address</Label>
                        <p className="text-sm text-muted-foreground">{userEmail}</p>
                    </div>
                    <Button variant="link" className="text-primary">
                        Edit
                    </Button>
                </div>

                {/* Password */}
                <div className="flex items-center justify-between">
                    <div>
                        <Label>Password</Label>
                    </div>
                    <Button variant="link" className="text-primary">
                        Change Password
                    </Button>
                </div>

                {/* Two-Factor Authentication */}
                <div className="space-y-4">
                    <div>
                        <h3 className="font-medium">Two-Factor Authentication</h3>
                        <p className="text-sm text-muted-foreground">
                            Enable two-factor authentication for enhanced security
                        </p>
                    </div>
                    <RadioGroup defaultValue="none" className="space-y-3">
                        <div className="flex items-start space-x-3">
                            <RadioGroupItem value="authenticator" id="authenticator" />
                            <div className="grid gap-1">
                                <Label htmlFor="authenticator" className="font-normal">
                                    Authenticator app
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Use an authenticator app like Google Authenticator or 1Password
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <RadioGroupItem value="email" id="email-2fa" />
                            <div className="grid gap-1">
                                <Label htmlFor="email-2fa" className="font-normal">
                                    Email verification
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Receive a verification code via email on each login
                                </p>
                            </div>
                        </div>
                    </RadioGroup>
                </div>

                {/* Theme */}
                <div className="flex items-center justify-between">
                    <Label>Theme</Label>
                    <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Delete Account */}
                <div className="pt-4 border-t">
                    <Button variant="outline" className="text-destructive hover:text-destructive">
                        Delete Account
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
