import { createFileRoute, Outlet, redirect, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { CalendarDays, ClipboardList, History, LayoutDashboard, ReceiptText, Settings, Users, LogOut } from "lucide-react";
import { toast } from "sonner";
import logoImg from "@/assets/l.png";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { to: "/bookings", label: "Бронювання", icon: CalendarDays },
  { to: "/clients", label: "Клієнти", icon: Users },
  { to: "/receipts", label: "Чеки", icon: ReceiptText },
  { to: "/instructions", label: "Інструкції", icon: ClipboardList },
  { to: "/audit", label: "Історія", icon: History },
  { to: "/settings", label: "Налаштування", icon: Settings },
] as const;

function AuthedLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("До зустрічі!");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background" data-admin-shell="true">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white p-1">
                <img src={logoImg} alt="Soloway" className="h-full w-full object-contain" />
              </div>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-semibold">Soloway</span>
                <span className="text-xs text-muted-foreground">CRM</span>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV.map((item) => {
                    const active = pathname === item.to || pathname.startsWith(item.to + "/");
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link to={item.to}>
                            <item.icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut} tooltip="Вийти">
                  <LogOut />
                  <span>Вийти</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur md:px-6">
            <SidebarTrigger />
            <div className="flex-1" />
            <Button asChild size="sm" variant="ghost" onClick={handleSignOut}>
              <span className="cursor-pointer"><LogOut className="mr-1 h-4 w-4" />Вийти</span>
            </Button>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
