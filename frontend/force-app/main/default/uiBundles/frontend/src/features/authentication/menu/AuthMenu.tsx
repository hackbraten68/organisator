import { CircleUser, LogIn, LogOut, UserPen } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import { ROUTES } from "../authenticationConfig";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

interface User {
	readonly id: string;
	readonly name: string;
}

export interface AuthMenuProps {
	/** Custom trigger button for the authenticated user's dropdown */
	trigger?: (user: User) => React.ReactNode;
	/** Content rendered instead of the dropdown when the user is not logged in (e.g. a standalone Sign In button) */
	guestContent?: React.ReactNode;
	/** Extra menu items inserted after "Edit Profile" and before "Sign Out" */
	menuItems?: React.ReactNode;
	/** CSS class applied to the DropdownMenuContent wrapper */
	className?: string;
	/**
	 * Side the menu opens towards. A trigger at the bottom of the viewport must
	 * use "top" or the menu renders off-screen — the sidebar footer is that case.
	 */
	side?: "top" | "right" | "bottom" | "left";
	/** Alignment against the trigger; the footer aligns to its own left edge. */
	align?: "start" | "center" | "end";
}

export function AuthMenu({
	trigger,
	guestContent,
	menuItems,
	className,
	side = "bottom",
	align = "end",
}: AuthMenuProps) {
	const { user, isAuthenticated, loading, logout } = useAuth();

	if (loading) {
		return <Skeleton className="size-8 rounded-full" />;
	}

	if (!isAuthenticated && guestContent) {
		return <>{guestContent}</>;
	}

	const defaultTrigger = (
		<Button variant="ghost" size="icon" aria-label="User menu">
			<CircleUser className="size-6" />
		</Button>
	);

	const triggerNode = (isAuthenticated && user && trigger?.(user)) || defaultTrigger;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>{triggerNode}</DropdownMenuTrigger>

			<DropdownMenuContent side={side} align={align} className={className ?? "w-48"}>
				{isAuthenticated ? (
					<>
						<DropdownMenuLabel className="truncate">{user?.name}</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link to={ROUTES.PROFILE.PATH}>
								<UserPen className="size-4" />
								Edit Profile
							</Link>
						</DropdownMenuItem>
						{menuItems}
						<DropdownMenuItem onClick={() => logout()}>
							<LogOut className="size-4" />
							Sign Out
						</DropdownMenuItem>
					</>
				) : (
					<>
						<DropdownMenuItem asChild>
							<Link to={ROUTES.LOGIN.PATH}>
								<LogIn className="size-4" />
								Log In
							</Link>
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export default AuthMenu;
