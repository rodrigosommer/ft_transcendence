import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { roomCodeSchema } from '@wkb/shared';
import { useLobbyChannel } from '../ws/useLobbyChannel.js';
import { Alert, Button, EmptyState, PageTitle } from '../components/ui.js';

export function Lobby(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, rooms } = useLobbyChannel(true);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const join = (event: FormEvent) => {
    event.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) 
    {
      setCodeError(parsed.error.issues[0]?.message ?? 'validation.roomCode.length');
      return;
    }
    setCodeError(null);
    navigate(`/room/${parsed.data}`);
  };
  return (
    <div className="animate-fade-up">
      <PageTitle
        title={t('lobby.title')}
        subtitle={t('lobby.subtitle')}
        action={
          <Link
            to="/room/new"
            className="rounded border border-spot bg-spot px-4 py-2.5 text-sm font-medium text-surface transition hover:bg-spot-strong"
          >
            {t('lobby.createRoom')}
          </Link>
        }
      />

      <form className="mb-6 flex flex-wrap items-end gap-3" onSubmit={join} noValidate>
        <div className="min-w-[12rem] flex-1 sm:max-w-xs">
          <label className="label" htmlFor="join-code">
            {t('lobby.joinByCode')}
          </label>
          <input
            id="join-code"
            className={`input font-mono ${codeError ? 'input-error' : ''}`}
            placeholder={t('lobby.codePlaceholder')}
            value={code}
            maxLength={6}
            autoComplete="off"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            aria-invalid={codeError ? true : undefined}
          />
          {codeError && (
            <p className="error-text" role="alert">
              {t(codeError)}
            </p>
          )}
        </div>
        <Button type="submit" variant="secondary">
          {t('lobby.join')}
        </Button>
      </form>

      {status !== 'open' && (
        <div className="mb-4">
          <Alert tone="info">
            {status === 'connecting' ? t('lobby.connecting') : t('lobby.disconnected')}
          </Alert>
        </div>
      )}

      {rooms.length === 0 ? (
        <EmptyState>{t('lobby.empty')}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                to={`/room/${room.code}`}
                className="panel-pad block h-full transition hover:border-spot hover:bg-surface-2"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-ink">{room.name}</h2>
                  <span
                    className={[
                      'chip shrink-0',
                      room.status === 'playing'
                        ? 'border-spot/35 bg-spot-wash text-spot-strong'
                        : 'border-correct/40 bg-correct-wash text-correct',
                    ].join(' ')}
                  >
                    {room.status === 'playing' ? t('lobby.inMatch') : t('lobby.inLobby')}
                  </span>
                </div>

                <p className="mb-3 text-xs text-muted">
                  {t('lobby.hostedBy', { name: room.hostDisplayName })}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  <span className="chip">{t(`difficulty.${room.difficulty}`)}</span>
                  <span className="chip">
                    {t('lobby.players', { count: room.playerCount, max: room.maxPlayers })}
                  </span>
                  {room.categories.slice(0, 2).map((category) => (
                    <span key={category.slug} className="chip chip-accent">
                      {t(`categories.${category.slug}`, { defaultValue: category.name })}
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
