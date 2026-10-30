import type { RouteObject } from 'react-router';
import {
  BookOpen,
  CalendarDays,
  Contact,
  GraduationCap,
  Home,
  LayoutGrid,
  LayoutDashboard,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { routes } from './routes';
import type { NavigationHandle, NavigationIcon } from './types/navigation';

export type RouteWithFullPath = RouteObject & { fullPath: string };

export interface NavigationItem {
  path: string;
  label: string;
  icon: LucideIcon;
  children?: NavigationItem[];
}

const flatMapRoutes = (
  route: RouteObject,
  parentPath: string = ''
): RouteWithFullPath[] => {
  let fullPath: string;

  if (route.index) {
    fullPath = parentPath || '/';
  } else if (route.path) {
    if (route.path.startsWith('/')) {
      fullPath = route.path;
    } else {
      fullPath =
        parentPath === '/' ? `/${route.path}` : `${parentPath}/${route.path}`;
    }
  } else {
    fullPath = parentPath;
  }

  const routeWithPath = { ...route, fullPath };

  const childRoutes =
    route.children?.flatMap(child => flatMapRoutes(child, fullPath)) || [];

  return [routeWithPath, ...childRoutes];
};

export const getAllRoutes = (): RouteWithFullPath[] => {
  return routes.flatMap(route => flatMapRoutes(route));
};

/**
 * The single string-id → lucide-component mapping for navigation handles.
 * Routes only declare the id (e.g. `icon: "users"`); this resolver turns it
 * into the rendered icon so route metadata stays serializable.
 */
export function navigationIcon(icon?: NavigationIcon): LucideIcon {
  switch (icon) {
    case 'home':
      return Home;
    case 'search':
      return Search;
    case 'users':
      return Users;
    case 'contact':
      return Contact;
    case 'book':
      return BookOpen;
    case 'coach':
      return GraduationCap;
    case 'reports':
      return LayoutDashboard;
    case 'settings':
      return Settings;
    case 'calendar':
      return CalendarDays;
    default:
      return LayoutGrid;
  }
}

/**
 * Shared navigation source of truth for header and sidebar: every route with
 * `handle: { showInNavigation: true, label }` becomes an entry. New routes
 * appear automatically once they carry such a handle.
 *
 * A route can declare `parentPath` to be rendered as an indented child of
 * another navigation entry. The tree is assembled here so the sidebar stays
 * flat-data driven and the mobile menu gets the same hierarchy.
 */
export function getNavigationRoutes(): NavigationItem[] {
  const entries = getAllRoutes()
    .filter(route => {
      const handle = route.handle as NavigationHandle | undefined;
      return (
        handle?.showInNavigation === true &&
        route.fullPath !== undefined &&
        handle?.label !== undefined
      );
    })
    .map(route => {
      const handle = route.handle as NavigationHandle;
      return {
        path: route.fullPath,
        label: handle.label as string,
        icon: navigationIcon(handle.icon),
        parentPath: handle.parentPath,
      };
    });

  const nodes = new Map<string, NavigationItem>(
    entries.map(entry => [
      entry.path,
      {
        path: entry.path,
        label: entry.label,
        icon: entry.icon,
      },
    ])
  );

  const roots: NavigationItem[] = [];

  for (const entry of entries) {
    const node = nodes.get(entry.path);
    if (!node) continue;

    const parent = entry.parentPath
      ? nodes.get(entry.parentPath)
      : undefined;

    if (parent) {
      parent.children ??= [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
