import { AgentforceConversationClient } from "./components/AgentforceConversationClient";
import ThemeToggle from "./components/ThemeToggle";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Toaster } from "./components/ui/sonner";
import { Keyboard } from "lucide-react";
import { getNavigationRoutes, type NavigationItem } from "./router-utils";
import { useSessionLoginAudit } from "./hooks/useSessionLoginAudit";
import { useAuditActorInit } from "./hooks/useAuditActor";
import { ActorPicker } from "./components/audit/ActorPicker";
import { SidebarUser } from "./components/audit/SidebarUser";
import { processOutboxOnce } from "./api/audit/auditOutbox";
import { KeyboardShortcutsDialog } from "./components/KeyboardShortcutsDialog";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useEffect, useState } from "react";

function isActivePath(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`);
}

function hasActiveChild(pathname: string, item: NavigationItem) {
  return item.children?.some((child) => isActivePath(pathname, child.path)) ?? false;
}

export default function AppLayout() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const items = getNavigationRoutes();
  const location = useLocation();

  const actorInit = useAuditActorInit();
  useSessionLoginAudit(actorInit.ready);

  useKeyboardShortcuts([
    {
      key: "?",
      description: "Toggle shortcuts dialog",
      action: () => setShortcutsOpen((v) => !v),
      global: true,
    },
  ]);

  const agentforceAgentId = import.meta.env.VITE_AGENTFORCE_AGENT_ID;

  useEffect(() => {
    processOutboxOnce().catch((err) => {
      console.error("Failed to process audit outbox", err);
    });
  }, []);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link
            to="/"
            className="flex items-center gap-2 px-2 py-1 text-lg font-semibold text-sidebar-foreground"
          >
            Organisator
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    isActivePath(location.pathname, item.path) ||
                    hasActiveChild(location.pathname, item);

                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <NavLink to={item.path}>
                          <Icon className="size-4" aria-hidden="true" />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                      {item.children && item.children.length > 0 && (
                        <SidebarMenuSub>
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <SidebarMenuSubItem key={child.path}>
                                <SidebarMenuSubButton
                                  asChild
                                  size="sm"
                                  isActive={isActivePath(location.pathname, child.path)}
                                >
                                  <NavLink to={child.path}>
                                    <ChildIcon className="size-4" aria-hidden="true" />
                                    <span>{child.label}</span>
                                  </NavLink>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarUser
            actor={actorInit.actor}
            details={actorInit.details}
            resolving={actorInit.phase === "resolving"}
            switchable={actorInit.switchable}
            onSwitchUser={() => void actorInit.switchUser()}
          />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none print:hidden"
        >
          Zum Hauptinhalt springen
        </a>
        <ActorPicker
          isOpen={actorInit.needsPicker}
          onChoose={actorInit.chooseUser}
          onDismiss={actorInit.dismissPicker}
        />
        <header className="bg-card border-b border-border sticky top-0 z-30 print:hidden">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 h-16">
              <SidebarTrigger />
              <Link to="/" className="text-xl font-semibold text-foreground">
                Organisator
              </Link>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setShortcutsOpen(true)}
                  className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Tastenkürzel anzeigen"
                  title="Tastenkürzel (?)"
                >
                  <Keyboard className="size-5" aria-hidden="true" />
                </button>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 min-w-0">
          <Outlet />
        </main>
      </SidebarInset>

      {agentforceAgentId && (
        <AgentforceConversationClient agentId={agentforceAgentId} />
      )}
      <KeyboardShortcutsDialog isOpen={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <Toaster />
    </SidebarProvider>
  );
}