import type { RouteObject } from 'react-router';

import AppLayout from './appLayout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import AccountObjectDetail from './pages/AccountObjectDetailPage';
import ParticipantPage from './pages/ParticipantPage';

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
          label: "Home"
        }
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
          label: "Search"
        }
      },
      {
        path: "participants",
        element: <ParticipantPage />,
        handle: {
          showInNavigation: true,
          label: "Participants"
        }
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
