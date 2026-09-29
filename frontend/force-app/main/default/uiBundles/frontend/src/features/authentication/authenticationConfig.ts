/**
 * [Dev Note] Centralized configuration for Auth routes.
 * Each route contains both the path and page title.
 * Using constants prevents typos in route paths across the application.
 *
 * [Dev Note] There is no REGISTER route. Portal accounts are provisioned by staff in the
 * internal backend (Contact -> Participant__c -> portal user), never self-service.
 * See backend/docs/portal/architecture-decisions.md (ADR-004, ADR-005).
 */
export const ROUTES = {
	LOGIN: {
		PATH: "/login",
		TITLE: "Login | MyApp",
	},
	FORGOT_PASSWORD: {
		PATH: "/forgot-password",
		TITLE: "Recover Password | MyApp",
	},
	RESET_PASSWORD: {
		PATH: "/reset-password",
		TITLE: "Reset Password | MyApp",
	},
	PROFILE: {
		PATH: "/profile",
		TITLE: "My Profile | MyApp",
	},
	CHANGE_PASSWORD: {
		PATH: "/change-password",
		TITLE: "Change Password | MyApp",
	},
} as const;

/**
 * [Dev Note] Centralized configuration for API endpoints.
 * These are server-side endpoints, not client-side routes.
 */
export const API_ROUTES = {
	// W-21253864: Logout URL integration is not currently supported
	LOGOUT: "/secur/logout.jsp",
} as const;

/**
 * [Dev Note] Query parameter key used to store the return URL.
 * e.g. /login?startUrl=/profile
 */
export const AUTH_REDIRECT_PARAM = "startUrl";

/**
 * [Dev Note] Placeholder text constants for authentication form inputs.
 */
export const AUTH_PLACEHOLDERS = {
	EMAIL: "e.g. name@example.com",
	PASSWORD: "Enter your password",
	PASSWORD_NEW: "Enter new password",
	PASSWORD_NEW_CONFIRM: "Re-enter new password",
	USERNAME: "e.g. asmith",
} as const;
