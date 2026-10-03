import SessionTimeoutValidator from "../sessionTimeout/SessionTimeoutValidator";
import { AuthProvider } from "../context/AuthContext";
import { ParticipantProvider } from "../../participant/context/ParticipantContext";
import { SITE_PATH_PREFIX } from "../../../config/site";
import AppLayout from "../../../appLayout";

export default function AuthAppLayout() {
	return (
		<AuthProvider>
			{/* The session servlet is fetched with a raw fetch(), which does not
			    resolve against the site. Without the prefix the request goes to
			    /sfsites/c/... on the My Domain root and 404s on every poll. */}
			<SessionTimeoutValidator basePath={SITE_PATH_PREFIX} />
			{/* Above AppLayout, not inside PrivateRoute: the app shell renders the
			    participant's name in the sidebar footer, which is chrome rather than
			    routed content. ParticipantProvider waits for a session before it calls
			    /me, so guests never trigger the request. */}
			<ParticipantProvider>
				<AppLayout />
			</ParticipantProvider>
		</AuthProvider>
	);
}
