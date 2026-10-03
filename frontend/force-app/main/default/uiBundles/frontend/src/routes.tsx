import type { RouteObject } from 'react-router';
import Dashboard from './pages/Dashboard';
import LearningPath from './pages/LearningPath';
import MeinKonto from './pages/MeinKonto';
import NotFound from './pages/NotFound';
import Login from "./features/authentication/pages/Login";
import ForgotPassword from "./features/authentication/pages/ForgotPassword";
import Profile from "./features/authentication/pages/Profile";
import ChangePassword from "./features/authentication/pages/ChangePassword";
import PrivateRoute from "./features/authentication/layouts/privateRouteLayout";
import { ROUTES } from "./features/authentication/authenticationConfig";
import AuthAppLayout from "./features/authentication/layouts/AuthAppLayout";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AuthAppLayout />,
    children: [
      {
        path: ROUTES.LOGIN.PATH,
        element: <Login />,
        handle: { showInNavigation: false, label: "Login", title: ROUTES.LOGIN.TITLE }
      },
      {
        path: ROUTES.FORGOT_PASSWORD.PATH,
        element: <ForgotPassword />,
        handle: { showInNavigation: false, title: ROUTES.FORGOT_PASSWORD.TITLE }
      },
      {
        element: <PrivateRoute />,
        children: [
          {
            index: true,
            element: <Dashboard />,
            handle: { showInNavigation: true, label: "Dashboard", icon: "dashboard" }
          },
          {
            path: "learning-path",
            element: <LearningPath />,
            handle: { showInNavigation: true, label: "Lernpfad", icon: "book" }
          },
          {
            path: "mein-konto",
            element: <MeinKonto />,
            handle: { showInNavigation: true, label: "Mein Konto", icon: "contact" }
          },
          {
            path: ROUTES.PROFILE.PATH,
            element: <Profile />,
            handle: { showInNavigation: false, label: "Profile", title: ROUTES.PROFILE.TITLE }
          },
          {
            path: ROUTES.CHANGE_PASSWORD.PATH,
            element: <ChangePassword />,
            handle: { showInNavigation: false, label: "Change Password", title: ROUTES.CHANGE_PASSWORD.TITLE }
          }
        ]
      },
      {
        path: '*',
        element: <NotFound />
      }
    ]
  }
];
