import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Modal, ScrollView, Text, TextInput, View } from 'react-native';

import { selectIsBusy, useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/shared/components/Button';
import { getEnv } from '@/shared/config/env';
import { getSupabase } from '@/shared/services/supabase';
import { useThemeColors } from '@/shared/theme/useTheme';

export function AccountAuth({ onClose }: { onClose: () => void }) {
  const colors = useThemeColors();
  const signInSteam = useAuth((state) => state.signIn);
  const steamBusy = useAuth(selectIsBusy);
  const steamError = useAuth((state) => state.error);
  const [step, setStep] = useState<'login' | 'email' | 'code' | 'password'>('login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewComplete, setPreviewComplete] = useState(false);
  const [registration] = useState(() => {
    const env = getEnv();
    return createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });
  const input = {
    color: colors.textPrimary,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  };
  const email = login.trim();
  const canSubmit =
    step === 'code'
      ? /^[0-9]{6,10}$/.test(code.trim())
      : step === 'password'
        ? password.length >= 8
        : step === 'email'
          ? email.includes('@')
          : email.length > 0 && password.length > 0;

  const submit = async () => {
    if (!canSubmit || busy || steamBusy) return;
    setBusy(true);
    setError('');
    try {
      if (__DEV__ && step === 'login' && email === 'admin') {
        if (password !== 'admin!') throw new Error('Invalid demo credentials');
        useAuth.setState({ status: 'demoAdmin', user: null, error: null });
        onClose();
        return;
      }
      if (__DEV__ && step !== 'login') {
        if (step === 'email') {
          setStep('code');
        } else if (step === 'code') {
          if (code.trim() !== '111111') {
            setError('Для пробной регистрации введи код 111111.');
            return;
          }
          setStep('password');
        } else {
          setPassword('');
          setCode('');
          setPreviewComplete(true);
        }
        return;
      }
      const auth = getSupabase().auth;
      if (step === 'login') {
        const address = /^\d{17}$/.test(email) ? `${email}@steam.playnow.invalid` : email;
        const result = await auth.signInWithPassword({ email: address, password });
        if (result.error) throw result.error;
        await useAuth.getState().restoreSession();
        onClose();
      } else if (step === 'email') {
        if (email.toLowerCase().endsWith('@steam.playnow.invalid'))
          throw new Error('Reserved address');
        const result = await auth.signInWithOtp({ email });
        if (result.error) throw result.error;
        setStep('code');
      } else if (step === 'code') {
        // Verify in a separate, in-memory client so the app only adopts the session after password setup.
        const result = await registration.auth.verifyOtp({
          email,
          token: code.trim(),
          type: 'email',
        });
        if (result.error) throw result.error;
        setStep('password');
      } else {
        const result = await registration.auth.updateUser({ password });
        if (result.error) throw result.error;
        const { data } = await registration.auth.getSession();
        if (!data.session) throw new Error('Missing registration session');
        const adopted = await auth.setSession(data.session);
        if (adopted.error) throw adopted.error;
        await useAuth.getState().restoreSession();
        onClose();
      }
    } catch {
      setError(
        step === 'login'
          ? 'Не удалось войти. Проверь логин и пароль.'
          : step === 'email'
            ? 'Не удалось отправить код. Проверь почту или повтори позже.'
            : step === 'code'
              ? 'Код неверный или истёк. Запроси новый код.'
              : 'Не удалось сохранить пароль. Попробуй другой пароль.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      transparent
      visible
      onRequestClose={() => {
        if (!busy && (step !== 'password' || __DEV__)) onClose();
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#0009' }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{
            flexGrow: 0,
            width: '100%',
            maxWidth: 430,
            maxHeight: '90%',
            alignSelf: 'center',
            borderRadius: 20,
            backgroundColor: colors.surface,
          }}
          contentContainerStyle={{ padding: 20, gap: 12 }}
        >
          {__DEV__ && previewComplete ? (
            <>
              <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 23 }}>
                Пробная регистрация завершена
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                Это проверка формы. Аккаунт и пароль не сохраняются.
              </Text>
              <Button label="Готово" onPress={onClose} />
            </>
          ) : (
            <>
              <Text
                accessibilityRole="header"
                style={{ color: colors.textPrimary, fontSize: 23, fontWeight: '800' }}
              >
                {
                  {
                    login: 'Войти',
                    email: 'Регистрация',
                    code: __DEV__ ? 'Пробный код' : 'Код из письма',
                    password: 'Придумай пароль',
                  }[step]
                }
              </Text>
              {__DEV__ && step !== 'login' && (
                <Text style={{ color: colors.textSecondary }}>
                  Пробная регистрация · код 111111. Письмо не отправляется.
                </Text>
              )}
              {!__DEV__ && step === 'email' && (
                <Text style={{ color: colors.textSecondary }}>
                  Адрес почты сохранится в Supabase Auth для входа в Quaeso. На него придёт код
                  подтверждения.
                </Text>
              )}
              {(step === 'login' || step === 'email') && (
                <TextInput
                  style={input}
                  accessibilityLabel="Логин"
                  placeholder={step === 'email' ? 'Почта' : 'Почта или SteamID'}
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={login}
                  onChangeText={setLogin}
                />
              )}
              {step === 'code' && (
                <TextInput
                  style={input}
                  accessibilityLabel={__DEV__ ? 'Пробный код' : 'Код из письма'}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                />
              )}
              {(step === 'login' || step === 'password') && (
                <TextInput
                  style={input}
                  accessibilityLabel="Пароль"
                  placeholder={step === 'password' ? 'Не менее 8 символов' : 'Пароль'}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              )}
              <Button
                label={
                  {
                    login: 'Войти',
                    email: 'Получить код',
                    code: 'Подтвердить код',
                    password: __DEV__ ? 'Завершить пробную регистрацию' : 'Сохранить и войти',
                  }[step]
                }
                disabled={!canSubmit || busy || steamBusy}
                onPress={() => void submit()}
              />
              {step === 'login' || step === 'email' ? (
                <Button
                  label="Продолжить через Steam"
                  variant="secondary"
                  disabled={busy || steamBusy}
                  onPress={() => void signInSteam()}
                />
              ) : null}
              {step !== 'password' && (
                <Button
                  label={
                    step === 'login'
                      ? 'Зарегистрироваться'
                      : step === 'code'
                        ? 'Запросить новый код'
                        : 'Уже есть аккаунт'
                  }
                  variant="tertiary"
                  disabled={busy || steamBusy}
                  onPress={() => {
                    setStep(step === 'email' ? 'login' : 'email');
                    setPassword('');
                    setCode('');
                    setError('');
                  }}
                />
              )}
              {(error || steamError) && (
                <Text accessibilityRole="alert" style={{ color: colors.error }}>
                  {error || steamError}
                </Text>
              )}
              {(step !== 'password' || __DEV__) && (
                <Button
                  label="Отмена"
                  variant="tertiary"
                  disabled={busy || steamBusy}
                  onPress={onClose}
                />
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
