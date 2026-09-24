import type { RouteObject } from 'react-router';
import {
  BookOpen,
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
    case 'book':
      return BookOpen;
    case 'coach':
      return GraduationCap;
    case 'reports':
      return LayoutDashboard;
    case 'settings':
      return Settings;
    default:
      return LayoutGrid;
  }
}

/**
 * Shared navigation source of truth for header and sidebar: every route with
 * `handle: { showInNavigation: true, label }` becomes an entry. New routes
 * appear automatically once they carry such a handle.
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
