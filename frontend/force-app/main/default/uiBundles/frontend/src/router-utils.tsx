import type { RouteObject } from 'react-router';
import {
  BookOpen,
  Contact,
  LayoutDashboard,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import { routes } from './routes';
import type { NavigationHandle, NavigationIcon } from './types/navigation';

export type RouteWithFullPath = RouteObject & { fullPath: string };

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

export interface NavigationItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The single string-id -> lucide-component mapping for navigation handles.
 * Routes only declare the id (e.g. `icon: "book"`); this resolver turns it
 * into the rendered icon so route metadata stays serializable.
 */
export function navigationIcon(icon?: NavigationIcon): LucideIcon {
  switch (icon) {
    case 'dashboard':
      return LayoutDashboard;
    case 'book':
      return BookOpen;
    case 'contact':
      return Contact;
    default:
      return LayoutGrid;
  }
}

/**
 * Shared navigation source of truth for header and sidebar: every route with
 * `handle: { showInNavigation: true, label }` becomes an entry. New routes
 * appear automatically once they carry such a handle.
 *
 * Both the sidebar and the mobile disclosure read from here so they cannot
 * drift apart.
 */
export function getNavigationRoutes(): NavigationItem[] {
  return getAllRoutes()
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
      };
    });
}
