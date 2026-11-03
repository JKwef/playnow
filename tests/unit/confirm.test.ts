import { Alert, Platform, type AlertButton } from 'react-native';

import { confirmAction } from '@/shared/utils/confirm';

const options = { title: 'Выйти?', message: 'Точно?', confirmLabel: 'Выйти', destructive: true };

describe('confirmAction', () => {
  afterEach(() => jest.restoreAllMocks());

  /** Нажимает кнопку диалога по индексу: 0 — «Отмена», 1 — подтверждение. */
  const pressAlertButton = (index: number) =>
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons?: AlertButton[]) => {
      buttons?.[index]?.onPress?.();
    });

  test('подтверждение возвращает true, кнопка красная', async () => {
    const alert = pressAlertButton(1);
    await expect(confirmAction(options)).resolves.toBe(true);
    const buttons = alert.mock.calls[0]?.[2];
    expect(buttons?.[1]).toMatchObject({ text: 'Выйти', style: 'destructive' });
    expect(buttons?.[0]).toMatchObject({ text: 'Отмена', style: 'cancel' });
  });

  test('отмена возвращает false', async () => {
    pressAlertButton(0);
    await expect(confirmAction({ ...options, destructive: false })).resolves.toBe(false);
  });

  test('закрытие диалога тапом мимо — тоже отмена', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, _b, alertOptions) => {
      alertOptions?.onDismiss?.();
    });
    await expect(confirmAction(options)).resolves.toBe(false);
  });

  test('в вебе использует window.confirm', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    const confirmSpy = jest.fn(() => true);
    Object.defineProperty(globalThis, 'window', {
      value: { confirm: confirmSpy },
      configurable: true,
    });
    try {
      await expect(confirmAction(options)).resolves.toBe(true);
      expect(confirmSpy).toHaveBeenCalledWith('Выйти?\n\nТочно?');
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });
});
