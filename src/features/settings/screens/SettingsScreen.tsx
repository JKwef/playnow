import { Button } from '@/shared/components/Button';
import { Placeholder } from '@/shared/components/Placeholder';
import { Screen } from '@/shared/components/Screen';
import { useAuth } from '@/shared/hooks/useAuth';

/** Настройки (FR6). Полная версия на этапе 10. */
export function SettingsScreen() {
  const signOut = useAuth((state) => state.signOut);

  return (
    <Screen>
      <Placeholder title="Настройки" stage={10} />
      {/* После signOut навигатор сам переключится на экран входа, navigate() не нужен. */}
      <Button label="Выйти из аккаунта" variant="tertiary" onPress={() => void signOut()} />
    </Screen>
  );
}
