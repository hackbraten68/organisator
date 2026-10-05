/**
 * SidebarUser: "who am I + with which role" footer for the app sidebar.
 *
 * Avatar (real photo, initials fallback) + first name + profile name.
 * The dropdown IS the future user settings menu: entries live in
 * USER_MENU_ITEMS so settings land here without rebuilding the menu.
 * No logout item by design — the bundle owns no session to end.
 */

import { ChevronsUpDown, Repeat } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActorInfo } from "@/types/audit";
import type { ActorDetails } from "@/api/audit/actorContext";

export interface SidebarUserProps {
  actor: ActorInfo;
  details: ActorDetails | null;
  resolving: boolean;
  /** False when the server resolved the actor: there is nothing to switch to. */
  switchable: boolean;
  onSwitchUser: () => void;
}

interface UserMenuEntry {
  key: string;
  label: string;
  icon: typeof Repeat;
  action: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

export function SidebarUser({ actor, details, resolving, switchable, onSwitchUser }: SidebarUserProps) {
  if (resolving) {
    return (
      <div className="flex items-center gap-2.5 px-2 py-2" aria-label="Benutzer wird geladen">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    );
  }

  const displayName = details?.firstName ?? actor.displayName;
  const roleLine = details?.profileName ?? (actor.type === "system" ? "System" : "Team");

  // Future settings entries append here — same menu, no rebuild.
  const menuEntries: UserMenuEntry[] = switchable
    ? [{ key: "switch-user", label: "Benutzer wechseln", icon: Repeat, action: onSwitchUser }]
    : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={`Angemeldet als ${details?.fullName ?? displayName}`}
        >
          <Avatar className="size-8">
            {details?.photoUrl && <AvatarImage src={details.photoUrl} alt="" />}
            <AvatarFallback>{initials(displayName)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">{roleLine}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {details?.fullName ?? displayName}
            </span>
            {details?.username && (
              <span className="truncate text-xs text-muted-foreground">{details.username}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {details?.profileName ?? "Profil unbekannt"}
              {details?.roleName ? ` · ${details.roleName}` : " · keine Rolle zugewiesen"}
            </span>
          </span>
        </DropdownMenuLabel>
        {menuEntries.length > 0 && <DropdownMenuSeparator />}
        {menuEntries.map((entry) => (
          <DropdownMenuItem key={entry.key} onSelect={entry.action}>
            <entry.icon className="size-4" aria-hidden="true" />
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
