"use client";

import { SidebarTrigger, useSidebar } from "./ui/sidebar";

export const AppHeader = () => {
    const { open } = useSidebar();

    return(
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-background">
            {!open && <SidebarTrigger />}
        </header>
    );
};