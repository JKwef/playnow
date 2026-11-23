import type { Game } from '@/features/backlog/types/Game';
import { genreLabel } from '@/features/backlog/utils/genres';
import { isManualAppId } from '@/features/backlog/utils/manualGame';
import {
  isStoreGenre,
  type StoreGenre,
  type StoreOffer,
} from '../../../supabase/functions/_shared/purchaseCatalog';

export * from '../../../supabase/functions/_shared/purchaseCatalog';

export function playedLibrary(games: readonly Game[]) {
  const seen = new Set<number>();
  return games
    .filter((game) => {
      if (
        !game.steamImported ||
        game.playtimeMinutes <= 0 ||
        seen.has(game.appid) ||
        isManualAppId(game.appid)
      )
        return false;
      seen.add(game.appid);
      return true;
    })
    .map((game) => ({
      name: game.name,
      genres: (game.genresOverride ?? game.genres).filter(isStoreGenre),
    }));
}

export function rankOffers(
  offers: readonly StoreOffer[],
  games: readonly Game[],
  played: ReturnType<typeof playedLibrary>,
  selected: readonly StoreGenre[],
  hidden: readonly { appid: number }[],
) {
  const excluded = new Set(
    [...games.filter((game) => !isManualAppId(game.appid)), ...hidden].map((game) => game.appid),
  );
  const results = [];
  const selectedGenres = [...new Set(selected)];
  for (const offer of offers) {
    if (excluded.has(offer.appid)) continue;
    excluded.add(offer.appid);
    const genres = new Set(offer.genres);
    const explicit = selectedGenres.filter((genre) => genres.has(genre));
    const votes = played.filter((game) => game.genres.some((genre) => genres.has(genre)));
    const example = votes[0];
    const shared = example?.genres.find((genre) => genres.has(genre));
    const reason = explicit[0]
      ? `Вы выбрали жанр «${genreLabel(explicit[0])}».`
      : example && shared
        ? `Вы играли в ${example.name}. Общий жанр — «${genreLabel(shared)}».`
        : null;
    if (reason) results.push({ offer, reason, explicit: explicit.length, votes: votes.length });
  }
  return results
    .sort(
      (a, b) =>
        b.explicit - a.explicit ||
        b.votes - a.votes ||
        a.offer.name.localeCompare(b.offer.name, 'ru') ||
        a.offer.appid - b.offer.appid,
    )
    .slice(0, 5);
}
