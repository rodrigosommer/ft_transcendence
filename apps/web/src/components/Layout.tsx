import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext.js';
import { Avatar } from './ui.js';
import { LanguageSwitcher } from './LanguageSwitcher.js';
import { ThemeSwitcher } from './ThemeSwitcher.js';

function Brand(): JSX.Element {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex items-baseline gap-2.5" aria-label={t('app.name')}>
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 translate-y-1 items-center justify-center rounded-sm bg-ink text-sm font-bold text-paper"
      >
        W
      </span>
      {/* On small screens we hide the word and show only the logo. Even when "WKB" takes about 50px of 320px bar that also has to fit two
      switchersand a menu button, and the logo alone is clear enough */}
      <span className="hidden text-lg font-semibold tracking-tight text-ink sm:inline">
        {t('app.name')}
      </span>
    </Link>
  );
}

const LINKS = [
  { to: '/play', key: 'nav.play', end: true },
  { to: '/tournaments', key: 'nav.tournaments', end: false },
  { to: '/leaderboard', key: 'nav.leaderboard', end: false },
  { to: '/stats', key: 'nav.stats', end: false },
  { to: '/friends', key: 'nav.friends', end: false },
] as const;

function Header(): JSX.Element {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  // The active tab gets a line underneath like a printed index. A filled pill would add a fourth box to the header.
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'border-b-2 px-0.5 pb-1 text-sm transition',
      isActive
        ? 'border-spot font-medium text-ink'
        : 'border-transparent text-muted hover:border-rule-strong hover:text-ink',
    ].join(' ');

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-4">
        <Brand />

        {user && (
          <nav className="ml-6 hidden items-center gap-5 lg:flex" aria-label={t('nav.menu')}>
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                {t(link.key)}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Tighter gaps on small screenn, the logo, two switchers, avatar and menu button together overflowed 
        a 414px viewport by 13px and that's an ordinary phone*/}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <ThemeSwitcher />
          <LanguageSwitcher compact />
          {user ? (
            <>
              <Link
                to="/profile"
                className="hidden items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-surface-2 sm:flex"
              >
                <Avatar name={user.displayName} src={user.avatarUrl} size={30} />
                <span className="max-w-[9rem] truncate text-sm text-ink">{user.displayName}</span>
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                title={t('nav.logout')}
                className="hidden rounded-lg border border-spot bg-spot p-2 text-surface transition hover:bg-spot-strong sm:block"
              >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 8l4 4-4 4M20 12H9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only">{t('nav.logout')}</span>
              </button>

            </>
          ) : (
            <Link
              to="/login"
              className="rounded border border-spot bg-spot px-3 py-1.5 text-sm font-medium text-surface transition hover:bg-spot-strong"
            >
              {t('nav.login')}
            </Link>
          )}

          {user && (
            <button
              type="button"
              className="rounded-lg p-2 text-muted transition hover:bg-surface-2 lg:hidden"
              aria-expanded={open}
              aria-label={t('nav.menu')}
              onClick={() => setOpen((value) => !value)}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {user && open && (
        <nav className="border-t border-rule px-4 py-2 lg:hidden" aria-label={t('nav.menu')}>
          {/*The avatar is hidden on small screens, so the profile link has to be here, with the account name */}
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 sm:hidden"
          >
            <Avatar name={user.displayName} src={user.avatarUrl} size={26} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
              {user.displayName}
            </span>
            <span className="text-xs text-muted">{t('nav.profile')}</span>
          </Link>

          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                [
                  'block rounded-lg px-3 py-2 text-sm',
                  isActive ? 'bg-surface-2 text-ink' : 'text-muted',
                ].join(' ')
              }
            >
              {t(link.key)}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => void signOut()}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted"
          >
            {t('nav.logout')}
          </button>
        </nav>
      )}
    </header>
  );
}

function Footer(): JSX.Element {
  const { t } = useTranslation();
  return (
    <footer className="mt-auto border-t border-rule bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>{t('footer.project')}</p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/privacy" className="-my-1 py-1 transition hover:text-ink">
            {t('footer.privacy')}
          </Link>
          <Link to="/terms" className="-my-1 py-1 transition hover:text-ink">
            {t('footer.terms')}
          </Link>
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer noopener"
            className="-my-1 py-1 transition hover:text-ink"
          >
            {t('footer.attribution')}
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function Layout(): JSX.Element {
  return (
    <div className="flex min-h-full flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
