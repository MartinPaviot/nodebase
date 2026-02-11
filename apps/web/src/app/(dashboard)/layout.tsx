import { AppSidebar } from "@/components/app-sidebar";
import { SidebarEdgeTrigger } from "@/components/sidebar-edge-trigger";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Force dynamic rendering because AppSidebar fetches user-specific data
export const dynamic = "force-dynamic";

const Layout = ({ children }: { children: React.ReactNode; }) =>
    {
        return (
            <SidebarProvider defaultOpen={false}>
                <AppSidebar/>
                <SidebarEdgeTrigger />
                <SidebarInset className="bg-accent/20 overflow-x-hidden">
                    {children}
                </SidebarInset>
            </SidebarProvider>
        );
    };

export default Layout;