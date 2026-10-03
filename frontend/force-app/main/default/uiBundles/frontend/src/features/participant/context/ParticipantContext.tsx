import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "../../authentication/context/AuthContext";
import { fetchMe, MeError, type Me } from "../api/participantApi";

interface ParticipantContextType {
	me: Me | null;
	loading: boolean;
	error: { message: string; code: string | null } | null;
	refresh: () => void;
}

const ParticipantContext = createContext<ParticipantContextType | undefined>(undefined);

interface ParticipantProviderProps {
	children: ReactNode;
}

export function ParticipantProvider({ children }: ParticipantProviderProps) {
	const [me, setMe] = useState<Me | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<{ message: string; code: string | null } | null>(null);
	const { isAuthenticated, loading: authLoading } = useAuth();

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);

		try {
			const data = await fetchMe();
			setMe(data);
		} catch (err: unknown) {
			if (err instanceof MeError) {
				setError({ message: err.message, code: err.code });
			} else {
				setError({ message: "Portal data unavailable.", code: null });
			}
			setMe(null);
		} finally {
			setLoading(false);
		}
	}, []);

	// The provider sits above the private routes now, because the app shell
	// renders the participant's name in the sidebar footer. A guest must not
	// trigger the request: `/me` answers 401 for anonymous sessions, so every
	// login page visit would log a failure and paint a spurious error state.
	useEffect(() => {
		if (authLoading) return;
		if (!isAuthenticated) {
			setMe(null);
			setError(null);
			setLoading(false);
			return;
		}
		void load();
	}, [isAuthenticated, authLoading, load]);

	const value: ParticipantContextType = {
		me,
		loading,
		error,
		refresh: load,
	};

	return <ParticipantContext.Provider value={value}>{children}</ParticipantContext.Provider>;
}

export function useParticipant(): ParticipantContextType {
	const context = useContext(ParticipantContext);
	if (context === undefined) {
		throw new Error("useParticipant must be used within a ParticipantProvider");
	}
	return context;
}
