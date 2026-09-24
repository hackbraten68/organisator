/**
 * Navigation route handles.
 *
 * Each navigable route declares its sidebar/header entry via `handle`:
 *
 *   handle: {
 *     label: "Participants",
 *     icon: "users",
 *     showInNavigation: true,
 *   }
 *
 * New routes appear in the navigation automatically once they carry such a
 * handle — no additional registration needed. `icon` is a serializable
 * string id; the single `navigationIcon` resolver (router-utils) maps it to
 * the lucide component.
 */
export type NavigationIcon =
  | "home"
  | "search"
  | "users"
  | "book"
  | "coach"
  | "reports"
  | "settings";

export interface NavigationHandle {
  label?: string;
  icon?: NavigationIcon;
  showInNavigation?: boolean;
}
