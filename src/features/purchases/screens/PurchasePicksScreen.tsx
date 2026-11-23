import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Image, Linking, View } from 'react-native';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import { GenreChips } from '@/features/backlog/components/GenreChips';
import { genreLabel } from '@/features/backlog/utils/genres';
import { steamStoreUrl } from '@/features/launch/services/steamLauncher';
import { AppText as Text } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { OptionsModal } from '@/shared/components/OptionsModal';
import { Screen } from '@/shared/components/Screen';
import { fontSize, spacing } from '@/shared/constants';
import { accountRevision } from '@/shared/services/accountScope';
import { useThemeColors } from '@/shared/theme/useTheme';
import {
  OFFER_TTL_MS,
  STORE_REGIONS,
  STORE_TAGS,
  isStoreGenre,
  isStoreRegion,
  playedLibrary,
  rankOffers,
  type StoreGenre,
  type StoreOffer,
  type StoreRegion,
} from '../catalog';
import {
  readSettings,
  updateSettings,
  type PurchaseMark,
  type PurchaseSettings,
} from '../services/purchaseSettings';
import { loadCatalogPage } from '../services/storeCatalog';

const regionOptions = Object.entries(STORE_REGIONS).map(([value, label]) => ({ value, label }));
const genreOptions = Object.keys(STORE_TAGS)
  .filter(isStoreGenre)
  .map((value) => ({ value, label: genreLabel(value) }));

export function PurchasePicksScreen() {
  const account = useAuth((state) => (state.status === 'signedIn' ? state.user?.steamId : null));
  return account ? <PurchasePicks key={account} account={account} /> : null;
}

function PurchasePicks({ account }: { account: string }) {
  const colors = useThemeColors();
  const body = { color: colors.textPrimary, fontSize: fontSize.body };
  const heading = { ...body, fontSize: fontSize.subtitle, fontWeight: '700' as const };
  const client = useQueryClient();
  const backlog = useBacklog();
  const settingsKey = ['purchase-settings', account] as const;
  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: () => readSettings(account),
    staleTime: Infinity,
    retry: false,
    networkMode: 'always',
  });
  const data = settings.data;
  const region = data?.region ?? null;
  const [modal, setModal] = useState<'region' | 'genres' | null>(null);
  const [draft, setDraft] = useState<StoreGenre[]>([]);
  const [showMarks, setShowMarks] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const played = useMemo(() => playedLibrary(backlog.games ?? []), [backlog.games]);
  const interests = useMemo(
    () => [...new Set([...(data?.genres ?? []), ...played.flatMap((game) => game.genres)])].sort(),
    [data?.genres, played],
  );
  const catalog = useInfiniteQuery({
    queryKey: ['purchase-catalog', account, region, interests],
    enabled: region !== null && backlog.games !== undefined && interests.length > 0,
    retry: false,
    staleTime: OFFER_TTL_MS,
    refetchInterval: OFFER_TTL_MS,
    networkMode: 'always',
    initialPageParam: interests.map((genre) => ({ genre, start: 0 })),
    queryFn: ({ signal, pageParam }) => {
      if (!region) throw new Error('Region required');
      return loadCatalogPage(region, pageParam, signal);
    },
    getNextPageParam: (page) => (page.next.length ? page.next : undefined),
  });
  const picks = useMemo(
    () =>
      rankOffers(
        catalog.data?.pages.flatMap((page) => page.offers) ?? [],
        backlog.games ?? [],
        played,
        data?.genres ?? [],
        data?.marks ?? [],
      ),
    [catalog.data, backlog.games, played, data],
  );
  const [now, setClock] = useState(Date.now);
  const deadline = Math.min(
    ...picks.map(({ offer }) => offer.priceValidUntil).filter((time) => time > now),
  );
  useEffect(() => {
    if (!Number.isFinite(deadline)) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.max(1, deadline - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [deadline]);
  const { refetch, dataUpdatedAt } = catalog;
  const canLoad = !!region && backlog.games !== undefined && interests.length > 0;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setClock(Date.now());
      if (canLoad && Date.now() - dataUpdatedAt >= OFFER_TTL_MS) void refetch();
    });
    return () => subscription.remove();
  }, [canLoad, dataUpdatedAt, refetch]);

  async function save(change: (current: PurchaseSettings) => PurchaseSettings) {
    const revision = accountRevision(account);
    const current = () =>
      useAuth.getState().user?.steamId === account && accountRevision(account) === revision;
    if (!data || saving || !current()) return;
    setSaving(true);
    setMessage(null);
    try {
      const saved = await updateSettings(account, revision, change);
      if (current() && saved) client.setQueryData(settingsKey, saved);
    } catch {
      if (current()) setMessage('Не удалось сохранить изменение. Попробуйте ещё раз.');
    } finally {
      if (current()) setSaving(false);
    }
  }
  const mark = (offer: StoreOffer, kind: PurchaseMark['kind']) =>
    void save((s) => ({
      ...s,
      marks: [
        ...s.marks.filter((m) => m.appid !== offer.appid),
        { appid: offer.appid, name: offer.name, kind },
      ],
    }));
  const chooseRegion = (value: string) => {
    if (isStoreRegion(value)) {
      setModal(null);
      void save((s) => ({ ...s, region: value }));
    }
  };
  const openGenres = () => {
    setDraft(data?.genres ?? []);
    setModal('genres');
  };

  return (
    <Screen>
      <Text style={heading} accessibilityRole="header">
        Что купить
      </Text>
      {!data &&
        (settings.isError ? (
          <>
            <Text style={body}>Не удалось прочитать ваши настройки подбора.</Text>
            <Button label="Повторить" onPress={() => void settings.refetch()} />
          </>
        ) : (
          <Text style={body}>Загружаем настройки…</Text>
        ))}
      {data && (
        <>
          <Button
            label={
              region
                ? `Регион магазина · ${STORE_REGIONS[region]}`
                : 'Выбрать регион магазина Steam'
            }
            variant={region ? 'secondary' : 'primary'}
            disabled={saving}
            onPress={() => setModal('region')}
          />
          <OptionsModal
            visible={modal === 'region'}
            title="В каком регионе ваш магазин Steam?"
            options={regionOptions}
            selected={region ? [region] : []}
            multiple={false}
            onToggle={chooseRegion}
            onClose={() => setModal(null)}
          />
          {region && (
            <Button
              label="Изменить жанры"
              variant="secondary"
              onPress={openGenres}
              disabled={saving}
            />
          )}
          <OptionsModal
            visible={modal === 'genres'}
            title="Интересующие жанры"
            options={genreOptions}
            selected={draft}
            multiple
            onClear={() => setDraft([])}
            onToggle={(genre) =>
              setDraft((values) =>
                values.includes(genre) ? values.filter((g) => g !== genre) : [...values, genre],
              )
            }
            onClose={() => {
              setModal(null);
              void save((s) => ({ ...s, genres: draft }));
            }}
          />
          {message && (
            <Text accessibilityRole="alert" style={body}>
              {message}
            </Text>
          )}
          {backlog.games === undefined ? (
            <>
              <Text style={body}>
                {backlog.isRefreshing
                  ? 'Загружаем библиотеку…'
                  : 'Для подбора покупок сначала загрузите библиотеку Steam.'}
              </Text>
              <Button
                label="Повторить импорт"
                variant="secondary"
                disabled={backlog.isRefreshing}
                onPress={() => void backlog.refresh()}
              />
            </>
          ) : (
            region && (
              <>
                {!interests.length ? (
                  <Text style={body}>
                    Выберите интересующие жанры, чтобы получить рекомендации.
                  </Text>
                ) : catalog.isError && !catalog.isFetchNextPageError ? (
                  <>
                    <Text style={body} accessibilityRole="alert">
                      Каталог Steam сейчас недоступен.
                    </Text>
                    <Button label="Повторить" onPress={() => void catalog.refetch()} />
                  </>
                ) : !catalog.data ? (
                  <Text style={body} accessibilityLiveRegion="polite">
                    Проверяем предложения Steam…
                  </Text>
                ) : !picks.length ? (
                  <Text style={body}>
                    Среди проверенных предложений в этом регионе нет новых игр по вашим жанрам.
                    Измените жанры или верните скрытую игру.
                  </Text>
                ) : (
                  picks.map(({ offer, reason }) => (
                    <OfferCard
                      key={offer.appid}
                      offer={offer}
                      reason={reason}
                      region={region}
                      now={now}
                      saving={saving}
                      onMark={(kind) => mark(offer, kind)}
                    />
                  ))
                )}
                {catalog.hasNextPage && !catalog.isRefetchError && picks.length < 5 && (
                  <>
                    {catalog.isFetchNextPageError && (
                      <Text style={body} accessibilityRole="alert">
                        Не удалось загрузить ещё предложения Steam.
                      </Text>
                    )}
                    <Button
                      label={
                        catalog.isFetchNextPageError ? 'Повторить' : 'Проверить ещё предложения'
                      }
                      disabled={catalog.isFetching}
                      variant="secondary"
                      onPress={() => void catalog.fetchNextPage()}
                    />
                  </>
                )}
              </>
            )
          )}
          {data.marks.length > 0 && (
            <>
              <Button
                label={`Скрытые игры (${data.marks.length})`}
                variant="secondary"
                onPress={() => setShowMarks((value) => !value)}
              />
              {showMarks &&
                data.marks.map((item) => (
                  <Card key={item.appid}>
                    <Text style={body}>
                      {item.name} · {item.kind === 'owned' ? 'Уже есть' : 'Не интересно'}
                    </Text>
                    <Button
                      label="Отменить отметку"
                      accessibilityLabel={`Отменить отметку для ${item.name}`}
                      disabled={saving}
                      variant="tertiary"
                      onPress={() =>
                        void save((s) => ({
                          ...s,
                          marks: s.marks.filter((m) => m.appid !== item.appid),
                        }))
                      }
                    />
                  </Card>
                ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function OfferCard({
  offer,
  reason,
  region,
  now,
  saving,
  onMark,
}: {
  offer: StoreOffer;
  reason: string;
  region: StoreRegion;
  now: number;
  saving: boolean;
  onMark: (kind: PurchaseMark['kind']) => void;
}) {
  const [failed, setFailed] = useState(false);
  const colors = useThemeColors();
  const text = { color: colors.textPrimary, fontSize: fontSize.body };
  async function openSteam() {
    setFailed(false);
    try {
      await Linking.openURL(`${steamStoreUrl(offer.appid)}?cc=${region}`);
    } catch {
      setFailed(true);
    }
  }
  return (
    <Card style={{ gap: spacing.sm }}>
      {offer.coverUrl && (
        <Image
          source={{ uri: offer.coverUrl }}
          resizeMode="cover"
          style={{ width: '100%', aspectRatio: 460 / 215 }}
        />
      )}
      <Text
        accessibilityRole="header"
        style={{ ...text, fontSize: fontSize.subtitle, fontWeight: '700' }}
      >
        {offer.name}
      </Text>
      <GenreChips genres={offer.genres} />
      <Text style={text}>{reason}</Text>
      <View style={{ gap: spacing.xs }}>
        <Text style={{ ...text, fontWeight: '700' }}>
          {offer.price && offer.priceValidUntil > now
            ? [offer.price, offer.discount ? `−${offer.discount}%` : null]
                .filter(Boolean)
                .join(' · ')
            : 'Уточнить цену в Steam'}
        </Text>
        <Button label="Посмотреть в Steam" onPress={() => void openSteam()} />
        {failed && (
          <Text style={text} accessibilityRole="alert">
            Не удалось открыть Steam. Попробуйте ещё раз.
          </Text>
        )}
      </View>
      <Button
        label="Не интересно"
        variant="secondary"
        disabled={saving}
        onPress={() => onMark('uninterested')}
      />
      <Button
        label="Уже есть"
        variant="tertiary"
        disabled={saving}
        onPress={() => onMark('owned')}
      />
    </Card>
  );
}
