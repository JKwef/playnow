import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Все маршруты приложения и их параметры.
 * Параметры держим минимальными (только id): сами данные экраны берут из стора/кэша,
 * чтобы не таскать большие объекты через навигацию и не ломать deep link.
 */
export type RootStackParamList = {
  // Неавторизованная зона
  Login: undefined;
  // Авторизованная зона
  BacklogLoading: undefined;
  Picker: undefined;
  Result: { contextId: string };
  Backlog: undefined;
  GameDetails: { appid: number };
  AddGame: undefined;
  Postponed: undefined;
  Settings: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
