/**
 * PortalSidebar: the persistent desktop navigation plus the signed-in
 * participant's identity, in the same shape the backoffice bundle uses
 * (`backend/.../src/appLayout.tsx` + `components/audit/SidebarUser.tsx`).
 *
 * WHY THE SIDEBAR LIVES OUTSIDE `PrivateRoute`
 *   It is gated on `isAuthenticated` here instead. `PrivateRoute` renders inside
 *   the app shell, so a sidebar there would land *inside* the `#main-content`
 *   wrapper — the skip link and the focus-on-route-change logic would then treat
 *   the navigation as main content. Keeping it in the shell leaves exactly one
 *   `main-content` and one place that decides what a guest may see.
 *
 * WHY THE GUARD IS NOT OPTIONAL
 *   e2e/app.spec.ts asserts an anonymous visitor finds no trace of the
 *   participant navigation (`getByText('Mein Konto')` must have count 0). That
 *   assertion only passed before because the navigation lived inside a closed
 *   hamburger disclosure. Rendering it unconditionally would leak the route
 *   labels to guests AND break that test.
 *
 * WHY THE FOOTER IS THE USER MENU
 *   The backoffice footer is "who am I + which role", and its dropdown is the
 *   future settings menu. The portal's equivalent has to own Sign Out as well,
 *   because this bundle owns the session. So the footer wraps `AuthMenu`: the
 *   identity row is ours, the menu is the existing, already-tested one. Its
 *   `aria-label="User menu"` is kept intact — the live logout spec locates the
 *   trigger by that name.
 */
import { NavLink } from "react-router";
import { ChevronsUpDown } from "lucide-react";
import { useAuth } from "../../features/authentication/context/AuthContext";
import { AuthMenu } from "../../features/authentication/menu/AuthMenu";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { useParticipant } from "../../features/participant/context/ParticipantContext";

export interface NavigationLinkItem {
	path: string;
	label: string;
	icon: typeof ChevronsUpDown;
}

function navigationLinkClass(isActive: boolean): string {
	return `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
		isActive
			? "bg-accent text-accent-foreground"
			: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
	}`;
}

export function NavigationLinks({
	items,
	onNavigate,
}: {
	items: NavigationLinkItem[];
	onNavigate?: () => void;
}) {
	return (
		<div className="flex flex-col gap-1">
			{items.map((item) => {
				const Icon = item.icon;
				return (
					<NavLink
						key={item.path}
						to={item.path}
						onClick={onNavigate}
						className={({ isActive }) => navigationLinkClass(isActive)}
					>
						<Icon className="size-4 shrink-0" aria-hidden="true" />
						{item.label}
					</NavLink>
				);
			})}
		</div>
	);
}

function initials(name: string): string {
	const parts = name.trim().split(/\s+/);
	const first = parts[0]?.[0] ?? "?";
	const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
	return (first + second).toUpperCase();
}

/**
 * Identity row + menu, pinned to the bottom of the sidebar.
 *
 * The name comes from `/me` (the participant record), not from the auth
 * context: `getCurrentUser()` returns the session identity and is not reliably
 * the participant's name.
 */
function SidebarUser() {
	const { user, loading } = useAuth();
	const { me } = useParticipant();

	if (loading) return null;

	const displayName = me?.participantName ?? me?.contactName ?? user?.name ?? "Teilnehmer";

	return (
		<AuthMenu
			className="w-64"
			side="top"
			align="start"
			trigger={() => (
				<button
					type="button"
					className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
					aria-label="User menu"
				>
					<Avatar className="size-8">
						<AvatarFallback>{initials(displayName)}</AvatarFallback>
					</Avatar>
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="truncate text-sm font-medium text-foreground">
							{displayName}
						</span>
						<span className="truncate text-xs text-muted-foreground">Teilnehmer</span>
					</span>
					<ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
				</button>
			)}
		/>
	);
}

export interface PortalSidebarProps {
	items: NavigationLinkItem[];
	/** Top offset of the sticky header, so the sidebar does not slide under it. */
	headerHeightClass?: string;
}

export function PortalSidebar({
	items,
	headerHeightClass = "top-16 min-h-[calc(100vh-4rem)]",
}: PortalSidebarProps) {
	const { isAuthenticated, loading } = useAuth();

	// No navigation for guests. See the class comment for the assertion that
	// depends on this.
	if (loading || !isAuthenticated) return null;

	return (
		<aside className="hidden w-64 shrink-0 lg:block">
			<nav
				aria-label="Hauptnavigation"
				// Class set matches the backoffice sidebar verbatim, so the two shells
				// line up pixel for pixel. `--card` is pure white where `--sidebar`
				// is a shade off it, hence `bg-card` rather than `bg-sidebar`.
				className={`sticky ${headerHeightClass} flex flex-col border-r border-border bg-card p-3`}
			>
				<NavigationLinks items={items} />
				<div className="mt-auto border-t border-border pt-2">
					<SidebarUser />
				</div>
			</nav>
		</aside>
	);
}