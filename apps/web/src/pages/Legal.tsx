import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface Section {
  heading: string;
  body: string[];
}

/* Privacy Policy and Terms of Service. The text describes what the app really does. It's in the translation files, 
which keeps it available in all three languages. */
function LegalPage({ scope }: { scope: 'privacy' | 'terms' }): JSX.Element {
  const { t } = useTranslation();
  const sections = t(`legal.${scope}.sections`, { returnObjects: true }) as Section[];
  const updated = new Date('2026-08-27').toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return (
    <article className="mx-auto max-w-3xl animate-fade-up">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-ink">{t(`legal.${scope}.title`)}</h1>
        <p className="mt-1 text-xs text-muted">{t('legal.lastUpdated', { date: updated })}</p>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">{t(`legal.${scope}.intro`)}</p>
      </header>

      <div className="space-y-8">
        {Array.isArray(sections) &&
          sections.map((section) => (
            <section key={section.heading}>
              <h2 className="mb-3 font-serif text-lg font-semibold text-ink">{section.heading}</h2>
              <div className="space-y-2.5">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-muted">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
      </div>

      <footer className="mt-10 border-t border-rule pt-6 text-sm">
        <Link
          to={scope === 'privacy' ? '/terms' : '/privacy'}
          className="-my-1 inline-block py-1 text-spot transition hover:underline"
        >
          {t(scope === 'privacy' ? 'footer.terms' : 'footer.privacy')}
        </Link>
      </footer>
    </article>
  );
}

export function Privacy(): JSX.Element {
  return <LegalPage scope="privacy" />;
}

export function Terms(): JSX.Element {
  return <LegalPage scope="terms" />;
}
