import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { GenreFilter, PickerMode } from '@/features/picker/types';

/**
 * Все маршруты приложения и их параметры.
 * Параметры держим минимальными (только id): сами данные экраны берут из стора/кэша,
 * чтобы не таскать большие объекты через навигацию и не ломать deep link.
 */
export type MainTabParamList = { Picker: undefined; Backlog: undefined; Settings: undefined };

export type RootStackParamList = {
  // Неавторизованная зона
  Login: undefined;
  Demo: { favorites?: boolean; sessionId?: string; demoInvite?: boolean } | undefined;
  DemoFriend: { friendId: string };
  AccountSettings: undefined;
  // Авторизованная зона
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  BacklogLoading: undefined;
  Result: {
    contextId: string;
    mode?: PickerMode;
    genreFilter?: GenreFilter;
    installedOnly?: boolean;
  };
  GameDetails: { appid: number };
  AddGame: undefined;
  Postponed: undefined;
  RecommendationHistory: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList | keyof MainTabParamList> =
  T extends keyof MainTabParamList
    ? CompositeScreenProps<
        BottomTabScreenProps<MainTabParamList, T>,
        NativeStackScreenProps<RootStackParamList>
      >
    : NativeStackScreenProps<RootStackParamList, Extract<T, keyof RootStackParamList>>;
