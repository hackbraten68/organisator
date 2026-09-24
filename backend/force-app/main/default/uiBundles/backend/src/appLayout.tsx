import { AgentforceConversationClient } from "./components/AgentforceConversationClient";
import { Link, NavLink, Outlet } from "react-router";
import { Toaster } from "./components/ui/sonner";
import { Menu, X } from "lucide-react";
import { getNavigationRoutes, type NavigationItem } from "./router-utils";
import { useState } from "react";

function navigationLinkClass(isActive: boolean) {
	return `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
		isActive
			? "bg-blue-100 text-blue-700"
			: "text-gray-700 hover:bg-gray-100"
	}`;
}

function NavigationLinks({
	items,
	onNavigate,
}: {
	items: NavigationItem[];
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

export default function AppLayout() {
	const [mobileOpen, setMobileOpen] = useState(false);
	const items = getNavigationRoutes();
	const closeMobileMenu = () => setMobileOpen(false);

	return (
		<div className="min-h-screen bg-gray-50">
			<header className="bg-white border-b border-gray-200 sticky top-0 z-30">
				<div className="px-4 sm:px-6 lg:px-8">
					<div className="flex items-center gap-3 h-16">
						<button
							onClick={() => setMobileOpen(true)}
							className="lg:hidden p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
							aria-label="Open menu"
						>
							<Menu className="size-6" aria-hidden="true" />
						</button>
						<Link to="/" className="text-xl font-semibold text-gray-900">
							Organisator
						</Link>
					</div>
				</div>
			</header>

			<div className="flex">
				<aside className="hidden lg:block w-64 shrink-0">
					<nav
						aria-label="Main navigation"
						className="sticky top-16 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] p-3"
					>
						<NavigationLinks items={items} />
					</nav>
				</aside>

				{mobileOpen && (
					<>
						<div
							className="fixed inset-0 z-40 bg-black/40 lg:hidden"
							onClick={closeMobileMenu}
							aria-hidden="true"
						/>
						<aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 p-3 lg:hidden">
							<div className="flex items-center justify-between px-1 pb-3">
								<span className="text-lg font-semibold text-gray-900">
									Organisator
								</span>
								<button
									onClick={closeMobileMenu}
									className="p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
						</aside>
					</>
				)}

				<main className="flex-1 min-w-0">
					<Outlet />
				</main>
			</div>

			<AgentforceConversationClient agentId="<USER_AGENT_ID_18_CHAR_0Xx...>" />
			<Toaster />
		</div>
	);
}
