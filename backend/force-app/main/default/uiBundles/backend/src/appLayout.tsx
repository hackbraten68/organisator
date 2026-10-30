import { AgentforceConversationClient } from "./components/AgentforceConversationClient";
import ThemeToggle from "./components/ThemeToggle";
import { Link, NavLink, Outlet } from "react-router";
import { Toaster } from "./components/ui/sonner";
import { Menu, X, Keyboard } from "lucide-react";
import { getNavigationRoutes, type NavigationItem } from "./router-utils";
import { useSessionLoginAudit } from "./hooks/useSessionLoginAudit";
import { useAuditActorInit } from "./hooks/useAuditActor";
import { ActorPicker } from "./components/audit/ActorPicker";
import { SidebarUser } from "./components/audit/SidebarUser";
import { processOutboxOnce } from "./api/audit/auditOutbox";
import { KeyboardShortcutsDialog } from "./components/KeyboardShortcutsDialog";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useEffect, useState } from "react";

function navigationLinkClass(isActive: boolean, depth = 0) {
	const base =
		depth === 0
			? "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
			: "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors";

	return `${base} ${
		isActive
			? "bg-accent text-accent-foreground"
			: "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
	}`;
}

function NavigationLinks({
	items,
	onNavigate,
	depth = 0,
}: {
	items: NavigationItem[];
	onNavigate?: () => void;
	depth?: number;
}) {
	return (
		<div
			className={
				depth === 0
					? "flex flex-col gap-1"
					: "mt-1 ml-4 flex flex-col gap-0.5 border-l border-border pl-3"
			}
		>
			{items.map((item) => {
				const Icon = item.icon;
				return (
					<div key={item.path}>
						<NavLink
							to={item.path}
							onClick={onNavigate}
							className={({ isActive }) =>
								navigationLinkClass(isActive, depth)
							}
						>
							{depth === 0 ? (
								<Icon className="size-4 shrink-0" aria-hidden="true" />
							) : (
								<span
									className="size-1.5 shrink-0 rounded-full bg-current opacity-60"
									aria-hidden="true"
								/>
							)}
							{item.label}
						</NavLink>
						{item.children && item.children.length > 0 && (
							<NavigationLinks
								items={item.children}
								onNavigate={onNavigate}
								depth={depth + 1}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}

export default function AppLayout() {
	const [mobileOpen, setMobileOpen] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const items = getNavigationRoutes();
	const closeMobileMenu = () => setMobileOpen(false);

	useKeyboardShortcuts([
		{
			key: "?",
			description: "Toggle shortcuts dialog",
			action: () => setShortcutsOpen((v) => !v),
			global: true,
		},
	]);
	// Unset in local dev: the embed needs a real Agentforce agent id, and a
	// placeholder only produces a frontdoor fetch plus CSP noise per load.
	const agentforceAgentId = import.meta.env.VITE_AGENTFORCE_AGENT_ID;
	const actorInit = useAuditActorInit();
	// Login audit waits for actor resolution so the event carries the real
	// actor (or a picked name) instead of a premature SYSTEM.
	useSessionLoginAudit(actorInit.ready);
	// Outbox worker: replay lost audit writes once per app start, best-effort
	// (ADR-14). At-least-once by design; replays reuse the frozen
	// correlationId so duplicates collapse in the timeline.
	useEffect(() => {
		processOutboxOnce().catch((err) => {
			console.error("Failed to process audit outbox", err);
		});
	}, []);

	return (
		<div className="min-h-screen bg-background">
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
						<button
							onClick={() => setMobileOpen(true)}
							className="lg:hidden p-2 rounded-md text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
							aria-label="Open menu"
						>
							<Menu className="size-6" aria-hidden="true" />
						</button>
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

			<div className="flex">
				<aside className="hidden lg:block w-64 shrink-0 print:hidden">
					<nav
						aria-label="Main navigation"
						className="sticky top-16 bg-card border-r border-border min-h-[calc(100vh-4rem)] p-3 flex flex-col"
					>
						<NavigationLinks items={items} />
						<div className="mt-auto border-t border-border pt-2">
							<SidebarUser
								actor={actorInit.actor}
								details={actorInit.details}
								resolving={actorInit.phase === "resolving"}
								switchable={actorInit.switchable}
								onSwitchUser={() => void actorInit.switchUser()}
							/>
						</div>
					</nav>
				</aside>

				{mobileOpen && (
					<>
						<div
							className="fixed inset-0 z-40 bg-black/40 lg:hidden print:hidden"
							onClick={closeMobileMenu}
							aria-hidden="true"
						/>
						<aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border p-3 lg:hidden flex flex-col print:hidden">
							<div className="flex items-center justify-between px-1 pb-3">
								<span className="text-lg font-semibold text-foreground">
									Organisator
								</span>
								<button
									onClick={closeMobileMenu}
									className="p-2 rounded-md text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
									aria-label="Close menu"
								>
									<X className="size-5" aria-hidden="true" />
								</button>
							</div>
							<nav aria-label="Main navigation">
								<NavigationLinks
									items={items}
									onNavigate={closeMobileMenu}
								/>
							</nav>
							<div className="mt-auto border-t border-border pt-2">
								<SidebarUser
									actor={actorInit.actor}
									details={actorInit.details}
									resolving={actorInit.phase === "resolving"}
									switchable={actorInit.switchable}
									onSwitchUser={() => {
										closeMobileMenu();
										void actorInit.switchUser();
									}}
								/>
							</div>
						</aside>
					</>
				)}

			<main id="main-content" className="flex-1 min-w-0">
				<Outlet />
			</main>
			</div>

		{agentforceAgentId && (
			<AgentforceConversationClient agentId={agentforceAgentId} />
		)}
		<KeyboardShortcutsDialog isOpen={shortcutsOpen} onOpenChange={setShortcutsOpen} />
		<Toaster />
	</div>
	);
}
