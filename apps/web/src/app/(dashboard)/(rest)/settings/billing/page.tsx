"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useHasActiveSubscription } from "@/features/subscriptions/hooks/use-subscription";
import { authClient } from "@/lib/auth-client";

export default function BillingSettingsPage() {
    const { hasActiveSubscription, isLoading } = useHasActiveSubscription();

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Current plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-medium">
                                    {hasActiveSubscription ? "Pro" : "Free"}
                                </span>
                                <Badge variant={hasActiveSubscription ? "default" : "secondary"}>
                                    {hasActiveSubscription ? "Active" : "Current"}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {hasActiveSubscription
                                    ? "You have access to all premium features"
                                    : "Upgrade to unlock all features"}
                            </p>
                        </div>
                        {!hasActiveSubscription && !isLoading && (
                            <Button onClick={() => authClient.checkout({ slug: "Pro" })}>
                                Upgrade to Pro
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="font-medium">Credits used this month</span>
                            <p className="text-sm text-muted-foreground">
                                49 / 400 credits
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-bold">351</span>
                            <p className="text-sm text-muted-foreground">remaining</p>
                        </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                        <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: "12.25%" }}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Payment method</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No payment method on file</p>
                    <Button variant="outline" className="mt-4">
                        Add payment method
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Billing history</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No invoices yet</p>
                </CardContent>
            </Card>
        </div>
    );
}
