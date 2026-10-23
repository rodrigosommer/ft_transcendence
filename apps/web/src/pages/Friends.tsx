import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useLobbyChannel } from '../ws/useLobbyChannel.js';
import { Avatar, Button, EmptyState, PageTitle, Spinner } from '../components/ui.js';

interface Person {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  online: boolean;
  lastSeenAt: string | null;
}

interface FriendLists {
  accepted: Person[];
  incoming: Person[];
  outgoing: Person[];
  blocked: Person[];
}

const EMPTY: FriendLists = { accepted: [], incoming: [], outgoing: [], blocked: [] };

function PresenceDot({ online }: { online: boolean }): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${online ? 'bg-correct' : 'bg-rule-strong'}`}
      title={t(online ? 'common.online' : 'common.offline')}
    />
  );
}

export function Friends(): JSX.Element {
  const { t } = useTranslation();
  const { onlineUserIds } = useLobbyChannel(true);
  const [lists, setLists] = useState<FriendLists>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[] | null>(null);
  const [searching, setSearching] = useState(false);
  const load = useCallback(async () => {
    try {
      setLists(await api.get<FriendLists>('/api/friends'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // Debounced search; typing does not fire a request per keystroke
  useEffect(() => {
    const term = query.trim();
    if (term.length === 0) 
    {
      setResults(null);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void api
        .get<{ users: Person[] }>(`/api/users?search=${encodeURIComponent(term)}`, controller.signal)
        .then((payload) => setResults(payload.users))
        .catch(() => undefined)
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const isOnline = (person: Person) => person.online || onlineUserIds.has(person.id);
  const act = async (action: () => Promise<unknown>) => {
    await action().catch(() => undefined);
    await load();
  };
  const knownIds = new Set([
    ...lists.accepted.map((p) => p.id),
    ...lists.incoming.map((p) => p.id),
    ...lists.outgoing.map((p) => p.id),
    ...lists.blocked.map((p) => p.id),
  ]);
  const row = (person: Person, actions: JSX.Element) => (
    <li
      key={person.id}
      className="flex items-center gap-3 rounded-xl border border-rule bg-surface px-3 py-2.5"
    >
      <Avatar name={person.displayName} src={person.avatarUrl} size={34} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
          <PresenceDot online={isOnline(person)} />
          {person.displayName}
        </p>
        <p className="text-xs text-muted">
          {t('common.level')} {person.level}
        </p>
      </div>
      {actions}
    </li>
  );
  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-6">
      <PageTitle title={t('friends.title')} subtitle={t('friends.subtitle')} />

      <div className="panel-pad">
        <label className="label" htmlFor="friend-search">
          {t('common.search')}
        </label>
        <input
          id="friend-search"
          className="input"
          placeholder={t('friends.searchPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />

        {searching && (
          <div className="mt-3 flex justify-center">
            <Spinner />
          </div>
        )}

        {results !== null && !searching && (
          <ul className="mt-3 space-y-2">
            {results.filter((person) => !knownIds.has(person.id)).length === 0 ? (
              <li className="py-2 text-center text-sm text-muted">{t('friends.noResults')}</li>
            ) : (
              results
                .filter((person) => !knownIds.has(person.id))
                .map((person) =>
                  row(
                    person,
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => void act(() => api.post('/api/friends', { userId: person.id }))}
                    >
                      {t('friends.add')}
                    </Button>,
                  ),
                )
            )}
          </ul>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <>
          {lists.incoming.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted">
                {t('friends.incoming')}
              </h2>
              <ul className="space-y-2">
                {lists.incoming.map((person) =>
                  row(
                    person,
                    <div className="flex gap-2">
                      <Button
                        className="px-3 py-1.5 text-xs"
                        onClick={() => void act(() => api.post(`/api/friends/${person.id}/accept`))}
                      >
                        {t('friends.accept')}
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => void act(() => api.del(`/api/friends/${person.id}`))}
                      >
                        {t('friends.decline')}
                      </Button>
                    </div>,
                  ),
                )}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted">
              {t('friends.yourFriends')}
            </h2>
            {lists.accepted.length === 0 ? (
              <EmptyState>{t('friends.empty')}</EmptyState>
            ) : (
              <ul className="space-y-2">
                {lists.accepted.map((person) =>
                  row(
                    person,
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => void act(() => api.del(`/api/friends/${person.id}`))}
                    >
                      {t('friends.removeFriend')}
                    </Button>,
                  ),
                )}
              </ul>
            )}
          </section>

          {lists.outgoing.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted">
                {t('friends.outgoing')}
              </h2>
              <ul className="space-y-2">
                {lists.outgoing.map((person) =>
                  row(
                    person,
                    <span className="chip">{t('friends.pending')}</span>,
                  ),
                )}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
