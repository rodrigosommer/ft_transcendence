import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DIFFICULTIES,
  DIFFICULTY_PRESETS,
  ROOM_LIMITS,
  createRoomSchema,
  fieldErrors,
  type Difficulty,
} from '@wkb/shared';
import { ApiError, api } from '../api/client.js';
import { Alert, Button, Field, PageTitle } from '../components/ui.js';

interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  facts: { easy: number; medium: number; hard: number };
}

/*Room creation is also the customisation screen; mode, difficulty,
 category selection, match length, player cap and the two room modifiers. Every control starts from a documented default*/
const DEFAULTS = {
  visibility: 'public' as const,
  mode: 'general' as const,
  difficulty: 'medium' as Difficulty,
  maxPlayers: 6,
  comboEnabled: true,
  doubleCardEnabled: false,
};

export function CreateRoom(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>(DEFAULTS.visibility);
  const [mode, setMode] = useState<'general' | 'category'>(DEFAULTS.mode);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULTS.difficulty);
  const [maxPlayers, setMaxPlayers] = useState(DEFAULTS.maxPlayers);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [cardCount, setCardCount] = useState(DIFFICULTY_PRESETS[DEFAULTS.difficulty].cardCount);
  const [answerWindowMs, setWindow] = useState(DIFFICULTY_PRESETS[DEFAULTS.difficulty].answerWindowMs);
  const [comboEnabled, setCombo] = useState(DEFAULTS.comboEnabled);
  const [doubleCardEnabled, setDouble] = useState(DEFAULTS.doubleCardEnabled);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ categories: CategoryRow[] }>('/api/catalog/categories')
      .then((payload) => {
        if (!cancelled) 
          setCategories(payload.categories);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  //Picking a difficulty resets the window and length to that preset
  const applyDifficulty = (next: Difficulty) => {
    setDifficulty(next);
    setWindow(DIFFICULTY_PRESETS[next].answerWindowMs);
    setCardCount(DIFFICULTY_PRESETS[next].cardCount);
  };

  const available = useMemo(() => {
    const pool = categoryIds.length > 0 ? categories.filter((c) => categoryIds.includes(c.id)) : categories;
    return pool.reduce((sum, category) => sum + category.facts[difficulty], 0);
  }, [categories, categoryIds, difficulty]);

  const toggleCategory = (id: number) => {
    setCategoryIds((current) => {
        if (mode === 'category') 
          return current[0] === id ? [] : [id];
      return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    });
  };
  const switchMode = (next: 'general' | 'category') => {
    setMode(next);
    setCategoryIds((current) => (next === 'category' ? current.slice(0, 1) : current));
  };
  const reset = () => {
    setVisibility(DEFAULTS.visibility);
    setMode(DEFAULTS.mode);
    applyDifficulty(DEFAULTS.difficulty);
    setMaxPlayers(DEFAULTS.maxPlayers);
    setCategoryIds([]);
    setCombo(DEFAULTS.comboEnabled);
    setDouble(DEFAULTS.doubleCardEnabled);
    setErrors({});
    setFormError(null);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const payload = {
      name,
      visibility,
      mode,
      difficulty,
      maxPlayers,
      settings: {
        cardCount: Math.min(cardCount, Math.max(ROOM_LIMITS.MIN_CARDS, available)),
        categoryIds,
        answerWindowMs,
        comboEnabled,
        doubleCardEnabled,
      },
    };
    const parsed = createRoomSchema.safeParse(payload);
    if (!parsed.success) 
    {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const created = await api.post<{ room: { code: string } }>('/api/rooms', parsed.data);
      navigate(`/room/${created.room.code}`, { replace: true });
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
  const optionClass = (active: boolean) =>
    [
      'flex-1 rounded-xl border px-4 py-3 text-left transition',
      active
        ? 'border-spot bg-spot-wash text-ink'
        : 'border-rule-strong bg-surface text-muted hover:border-rule-strong hover:text-ink',
    ].join(' ');
  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <PageTitle title={t('createRoom.title')} />

      <form className="space-y-6" onSubmit={(event) => void submit(event)} noValidate>
        {formError && <Alert>{t(formError)}</Alert>}

        <div className="panel-pad space-y-5">
          <Field
            label={t('createRoom.name')}
            placeholder={t('createRoom.namePlaceholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={errors.name}
            maxLength={40}
            required
          />

          <fieldset>
            <legend className="label">{t('createRoom.visibility')}</legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              {(['public', 'private'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVisibility(value)}
                  className={optionClass(visibility === value)}
                  aria-pressed={visibility === value}
                >
                  <span className="block text-sm font-medium">{t(`createRoom.${value}`)}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {t(`createRoom.${value}Hint`)}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">{t('createRoom.mode')}</legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              {(['general', 'category'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchMode(value)}
                  className={optionClass(mode === value)}
                  aria-pressed={mode === value}
                >
                  <span className="block text-sm font-medium">{t(`createRoom.${value}`)}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {t(`createRoom.${value}Hint`)}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="panel-pad space-y-5">
          <fieldset>
            <legend className="label">{t('createRoom.difficulty')}</legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              {DIFFICULTIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyDifficulty(value)}
                  className={optionClass(difficulty === value)}
                  aria-pressed={difficulty === value}
                >
                  <span className="block text-sm font-medium">{t(`difficulty.${value}`)}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {t('createRoom.difficultyHint', {
                      window: DIFFICULTY_PRESETS[value].answerWindowMs / 1000,
                      cards: DIFFICULTY_PRESETS[value].cardCount,
                    })}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">{t('createRoom.categories')}</legend>
            <p className="mb-2 text-xs text-muted">
              {mode === 'category' ? t('createRoom.categoryHint') : t('createRoom.categoriesHint')}
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const active = categoryIds.includes(category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    aria-pressed={active}
                    className={[
                      'rounded border px-3 py-1.5 text-xs font-medium transition',
                      active
                        ? 'border-spot bg-spot text-surface'
                        : 'border-rule-strong bg-surface text-muted hover:border-rule-strong hover:text-ink',
                    ].join(' ')}
                  >
                    {t(`categories.${category.slug}`, { defaultValue: category.name })}
                    <span className="ml-1.5 opacity-60">{category.facts[difficulty]}</span>
                  </button>
                );
              })}
            </div>
            {errors['settings.categoryIds'] && (
              <p className="error-text" role="alert">
                {t(errors['settings.categoryIds'])}
              </p>
            )}
            <p className="hint">{t('createRoom.available', { count: available })}</p>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="card-count">
                {t('createRoom.cardCount')}: <span className="tabular-nums text-spot">{cardCount}</span>
              </label>
              <input
                id="card-count"
                type="range"
                min={ROOM_LIMITS.MIN_CARDS}
                max={ROOM_LIMITS.MAX_CARDS}
                step={1}
                value={cardCount}
                onChange={(event) => setCardCount(Number(event.target.value))}
                className="slider"
              />
            </div>
            <div>
              <label className="label" htmlFor="max-players">
                {t('createRoom.maxPlayers')}: <span className="tabular-nums text-spot">{maxPlayers}</span>
              </label>
              <input
                id="max-players"
                type="range"
                min={2}
                max={ROOM_LIMITS.MAX_PLAYERS}
                step={1}
                value={maxPlayers}
                onChange={(event) => setMaxPlayers(Number(event.target.value))}
                className="slider"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="answer-window">
              {t('createRoom.answerWindow')}:{' '}
              <span className="tabular-nums text-spot">{(answerWindowMs / 1000).toFixed(0)}s</span>
            </label>
            <input
              id="answer-window"
              type="range"
              min={3000}
              max={30000}
              step={1000}
              value={answerWindowMs}
              onChange={(event) => setWindow(Number(event.target.value))}
              className="slider"
            />
          </div>
        </div>

        <div className="panel-pad space-y-3">
          <p className="label mb-0">{t('createRoom.modifiers')}</p>

          {(
            [
              ['comboEnabled', comboEnabled, setCombo] as const,
              ['doubleCardEnabled', doubleCardEnabled, setDouble] as const,
            ]
          ).map(([key, value, setter]) => (
            <label key={key} className="grid cursor-pointer grid-cols-[auto_1fr] items-start gap-x-3 rounded-xl border border-rule p-3 transition hover:border-rule-strong">
              <input
                type="checkbox"
                checked={value}
                onChange={(event) => setter(event.target.checked)}
                className="row-span-2 mt-0.5 h-4 w-4 shrink-0 accent-spot"
              />
                <span className="block text-sm font-medium text-ink">{t(`createRoom.${key}`)}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {t(key === 'comboEnabled' ? 'createRoom.comboHint' : 'createRoom.doubleHint')}
                </span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={busy}>
            {t('createRoom.create')}
          </Button>
          <Button type="button" variant="ghost" onClick={reset}>
            {t('createRoom.resetDefaults')}
          </Button>
        </div>
      </form>
    </div>
  );
}
