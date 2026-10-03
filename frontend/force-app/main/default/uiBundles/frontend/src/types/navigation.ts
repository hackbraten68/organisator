/**
 * Navigation route handles.
 *
 * Each navigable route declares its sidebar/header entry via `handle`:
 *
 *   handle: {
 *     label: "Lernpfad",
 *     icon: "book",
 *     showInNavigation: true,
 *   }
 *
 * New routes appear in the navigation automatically once they carry such a
 * handle — no additional registration needed. `icon` is a serializable
 * string id; the single `navigationIcon` resolver (router-utils) maps it to
 * the lucide component.
 *
 * Mirrors `backend/.../src/types/navigation.ts`, with a portal-specific icon
 * set. Keep the two in step when a concept is shared.
 */
export type NavigationIcon = 'dashboard' | 'book' | 'contact';

export interface NavigationHandle {
  label?: string;
  icon?: NavigationIcon;
  showInNavigation?: boolean;
}