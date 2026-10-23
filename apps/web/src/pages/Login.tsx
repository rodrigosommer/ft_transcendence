import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fieldErrors, loginSchema } from '@wkb/shared';
import { ApiError, api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { Alert, Button, Field } from '../components/ui.js';

//Demo credentials the seed creates
const DEMO_ACCOUNTS = ['ada@wkb.local', 'grace@wkb.local', 'alan@wkb.local'];
const DEMO_PASSWORD = 'Password1!';

export function Login(): JSX.Element {
  const { t } = useTranslation();
  const { user, expired, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Sign-up redirects here with the email prefilled. RequireAuth does too, saving the page the user wanted so login returns them to it
  const handoff = location.state as
    | { registered?: boolean; email?: string; from?: string }
    | null;
  const from = handoff?.from && handoff.from !== '/login' ? handoff.from : '/play';
  const [email, setEmail] = useState(handoff?.email ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  // Only when the server seeded them (SEED_DEMO_USERS); a deployment without them shouldn't advertise a password that doesn't work
  const [demoAccounts, setDemoAccounts] = useState(false);
  useEffect(() => {
    const oauthError = new URLSearchParams(location.search).get('oauth_error');
    if (oauthError) 
      setFormError(oauthError === 'accountExists' ? 'auth.oauthAccountExists' : 'auth.oauthFailed');
  }, [location.search]);
  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ providers: string[]; demoAccounts?: boolean }>('/api/auth/providers')
      .then((payload) => {
        if (cancelled)
          return;
        setProviders(payload.providers);
        setDemoAccounts(payload.demoAccounts === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  if (user) 
    return <Navigate to="/play" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    // The same schema the server will run. Catching it here saves a round trip;the server still runs it because a browser check is not a check.
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) 
    {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      navigate(from, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) 
      {
        setErrors(error.fields);
        setFormError(error.code);
      }
      else
      {
        setFormError('error.internal');
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <div className="panel-pad">
        <h1 className="text-2xl font-semibold text-ink">{t('auth.loginTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{t('auth.loginSubtitle')}</p>

        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)} noValidate>
          {handoff?.registered === true && !formError && (
            <Alert tone="success">{t('auth.accountCreated')}</Alert>
          )}
          {expired && !formError && <Alert tone="info">{t('error.auth.sessionExpired')}</Alert>}
          {formError && <Alert>{t(formError)}</Alert>}

          <Field
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            required
          />
          <Field
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            required
          />

          <Button type="submit" fullWidth loading={busy}>
            {t('auth.submitLogin')}
          </Button>
        </form>

        {providers.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-surface-2" />
              {t('auth.orContinueWith')}
              <span className="h-px flex-1 bg-surface-2" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {providers.map((provider) => (
                <a
                  key={provider}
                  href={`/api/auth/oauth/${provider}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-rule-strong bg-surface-2 px-4 py-2.5 text-sm text-ink transition hover:bg-surface-2"
                >
                  {t(`auth.${provider}`)}
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.noAccount')}{' '}
          <Link to="/signup" className="font-medium text-spot hover:underline">
            {t('nav.signup')}
          </Link>
        </p>
      </div>

      {demoAccounts && (
        <div className="panel mt-4 px-5 py-4">
          <p className="text-xs font-semibold text-muted">
            {t('auth.demoTitle')}
          </p>
          <ul className="mt-2 space-y-1">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account}>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(account);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="-mx-2 inline-block px-2 py-1 font-mono text-xs text-ink-soft transition hover:text-spot-strong"
                >
                  {account}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            {t('auth.demoHint', { password: DEMO_PASSWORD })}
          </p>
        </div>
      )}
    </div>
  );
}
