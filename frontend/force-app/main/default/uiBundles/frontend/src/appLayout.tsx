import { Outlet, Link, useLocation } from "react-router";
import { getNavigationRoutes } from "./router-utils";
import { useEffect, useId, useRef, useState } from "react";
import { Keyboard } from "lucide-react";
import { AuthMenu } from "./features/authentication/menu/AuthMenu";
import { NavigationLinks, PortalSidebar } from "./components/layouts/portal-sidebar";
import { useAuth } from "./features/authentication/context/AuthContext";
import { KeyboardShortcutsDialog } from "./components/KeyboardShortcutsDialog";
import ThemeToggle from "./components/ThemeToggle";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export default function AppLayout() {
	const [isOpen, setIsOpen] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const location = useLocation();
	const navId = useId();
	const outletWrapperRef = useRef<HTMLDivElement>(null);
	const previousPathname = useRef<string | null>(null);
	const { isAuthenticated, loading: authLoading } = useAuth();

	// Bound here and nowhere else. The hook skips keystrokes that come from a text
	// field, so "?" typed into the login form stays a "?" and does not open this.
	useKeyboardShortcuts([
		{
			key: "?",
			description: "Toggle shortcuts dialog",
			action: () => setShortcutsOpen((v) => !v),
		},
	]);

	useEffect(() => {
		if (previousPathname.current !== null && previousPathname.current !== location.pathname) {
			const wrapper = outletWrapperRef.current;
			const target = wrapper?.querySelector<HTMLElement>("h1, main, [role='main']") ?? wrapper;
			if (target) {
				if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
				target.focus();
			}
		}
		previousPathname.current = location.pathname;
	}, [location.pathname]);

	const toggleMenu = () => setIsOpen(!isOpen);

	const navigationRoutes = getNavigationRoutes();

	// The guest menu offers only "Log In" and no participant routes. Hiding the
	// navigation behind a closed disclosure is not enough on its own: e2e
	// asserts an anonymous visitor finds no trace of "Mein Konto".
	const showNavigation = !authLoading && isAuthenticated;

	return (
		<div className="min-h-screen bg-background">
			<a
				href="#main-content"
				onClick={(e) => {
					e.preventDefault();
					const content = outletWrapperRef.current;
					if (content) {
						if (!content.hasAttribute("tabindex")) content.setAttribute("tabindex", "-1");
						content.focus();
					}
				}}
				className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow focus:ring-2 focus:ring-primary"
			>
				Skip to main content
			</a>

			{/* Header markup mirrors the backoffice bundle's `appLayout.tsx`:
			    full-bleed bar, `px-4 sm:px-6 lg:px-8` with no max-width, a `gap-3`
			    row and an `ml-auto` action cluster. The top bar stays on every
			    viewport — it is the site header, not a mobile-only menu. From lg up
			    the sidebar carries the navigation and the user menu, so the header's
			    AuthMenu steps aside, leaving exactly ONE visible "User menu" trigger
			    for the live logout spec to resolve in strict mode. */}
			<header className="sticky top-0 z-30 border-b border-border bg-card">
				<div className="px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 items-center gap-3">
						<button
							type="button"
							onClick={toggleMenu}
							className="rounded-md p-2 text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring lg:hidden"
							aria-label="Toggle menu"
							aria-expanded={isOpen}
							aria-controls={navId}
						>
							<div
								aria-hidden="true"
								className="flex h-6 w-6 flex-col justify-center space-y-1.5"
							>
								<span
									className={`block h-0.5 w-6 bg-current transition-all ${
										isOpen ? "translate-y-2 rotate-45" : ""
									}`}
								/>
								<span
									className={`block h-0.5 w-6 bg-current transition-all ${
										isOpen ? "opacity-0" : ""
									}`}
								/>
								<span
									className={`block h-0.5 w-6 bg-current transition-all ${
										isOpen ? "-translate-y-2 -rotate-45" : ""
									}`}
								/>
							</div>
						</button>
						<Link to="/" className="text-xl font-semibold text-foreground">
							Organisator
						</Link>
						<div className="ml-auto flex items-center gap-2">
							<button
								type="button"
								onClick={() => setShortcutsOpen(true)}
								className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								aria-label="Tastenkürzel anzeigen"
								title="Tastenkürzel (?)"
							>
								<Keyboard className="size-5" aria-hidden="true" />
							</button>
							<ThemeToggle />
							<div className="lg:hidden">
								<AuthMenu />
							</div>
						</div>
					</div>
					{/* Below lg the sidebar does not exist, so the header keeps offering
					    the navigation itself. */}
					<div id={navId} className="pb-4 lg:hidden" hidden={!isOpen || !showNavigation}>
						{isOpen && showNavigation && <NavigationLinks items={navigationRoutes} onNavigate={() => setIsOpen(false)} />}
					</div>
				</div>
			</header>

			<div className="flex">
				<PortalSidebar items={navigationRoutes} />

				<div id="main-content" ref={outletWrapperRef} className="min-w-0 flex-1">
					<Outlet />
				</div>
			</div>

			<KeyboardShortcutsDialog isOpen={shortcutsOpen} onOpenChange={setShortcutsOpen} />
		</div>
	);
}
