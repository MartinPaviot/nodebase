"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Gear,
    Waveform,
    Link as LinkIcon,
    Phone,
    Monitor,
    Bell,
    CreditCard,
    Shield,
    Users,
    CaretLeft,
    Envelope,
} from "@phosphor-icons/react";

const SETTINGS_NAV = [
    {
        title: null,
        items: [
            { label: "General", href: "/settings", icon: Gear },
            { label: "Speech to text", href: "/settings/speech", icon: Waveform },
            { label: "Connections", href: "/settings/connections", icon: LinkIcon },
            { label: "Mailboxes", href: "/settings/mailboxes", icon: Envelope },
            { label: "Phone numbers", href: "/settings/phone", icon: Phone },
            { label: "Computers", href: "/settings/computers", icon: Monitor },
            { label: "Notifications", href: "/settings/notifications", icon: Bell },
        ],
    },
    {
        title: "Workspace",
        items: [
            { label: "Settings", href: "/settings/workspace", icon: Gear },
            { label: "Billing", href: "/settings/billing", icon: CreditCard },
            { label: "Security and identity", href: "/settings/security", icon: Shield },
            { label: "Members and groups", href: "/settings/members", icon: Users },
        ],
    },
];

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <header className="flex items-center h-14 px-4 border-b">
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => router.push("/home")}
                >
                    <CaretLeft className="size-4" />
                    Back
                </Button>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <aside className="w-56 border-r flex flex-col overflow-y-auto p-2">
                    {SETTINGS_NAV.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="mb-4">
                            {section.title && (
                                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                                    {section.title}
                                </div>
                            )}
                            <nav className="flex flex-col gap-1">
                                {section.items.map((item) => {
                                    const isActive = pathname === item.href ||
                                        (item.href !== "/settings" && pathname.startsWith(item.href));
                                    const isGeneralActive = item.href === "/settings" && pathname === "/settings";

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                                (isActive || isGeneralActive)
                                                    ? "bg-accent text-accent-foreground font-medium"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <item.icon className="size-4" />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    ))}
                </aside>

                {/* Content */}
                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-2xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
