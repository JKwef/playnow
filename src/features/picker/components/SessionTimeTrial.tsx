import { useState } from 'react';
import { Linking, View } from 'react-native';
import { AppText as Text } from '@/shared/components/AppText';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { useThemeColors } from '@/shared/theme/useTheme';
import { sessionsWithinBudget } from '../utils/timedSessions';

type Props =
  | { example: true }
  | {
      example: false;
      eligible: ReadonlyMap<number, number>;
      disabled: boolean;
      onOpen: (appid: number) => void;
    };

export function SessionTimeTrial(props: Props) {
  const colors = useThemeColors();
  const body = { color: colors.textPrimary };
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [sourceError, setSourceError] = useState<number | null>(null);
  const [answer, setAnswer] = useState<number | 'skip' | null>(null);
  const disabled = !props.example && props.disabled;
  const games =
    minutes === null || disabled
      ? []
      : sessionsWithinBudget(minutes, props.example ? undefined : props.eligible);
  return (
    <View style={{ gap: 8 }}>
      <Button
        label={open ? 'Закрыть подбор по времени' : 'Попробовать подбор по времени'}
        variant="secondary"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen(!open);
          setMinutes(null);
          setAnswer(null);
          setSourceError(null);
        }}
      />
      {open && (
        <>
          <Text style={body}>
            {props.example
              ? 'Проба на трёх примерах игр.'
              : 'Проба на вашей библиотеке с выбранными условиями подбора. Длительность проверена для трёх игр.'}{' '}
            Учитываем время самой партии. Запуск игры и паузы займут дополнительное время.
          </Text>
          <Text accessibilityRole="header" style={{ ...body, fontWeight: '700' }}>
            Сколько времени есть на игру?
          </Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Время на игру"
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
          >
            {[5, 15, 30].map((value) => (
              <Button
                key={value}
                label={`${value} мин`}
                accessibilityRole="radio"
                accessibilityState={{ checked: minutes === value }}
                aria-checked={minutes === value}
                variant={minutes === value ? 'primary' : 'secondary'}
                onPress={() => {
                  setMinutes(value);
                  setAnswer(null);
                  setSourceError(null);
                }}
              />
            ))}
          </View>
          {minutes !== null && (
            <>
              {disabled ? (
                <Text style={body}>
                  Дождитесь загрузки библиотеки и фильтров или повторите её на экране подбора.
                </Text>
              ) : games.length === 0 ? (
                <Text style={body}>
                  Среди игр, подходящих по вашим условиям, пока нет партии с подтверждённой
                  длительностью в пределах {minutes} минут.
                </Text>
              ) : (
                games.map((game) => (
                  <Card key={game.appid} style={{ gap: 6 }}>
                    <Text accessibilityRole="header" style={{ ...body, fontWeight: '700' }}>
                      {game.name}
                    </Text>
                    <Text style={body}>{game.description}</Text>
                    <Button
                      label="Источник длительности"
                      accessibilityLabel={`Источник длительности для ${game.name}`}
                      variant="tertiary"
                      onPress={() => {
                        setSourceError(null);
                        void Linking.openURL(game.source).catch(() => setSourceError(game.appid));
                      }}
                    />
                    {sourceError === game.appid && (
                      <Text style={body} accessibilityRole="alert">
                        Не удалось открыть источник. Попробуйте ещё раз.
                      </Text>
                    )}
                    {props.example ? (
                      <Button
                        label={
                          answer === game.appid ? '✓ Выбрано для пробы' : 'Я бы сыграл в эту игру'
                        }
                        variant="secondary"
                        onPress={() => setAnswer(game.appid)}
                      />
                    ) : (
                      <Button
                        label="Открыть карточку игры"
                        variant="secondary"
                        onPress={() => props.onOpen(game.appid)}
                      />
                    )}
                  </Card>
                ))
              )}
              {props.example && (
                <Button
                  label={answer === 'skip' ? '✓ Ничего не подходит' : 'Ничего не подходит'}
                  variant="tertiary"
                  onPress={() => setAnswer('skip')}
                />
              )}
            </>
          )}
        </>
      )}
    </View>
  );
}
