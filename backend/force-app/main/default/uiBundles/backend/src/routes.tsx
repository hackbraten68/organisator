import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router';

import AppLayout from './appLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import type { NavigationHandle } from './types/navigation';

import { Search as GlobalSearch, config } from './features/search';

const AccountObjectDetail = lazy(
  () => import('./pages/AccountObjectDetailPage')
);
const ParticipantPage = lazy(() => import('./pages/ParticipantPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ProgramsPage = lazy(() => import('./pages/programs/ProgramsPage'));
const ProgramDetailPage = lazy(
  () => import('./pages/programs/ProgramDetailPage')
);

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse text-muted-foreground">Laden...</div>
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Home />,
        handle: {
          showInNavigation: true,
          label: 'Dashboard',
          icon: 'reports',
        } satisfies NavigationHandle,
      },
      {
        path: 'dashboard',
        element: <Home />,
      },
      {
        path: 'search',
        element: (
          <GlobalSearch
            config={config}
            title="Search"
            searchPlaceholder="Search accounts, contacts, opportunities, and content..."
          />
        ),
        handle: {
          showInNavigation: true,
          label: 'Search',
          icon: 'search',
        } satisfies NavigationHandle,
      },
      {
        path: 'participants',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ParticipantPage />
          </Suspense>
        ),
        handle: {
          showInNavigation: true,
          label: 'Participants',
          icon: 'users',
        } satisfies NavigationHandle,
      },
      {
        path: 'participants/:participantId',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ParticipantPage />
          </Suspense>
        ),
      },
      {
        path: 'contacts',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ContactPage />
          </Suspense>
        ),
        handle: {
          showInNavigation: true,
          label: 'Contacts',
          icon: 'contact',
        } satisfies NavigationHandle,
      },
      {
        path: 'contacts/:contactId',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ContactPage />
          </Suspense>
        ),
      },
      {
        path: 'programs',
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<PageFallback />}>
                <ProgramsPage />
              </Suspense>
            ),
            handle: {
              showInNavigation: true,
              label: 'Programs',
              icon: 'book',
            } satisfies NavigationHandle,
          },
          {
            path: ':programId',
            element: (
              <Suspense fallback={<PageFallback />}>
                <ProgramDetailPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'accounts/:recordId',
        element: (
          <Suspense fallback={<PageFallback />}>
            <AccountObjectDetail />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
];
