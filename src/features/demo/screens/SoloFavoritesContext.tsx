import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';

type FavoritesState = [number[], Dispatch<SetStateAction<number[]>>];
const Context = createContext<FavoritesState | null>(null);

/** A signed-in player's solo likes live for the current session, across screens. */
export function SoloFavoritesProvider({ children }: { children: ReactNode }) {
  const favorites = useState<number[]>([]);
  return <Context.Provider value={favorites}>{children}</Context.Provider>;
}

export const useSoloFavorites = () => useContext(Context);
