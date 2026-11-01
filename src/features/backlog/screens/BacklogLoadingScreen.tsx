import { Button } from '@/shared/components/Button';
import { LoadingIndicator } from '@/shared/components/LoadingIndicator';
import { Placeholder } from '@/shared/components/Placeholder';
import { Screen } from '@/shared/components/Screen';
import type { RootStackScreenProps } from '@/navigation/types';

/** «Загружаем ваши игры из Steam...» (UI2). Реальный импорт на этапе 5. */
export function BacklogLoadingScreen({ navigation }: RootStackScreenProps<'BacklogLoading'>) {
  return (
    <Screen withTopInset centered>
      <Placeholder title="Загружаем ваши игры из Steam..." stage={5} />
      <LoadingIndicator label="Загружаем ваши игры из Steam" />
      {/* replace, а не navigate: возвращаться на экран загрузки кнопкой «Назад» не нужно. */}
      <Button label="Готово" variant="secondary" onPress={() => navigation.replace('Picker')} />
    </Screen>
  );
}
