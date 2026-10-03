import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
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

	useEffect(() => {
		void load();
	}, [load]);

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
