import { Button } from '@/shared/components/Button';
import { Placeholder } from '@/shared/components/Placeholder';
import { Screen } from '@/shared/components/Screen';
import type { RootStackScreenProps } from '@/navigation/types';

/** Детали игры (FR3.5). Данные из кэша бэклога на этапе 7, запуск Steam на этапе 9. */
export function GameDetailsScreen({ route }: RootStackScreenProps<'GameDetails'>) {
  return (
    <Screen>
      <Placeholder title={`Игра #${route.params.appid}`} stage={7} />
      <Button label="Играть" accessibilityHint="Запустит игру в Steam" disabled />
    </Screen>
  );
}
