import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getCurrentUser } from "@salesforce/ui-bundle/api";
import { logoutUrl } from "../../../config/site";

interface User {
	readonly id: string;
	readonly name: string;
}

interface AuthContextType {
	user: User | null;
	isAuthenticated: boolean;
	loading: boolean;
	/**
	 * True when the session probe failed rather than simply reporting "no user".
	 * The login form shows this as a non-blocking hint: an unreachable session
	 * check must not lock the visitor out of logging in.
	 */
	authProbeFailed: boolean;
	logout: (startURL?: string) => void;
}

/**
 * How long the session probe may take before the UI stops waiting for it.
 *
 * Bounded on purpose. An unbounded probe means `loading` stays true, and since
 * AuthForm disables the submit button while `loading` is set, the login form
 * becomes permanently unusable — with no way back and no message explaining why.
 */
const AUTH_PROBE_TIMEOUT_MS = 8_000;

/**
 * Rejects after `ms`, and always clears its timer.
 *
 * Note the limitation: this does not abort the underlying request. The platform
 * SDK's graphql.query does not accept an AbortSignal, so a request that keeps
 * running simply resolves into nothing — the `cancelled` flag keeps it from
 * touching state after unmount, but it is not cancelled on the wire.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout>;

	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(
			() => reject(new Error("AUTH_PROBE_TIMEOUT")),
			ms,
		);
	});

	return Promise.race([promise, timeout]).finally(() => {
		clearTimeout(timeoutId);
	});
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<User | null>(null);
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const logout = useCallback((startURL?: string) => {
		// Navigate to the server-side session logout on the My Domain origin.
		// Use replace to prevent the back button from returning to the session.
		window.location.replace(logoutUrl(startURL));
	}, []);

	useEffect(() => {
		let cancelled = false;

		// One initialisation path only. An earlier version had this inline plus a
		// separate checkAuth() with the same body; the two could drift, and the
		// duplicate was never called.
		async function initializeAuth() {
			setLoading(true);

			try {
				const userData = await withTimeout(
					getCurrentUser(),
					AUTH_PROBE_TIMEOUT_MS,
				);

				if (cancelled) return;

				setUser(userData);
				setIsAuthenticated(Boolean(userData));
			} catch (err) {
				if (cancelled) return;

				// Not being able to read the session must not cost the visitor the
				// login form. On this org the guest gets 401 with an empty body
				// from POST /sf/api/graphql, which the platform SDK does not
				// surface as a rejection — so the probe can fail here without the
				// chain ever settling. Treating that as "not authenticated" is what
				// keeps /login usable.
				console.error("[auth] Initial session check failed", err);

				setUser(null);
				setIsAuthenticated(false);
				setError("Authentication failed");
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		void initializeAuth();

		return () => {
			cancelled = true;
		};
	}, []);

	const value: AuthContextType = {
		user,
		isAuthenticated,
		loading,
		authProbeFailed: error !== null,
		logout,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access the authentication context.
 * @returns {AuthContextType} Authentication state (user, isAuthenticated, loading,
 *   authProbeFailed)
 * @throws {Error} If used outside of an AuthProvider
 */
export function useAuth(): AuthContextType {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

/**
 * Returns the current authenticated user.
 * @returns {User} The authenticated user object
 * @throws {Error} If not used within AuthProvider or user is not authenticated
 */
export function useUser(): User {
	const context = useAuth();
	if (!context.user) {
		throw new Error("Authenticated context not established");
	}
	return context.user;
}
