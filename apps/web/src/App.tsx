import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './auth/AuthContext.js';
import { Layout } from './components/Layout.js';
import { Spinner } from './components/ui.js';
import { AuthCallback } from './pages/AuthCallback.js';
import { CreateRoom } from './pages/CreateRoom.js';
import { Friends } from './pages/Friends.js';
import { Leaderboard } from './pages/Leaderboard.js';
import { Lobby } from './pages/Lobby.js';
import { Login } from './pages/Login.js';
import { NotFound } from './pages/NotFound.js';
import { Privacy, Terms } from './pages/Legal.js';
import { Profile } from './pages/Profile.js';
import { Room } from './pages/Room.js';
import { Setup } from './pages/Setup.js';
import { Signup } from './pages/Signup.js';
import { Stats } from './pages/Stats.js';
import { Welcome } from './pages/Welcome.js';
import { TournamentDetail, Tournaments } from './pages/Tournaments.js';

function FullPageSpinner(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{t('app.loading')}</p>
    </div>
  );
}

/* Sends anonymous visitors to the login screen, remembering where they were, and sends a brand new account through the setup screen first.
The setup is here rather than on the login route because an account arrives signed in by several paths, the login form, an OAuth callback, a
 * silent refresh on a returning tab, and only one of them goes through a screen that could have redirected.*/
function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) 
    return <FullPageSpinner />;
  if (!user) 
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.onboarded) 
    return <Navigate to="/setup" replace />;
  return children;
}

function RequireSession({ children }: { children: JSX.Element }): JSX.Element {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) 
    return <FullPageSpinner />;
  if (!user) 
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function App(): JSX.Element {
  const { loading } = useAuth();
  if (loading) 
    return <FullPageSpinner />;
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        {}
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        {/* Authenticated */}
        <Route
          path="/setup"
          element={
            <RequireSession>
              <Setup />
            </RequireSession>
          }
        />
        <Route
          path="/play"
          element={
            <RequireAuth>
              <Lobby />
            </RequireAuth>
          }
        />
        <Route
          path="/room/new"
          element={
            <RequireAuth>
              <CreateRoom />
            </RequireAuth>
          }
        />
        <Route
          path="/room/:code"
          element={
            <RequireAuth>
              <Room />
            </RequireAuth>
          }
        />
        <Route
          path="/tournaments"
          element={
            <RequireAuth>
              <Tournaments />
            </RequireAuth>
          }
        />
        <Route
          path="/tournaments/:id"
          element={
            <RequireAuth>
              <TournamentDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <RequireAuth>
              <Leaderboard />
            </RequireAuth>
          }
        />
        <Route
          path="/stats"
          element={
            <RequireAuth>
              <Stats />
            </RequireAuth>
          }
        />
        <Route
          path="/friends"
          element={
            <RequireAuth>
              <Friends />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
