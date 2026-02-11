"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SecuritySettingsPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Single Sign-On (SSO)</CardTitle>
                    <CardDescription>
                        Configure SSO for your workspace to allow members to sign in with your identity provider
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">SAML SSO</span>
                                <Badge variant="secondary">Enterprise</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                Connect your identity provider for secure authentication
                            </p>
                        </div>
                        <Button variant="outline" disabled>
                            Configure
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Session management</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Require re-authentication</Label>
                            <p className="text-sm text-muted-foreground">
                                Require members to re-authenticate after a period of inactivity
                            </p>
                        </div>
                        <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Enforce 2FA for all members</Label>
                            <p className="text-sm text-muted-foreground">
                                Require all workspace members to enable two-factor authentication
                            </p>
                        </div>
                        <Switch />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Data & Privacy</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Data retention</Label>
                            <p className="text-sm text-muted-foreground">
                                Automatically delete conversation history after 90 days
                            </p>
                        </div>
                        <Switch />
                    </div>
                    <Button variant="outline">
                        Export all data
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
