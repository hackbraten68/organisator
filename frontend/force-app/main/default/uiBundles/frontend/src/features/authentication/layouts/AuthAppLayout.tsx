import SessionTimeoutValidator from "../sessionTimeout/SessionTimeoutValidator";
import { AuthProvider } from "../context/AuthContext";
import { SITE_PATH_PREFIX } from "../../../config/site";
import AppLayout from "../../../appLayout";

export default function AuthAppLayout() {
	return (
		<AuthProvider>
			{/* The session servlet is fetched with a raw fetch(), which does not
			    resolve against the site. Without the prefix the request goes to
			    /sfsites/c/... on the My Domain root and 404s on every poll. */}
			<SessionTimeoutValidator basePath={SITE_PATH_PREFIX} />
			<AppLayout />
		</AuthProvider>
	);
}
