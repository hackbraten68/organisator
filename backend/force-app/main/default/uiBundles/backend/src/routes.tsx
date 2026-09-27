import type { RouteObject } from 'react-router';

import AppLayout from './appLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import AccountObjectDetail from './pages/AccountObjectDetailPage';
import ParticipantPage from './pages/ParticipantPage';
import ProgramsPage from './pages/programs/ProgramsPage';
import ProgramDetailPage from './pages/programs/ProgramDetailPage';
import type { NavigationHandle } from './types/navigation';

import { Search as GlobalSearch, config } from "./features/search";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Home />,
        handle: {
          showInNavigation: true,
          label: "Dashboard",
          icon: "reports",
        } satisfies NavigationHandle,
      },
      {
        path: "dashboard",
        element: <Home />,
      },
      {
        path: "search",
        element: (
          <GlobalSearch
            config={config}
            title="Search"
            searchPlaceholder="Search accounts, contacts, opportunities, and content..."
          />
        ),
        handle: {
          showInNavigation: true,
          label: "Search",
          icon: "search",
        } satisfies NavigationHandle
      },
      {
        path: "participants",
        element: <ParticipantPage />,
        handle: {
          showInNavigation: true,
          label: "Participants",
          icon: "users",
        } satisfies NavigationHandle
      },
      {
        // Canonical participant deep link: /participants/:id selects the
        // participant (?tab=uebersicht|verlauf|lernpfad, ?event=<AuditEventId>
        // opens the verlauf tab with the event highlighted + details open).
        // /participants (no id) keeps the legacy auto-first behavior.
        path: "participants/:participantId",
        element: <ParticipantPage />,
      },
      {
        path: "programs",
        children: [
          {
            index: true,
            element: <ProgramsPage />,
            handle: {
              showInNavigation: true,
              label: "Programs",
              icon: "book",
            } satisfies NavigationHandle,
          },
          {
            path: ":programId",
            element: <ProgramDetailPage />,
          },
        ],
      },
      {
        path: "accounts/:recordId",
        element: <AccountObjectDetail />
      },
      {
        path: "*",
        element: <NotFound />
      }
    ]
  }
];
