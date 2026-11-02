import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Красная кнопка подтверждения на iOS (выход, удаление). */
  destructive?: boolean;
}

/**
 * Диалог «Вы уверены?». Возвращает true, если пользователь подтвердил.
 * В веб-версии Alert из react-native-web ничего не показывает, поэтому там window.confirm.
 */
export const confirmAction = (options: ConfirmOptions): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${options.title}\n\n${options.message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        { text: options.cancelLabel ?? 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        {
          text: options.confirmLabel,
          style: options.destructive === true ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      // Android: тап мимо диалога закрывает его — считаем это отменой.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
};
