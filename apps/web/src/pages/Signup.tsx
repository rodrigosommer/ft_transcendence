import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fieldErrors, signupSchema } from '@wkb/shared';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.js';
import { currentLocale } from '../i18n/index.js';
import { Alert, Button, Field } from '../components/ui.js';

export function Signup(): JSX.Element {
  const { t } = useTranslation();
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) 
    return <Navigate to="/play" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const locale = currentLocale();
    const parsed = signupSchema.safeParse({ email, password, displayName, locale });
    if (!parsed.success) 
    {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await signup(parsed.data.email, parsed.data.password, parsed.data.displayName, locale);
      // Straight to the sign-in screen with the address carried across so there is only the password left to type.
      navigate('/login', { replace: true, state: { registered: true, email: parsed.data.email } });
    } catch (error) {
      if (error instanceof ApiError)
      {
        setErrors(error.fields);
        setFormError(error.code);
      }
      else
        setFormError('error.internal');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-md animate-fade-up">
      <div className="panel-pad">
        <h1 className="text-2xl font-semibold text-ink">{t('auth.signupTitle')}</h1>
        <p className="mt-1 text-sm text-muted">{t('auth.signupSubtitle')}</p>

        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)} noValidate>
          {formError && <Alert>{t(formError)}</Alert>}

          <Field
            label={t('auth.displayName')}
            autoComplete="nickname"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            error={errors.displayName}
            required
          />
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
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
            hint={t('auth.passwordHint')}
            required
          />

          <Button type="submit" fullWidth loading={busy}>
            {t('auth.submitSignup')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-spot hover:underline">
            {t('nav.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
