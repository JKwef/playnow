import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/shared/components/Button';
import { Screen } from '@/shared/components/Screen';
import { getSupabase } from '@/shared/services/supabase';
import { useThemeColors } from '@/shared/theme/useTheme';

let demoName = `Q${Math.random().toString(36).slice(2, 10)}`;
const demoNameListeners = new Set<() => void>();
const subscribeDemoName = (listener: () => void) => {
  demoNameListeners.add(listener);
  return () => {
    demoNameListeners.delete(listener);
  };
};
const getDemoName = () => demoName;

function accountName(user: { id: string; user_metadata: Record<string, unknown> }) {
  const saved = user.user_metadata.display_name;
  return typeof saved === 'string' && saved.trim()
    ? saved.trim()
    : 'Q' + user.id.replace(/-/g, '').slice(0, 10);
}

export function useHeaderProfileName(enabled: boolean) {
  const demo = useAuth((state) => state.status === 'demoAdmin');
  const localName = useSyncExternalStore(subscribeDemoName, getDemoName, getDemoName);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!enabled || demo) return;
    const {
      data: { subscription },
    } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setName(session ? accountName(session.user) : '');
    });
    return () => subscription.unsubscribe();
  }, [enabled, demo]);

  return enabled ? (demo ? localName : name) : '';
}

export function AccountScreen({
  settings = false,
  embedded = false,
}: {
  settings?: boolean;
  embedded?: boolean;
}) {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const steamId = useAuth((state) => state.user?.steamId);
  const demo = useAuth((state) => state.status === 'demoAdmin');
  const signOut = useAuth((state) => state.signOut);
  const [name, setName] = useState('');
  const [steamName, setSteamName] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(false);
  const [hover, setHover] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const text = { color: colors.textPrimary };
  const input = {
    ...text,
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  };

  useEffect(() => {
    if (demo) return;
    let active = true;
    const auth = getSupabase().auth;
    void auth
      .getSession()
      .then(({ data }) => {
        if (!active || !data.session) return;
        const user = data.session.user;
        setName(accountName(user));
        setEmail(user.email?.endsWith('@steam.playnow.invalid') ? '' : (user.email ?? ''));
        const persona = user.app_metadata.steam_nickname;
        if (typeof persona === 'string') setSteamName(persona);
      })
      .catch(() => {
        if (active) setMessage('Не удалось загрузить профиль.');
      });
    return () => {
      active = false;
    };
  }, [demo]);

  const save = async (field: 'name' | 'email' | 'password') => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const values =
        field === 'name'
          ? { data: { display_name: name.trim() } }
          : field === 'email'
            ? { email: email.trim() }
            : { password };
      const { error } = await getSupabase().auth.updateUser(values);
      if (error) throw error;
      if (field === 'name') setEditing(false);
      if (field === 'password') setPassword('');
      setMessage(field === 'email' ? 'Подтверди смену почты по ссылке из письма.' : 'Сохранено.');
    } catch {
      setMessage('Не удалось сохранить изменение. Проверь данные и попробуй снова.');
    } finally {
      setBusy(false);
    }
  };

  if (demo && settings) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={{ ...text, fontSize: 26, fontWeight: '800' }}>
          admin
        </Text>
        <Text style={{ color: colors.textSecondary }}>Пробный профиль · локальная сборка</Text>
        <Button
          label="Выйти из пробного аккаунта"
          onPress={() => useAuth.setState({ status: 'signedOut', user: null, error: null })}
        />
      </Screen>
    );
  }

  const content = (
    <>
      {settings ? (
        <>
          <Text accessibilityRole="header" style={{ ...text, fontSize: 23, fontWeight: '700' }}>
            Настройки аккаунта
          </Text>
          {steamId ? (
            <Text style={text}>Логин для входа по паролю: {steamId}</Text>
          ) : (
            <>
              <TextInput
                style={input}
                accessibilityLabel="Почта для входа"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <Button
                label="Изменить почту для входа"
                disabled={busy || !email.includes('@')}
                onPress={() => void save('email')}
              />
            </>
          )}
          <TextInput
            style={input}
            accessibilityLabel="Новый пароль"
            placeholder="Новый пароль, не менее 8 символов"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button
            label="Сохранить пароль"
            disabled={busy || password.length < 8}
            onPress={() => void save('password')}
          />
        </>
      ) : (
        <>
          <View
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            {editing ? (
              <TextInput
                style={[input, { flex: 1 }]}
                accessibilityLabel="Имя в профиле"
                autoFocus
                maxLength={40}
                value={name}
                onChangeText={setName}
              />
            ) : (
              <Text
                accessibilityRole="header"
                style={{ ...text, fontSize: 26, fontWeight: '800', flexShrink: 1 }}
              >
                {name || (demo ? demoName : 'Профиль')}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Редактировать имя"
              onFocus={() => setHover(true)}
              onBlur={() => setHover(false)}
              onPress={() => {
                if (demo && !name) setName(demoName);
                setEditing(true);
              }}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (hover || Platform.OS !== 'web') && !editing ? 1 : 0,
              }}
            >
              <Text style={{ color: colors.secondary, fontSize: 20 }}>✎</Text>
            </Pressable>
          </View>
          {editing && (
            <Button
              label="Сохранить имя"
              disabled={busy || !name.trim()}
              onPress={() => {
                if (demo) {
                  demoName = name.trim();
                  demoNameListeners.forEach((listener) => listener());
                  setName(demoName);
                  setEditing(false);
                } else void save('name');
              }}
            />
          )}
          {!!steamId && (
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              {steamName || `SteamID ${steamId}`}
            </Text>
          )}
          {!embedded && (
            <Button
              label="Настройки аккаунта"
              variant="secondary"
              onPress={() => navigation.navigate('AccountSettings')}
            />
          )}
          {!embedded && !steamId && (
            <Button
              label="Выйти из аккаунта"
              variant="secondary"
              onPress={() => {
                if (demo) useAuth.setState({ status: 'signedOut', user: null, error: null });
                else void signOut();
              }}
            />
          )}
        </>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={text}>
          {message}
        </Text>
      )}
    </>
  );
  return embedded ? <View style={{ gap: 6 }}>{content}</View> : <Screen>{content}</Screen>;
}

export function AccountSettingsScreen() {
  return <AccountScreen settings />;
}
