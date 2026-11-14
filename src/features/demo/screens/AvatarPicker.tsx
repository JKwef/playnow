import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { getSupabase } from '@/shared/services/supabase';
import { useThemeColors } from '@/shared/theme/useTheme';

const avatars = [
  {
    name: 'Следопытка',
    hair: '#332738',
    skin: '#BD7951',
    coat: '#4C8298',
    accent: '#8BD2AE',
    pixels: [
      '....kkkk....',
      '...khhhhk...',
      '..khahhhhk..',
      '..khhhsshk..',
      '..khsssssk..',
      '..khkskssk..',
      '..khssmssk..',
      '...kksskk...',
      '..khkcck....',
      '..kkcacak...',
      '.khkccccsk..',
      '..kkakack...',
      '...kckck....',
      '...kk.kk....',
    ],
  },
  {
    name: 'Механик',
    hair: '#A85835',
    skin: '#8C503A',
    coat: '#47758E',
    accent: '#F4BD56',
    pixels: [
      '....kkkk....',
      '...kaaakk...',
      '..kacacaak..',
      '..kaaaaaakk.',
      '..khssshkk..',
      '..kskssk.k..',
      '...ksmskk...',
      '...kksskk...',
      '..kaccck.kk.',
      '..kccack.kak',
      '..ksccskkak.',
      '...kccckkk..',
      '...kckck....',
      '..kkk.kk....',
    ],
  },
  {
    name: 'Эльфийка',
    hair: '#D6C8DB',
    skin: '#DCAE93',
    coat: '#535770',
    accent: '#B7A06D',
    pixels: [
      '....kkkk....',
      '...khhhhkk..',
      '..khhhhhhkk.',
      '..khhsshhhk.',
      'k.khskskshk.',
      'ksksssssskk.',
      '.kshssmskhk.',
      '..khksskhhk.',
      '..khkccakhk.',
      '..khccccchk.',
      '...kscccksk.',
      '...kcaaack..',
      '...kckcck...',
      '...kk.kk....',
    ],
  },
  {
    name: 'Орк',
    hair: '#214939',
    skin: '#79A95E',
    coat: '#805033',
    accent: '#EDDBA3',
    pixels: [
      '....kkkk....',
      '...khhhhk...',
      '..khhshhhk..',
      '..kssssshk..',
      '.ksskskskk..',
      'ksssssssssk.',
      '.kssasamkk..',
      '..kksssk....',
      '..kccaccak..',
      '.kscccacksk.',
      '.ksccaccskk.',
      '..kkccckk...',
      '...kckck....',
      '..kkk.kkk...',
    ],
  },
  {
    name: 'Лиса',
    hair: '#DD793E',
    skin: '#FFE8BA',
    coat: '#A84A30',
    accent: '#F4A958',
    pixels: [
      '............',
      '..k....k....',
      '.khk..khk...',
      '.khskkhsk...',
      '.khahhhhk...',
      '..khkhkhk...',
      '..kssskk....',
      '...ksskk....',
      '...kshhk..k.',
      '..khshhkkhsk',
      '..khhhhhhsk.',
      '..kchhhkkk..',
      '...kckck....',
      '...kk.kk....',
    ],
  },
  {
    name: 'Кот',
    hair: '#8A91A8',
    skin: '#E3DFEF',
    coat: '#4D5271',
    accent: '#E8A5AE',
    pixels: [
      '............',
      '..k.....k...',
      '.khk...khk..',
      '.kakkkkhak..',
      '.khhchhhhk..',
      '.khkhhkhhk..',
      'kkhssasshkk.',
      '..khsmshk...',
      '...kkhkk..k.',
      '..khsshhkkk.',
      '..khsshckhk.',
      '..kchhcckk..',
      '...khkhk....',
      '...kk.kk....',
    ],
  },
  {
    name: 'Маг',
    hair: '#634c99',
    skin: '#eec5a0',
    coat: '#55417d',
    accent: '#9befde',
    pixels: [
      '...k.........',
      '..khk........',
      '..khhk.......',
      '.khaaak......',
      'kkhhhhhkk....',
      '.kssksk......',
      '.ksssskk..k..',
      '..ksssskk.ka.',
      '..kcccck.ka..',
      '.kccackkka...',
      '.kcccck.ka...',
      '..kkkk..ka...',
    ],
  },
  {
    name: 'Алхимик',
    hair: '#975338',
    skin: '#edc19a',
    coat: '#35736b',
    accent: '#b8e97e',
    pixels: [
      '..kkkkk......',
      '.khhahhk.....',
      '.khhhhhk.....',
      '.kskkskk.....',
      '.ksssssk.....',
      '..kksskk.....',
      '..kacck..kk..',
      '.ksccck..ksk.',
      '.ksccckkkak..',
      '..kccck.kk...',
      '..kk.kk......',
    ],
  },
  {
    name: 'Кузнец',
    hair: '#69402d',
    skin: '#d88f68',
    coat: '#3c506d',
    accent: '#dfb668',
    pixels: [
      '..kkkkkk.....',
      '.khhhhhhk....',
      '.khssshhk....',
      '.ksksskks....',
      '.kshhshhk....',
      '..khhkkk.....',
      '..kaccck.kk..',
      '.ksccccskak..',
      '.ksccacskkk..',
      '..kccck..k...',
      '..kk.kk......',
    ],
  },
  {
    name: 'Капитан',
    hair: '#334a73',
    skin: '#83543f',
    coat: '#2e546e',
    accent: '#ecc775',
    pixels: [
      '...kkkk......',
      '..khhhkk.....',
      '.khahhhhk....',
      'kkhhhhhhkk...',
      '..ksksksk....',
      '..ksssssk....',
      '...kkkkk.....',
      '..kaacck.....',
      '.ksccccsk....',
      '..kccaak.....',
      '..kk..kk.....',
    ],
  },
  {
    name: 'Лучница',
    hair: '#9E482F',
    skin: '#ecc49d',
    coat: '#427B58',
    accent: '#E9BB69',
    pixels: [
      '...kkkk......',
      '..khhhhk.....',
      '.khchhhhk....',
      '.khsksskk....',
      '.khssskh.....',
      '..ksskkh.aka.',
      '..kacckh.kak.',
      '.kscccskkkak.',
      '.kcccck..kak.',
      '..kcckk..aka.',
      '..kk.kk......',
    ],
  },
  {
    name: 'Друид',
    hair: '#49634a',
    skin: '#b78060',
    coat: '#587b4b',
    accent: '#afe57b',
    pixels: [
      '...kkkk......',
      '..khhhhk..k..',
      '.khahhhk.ka..',
      '.khsskkskka..',
      '.khsssmk..k..',
      '..kksskk..k..',
      '..kaccck..k..',
      '.kcccccckkk..',
      '.kccaccck.k..',
      '..kkkkkk..k..',
      '...kk.kk.....',
    ],
  },
  {
    name: 'Гном',
    hair: '#933a44',
    skin: '#e6a77b',
    coat: '#a85d3a',
    accent: '#f3c06b',
    pixels: [
      '...kkkk......',
      '..kahhak.....',
      '.kahhhhkk....',
      'kkhhhhhhkk...',
      '.ksksksk.....',
      '.khshshk.....',
      '..khhhkk.....',
      '..kaccak.....',
      '.ksccccsk....',
      '..kkcckk.....',
      '..kk..kk.....',
    ],
  },
  {
    name: 'Призрак',
    hair: '#7581a4',
    skin: '#dce7fa',
    coat: '#a2b5e9',
    accent: '#ffffff',
    pixels: [
      '...kkkk......',
      '..ksssskk....',
      '.kssassssk...',
      '.ksksskssk...',
      '.ksssssssk...',
      'ksssmssssk...',
      'ksssssssssk..',
      '.ksssssssk...',
      '..kskkskk....',
      '..kk..kk.....',
    ],
  },
  {
    name: 'Робот',
    hair: '#879bac',
    skin: '#aec1d3',
    coat: '#526d87',
    accent: '#a3ef8f',
    pixels: [
      '.....k.......',
      '....kak......',
      '.....k.......',
      '..kkkkkkk....',
      '.khhhhhhhk...',
      '.khakakahk...',
      '.khhhhhhhk...',
      '..kkkkkkk....',
      '..kccacck....',
      '.khccacchk...',
      '..kccccck....',
      '..kk...kk....',
    ],
  },
  {
    name: 'Ящер',
    hair: '#558659',
    skin: '#a8ba6c',
    coat: '#744e47',
    accent: '#ffcf7d',
    pixels: [
      '.....kk......',
      '...kkhhkk....',
      '..khhkhhhk...',
      '..khhhhask...',
      '..khsskkk....',
      '...khsk..k...',
      '..kchsk.khkk.',
      '.khccskkhhk..',
      '..kchhhhhk...',
      '...khhkkk....',
      '...kk.kk.....',
    ],
  },
  {
    name: 'Совёнок',
    hair: '#855343',
    skin: '#e6c793',
    coat: '#5e3f4c',
    accent: '#f7a952',
    pixels: [
      '..kk....kk...',
      '..khk..khk...',
      '..khkkkkhk...',
      '.khhhhhhhhk..',
      '.khskhkskhk..',
      '.khssassshk..',
      '.khsssssshk..',
      '.khshshshhk..',
      '..khhhhhkk...',
      '...kakak.....',
      '...kk.kk.....',
    ],
  },
  {
    name: 'Енот',
    hair: '#7d8192',
    skin: '#dad5c8',
    coat: '#53546b',
    accent: '#a5a7b7',
    pixels: [
      '..kk...kk....',
      '.khsk.kshk...',
      '.khhkkkhhk...',
      '.khhshhhhk...',
      '.kkkkskkkk...',
      '.khksskshk...',
      '..ksskssk....',
      '...khhkk...k.',
      '..khsshhkkak.',
      '..khsshahahk.',
      '...khhkkkk...',
      '...kk.kk.....',
    ],
  },
  {
    name: 'Кролик',
    hair: '#9d718c',
    skin: '#f0d2ca',
    coat: '#825e7d',
    accent: '#ed9cb1',
    pixels: [
      '...kk.kk.....',
      '..khk.khkk...',
      '..kak.kahk...',
      '..khkkkhhk...',
      '.khhhhhhhhk..',
      '.khkshkshhk..',
      '.khssassshk..',
      '..kkssskk....',
      '..khsshhk.kk.',
      '..khsshhkksk.',
      '...khhhhkk...',
      '...kk.kk.....',
    ],
  },
  {
    name: 'Дракон',
    hair: '#517d6a',
    skin: '#abca91',
    coat: '#66518a',
    accent: '#eeb56a',
    pixels: [
      '...k...k.....',
      '..kak.kak....',
      '..khkkkhk....',
      '..khhkhhkk...',
      '..khhhhahk...',
      '...kssskk....',
      '.kkkhhsk...k.',
      'kakchhsk..khk',
      '.kkchhskkhhak',
      '..khhhhhhkkk.',
      '...khhkkk....',
      '...kk.kk.....',
    ],
  },
] as const;
type AvatarId = (typeof avatars)[number]['name'];
const isAvatar = (value: unknown): value is AvatarId => avatars.some(({ name }) => name === value);
const key = 'quaeso:demo-avatar';

export function useProfileAvatar(demo: boolean, enabled: boolean) {
  const [avatar, setAvatar] = useState<AvatarId>(avatars[0].name);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      try {
        const value: unknown = demo
          ? await AsyncStorage.getItem(key)
          : (await getSupabase().auth.getSession()).data.session?.user.user_metadata.avatar_sprite;
        if (active && isAvatar(value)) setAvatar(value);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [demo, enabled]);

  const select = (next: AvatarId) => {
    if (!ready || next === avatar) return;
    setAvatar(next);
    setError(false);
    queue.current = queue.current
      .then(async () => {
        if (demo) await AsyncStorage.setItem(key, next);
        else {
          const { error: failure } = await getSupabase().auth.updateUser({
            data: { avatar_sprite: next },
          });
          if (failure) throw failure;
        }
      })
      .catch(() => setError(true));
  };
  return { avatar, select, error };
}

export function AvatarSprite({
  avatar,
  size = 64,
  bare = false,
  pixelSize,
}: {
  avatar: AvatarId;
  size?: number;
  bare?: boolean;
  pixelSize?: number;
}) {
  const colors = useThemeColors();
  const sprite = avatars.find(({ name }) => name === avatar) ?? avatars[0];
  const palette: Record<string, string> = {
    h: sprite.hair,
    s: sprite.skin,
    c: sprite.coat,
    k: '#171822',
    m: '#804D4D',
    a: sprite.accent,
  };
  const pixel = pixelSize ?? Math.max(1, Math.floor(size / 27));
  const columns = Math.max(12, ...sprite.pixels.map((row) => row.length));
  return (
    <View
      accessible={false}
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: bare ? 'transparent' : colors.border,
          backgroundColor: bare ? 'transparent' : colors.mintMuted,
        },
      ]}
    >
      <View style={{ width: pixel * columns, height: pixel * 14, justifyContent: 'center' }}>
        {sprite.pixels.map((row, y) =>
          Array.from(row, (value, x) =>
            palette[value] ? (
              <View
                key={y * columns + x}
                style={{
                  position: 'absolute',
                  left: x * pixel,
                  top: (y + 14 - sprite.pixels.length) * pixel,
                  width: pixel,
                  height: pixel,
                  backgroundColor: palette[value],
                }}
              />
            ) : null,
          ),
        )}
      </View>
    </View>
  );
}

const wrap = (index: number) => ((index % avatars.length) + avatars.length) % avatars.length;

export function useAvatarDimensions() {
  const { height, width } = useWindowDimensions();
  const carouselHeight = Math.round(height * 0.28);
  const viewportHeight = Math.max(68, carouselHeight - 49);
  const spriteSize = Math.min(viewportHeight - 8, Math.round(Math.min(width, 400) * 0.34));
  return { viewportHeight, spriteSize };
}

export function AvatarPicker({ avatar, select, error }: ReturnType<typeof useProfileAvatar>) {
  const colors = useThemeColors();
  const { viewportHeight, spriteSize } = useAvatarDimensions();
  const spacing = Math.round(spriteSize * 0.76);
  const ringSize = spriteSize + 4;
  const index = avatars.findIndex(({ name }) => name === avatar);
  const [offset] = useState(() => new Animated.Value(0));
  const [reduced, setReduced] = useState(true);
  const motion = useRef({
    offset: 0,
    moving: false,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });
  const stop = () => {
    clearTimeout(motion.current.timer);
    offset.stopAnimation();
    motion.current.moving = false;
  };
  useLayoutEffect(() => {
    motion.current.offset = 0;
    offset.setValue(0);
  }, [avatar, offset]);
  useEffect(() => {
    let active = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduced(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const drag = (value: number) => {
    motion.current.offset = Math.max(-spacing * 2, Math.min(spacing * 2, value));
    if (!reduced) offset.setValue(motion.current.offset);
  };
  const settle = (steps: number) => {
    stop();
    const commit = () => {
      motion.current.offset = 0;
      if (steps) {
        const next = avatars[wrap(index + steps)]!;
        select(next.name);
      } else offset.setValue(0);
    };
    if (reduced) {
      commit();
      return;
    }
    motion.current.moving = true;
    Animated.spring(offset, {
      toValue: -steps * spacing,
      damping: 22,
      stiffness: 230,
      mass: 0.75,
      overshootClamping: true,
      useNativeDriver: false,
    }).start(({ finished }) => {
      motion.current.moving = false;
      if (finished) commit();
    });
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        (event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)))
      )
        return;
      const steps =
        event.key === 'ArrowLeft' || event.code === 'KeyA'
          ? -1
          : event.key === 'ArrowRight' || event.code === 'KeyD'
            ? 1
            : 0;
      if (steps) {
        event.preventDefault();
        if (!motion.current.moving) settle(steps);
      }
    };
    const wheel = (event: WheelEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest('[data-testid="avatar-picker"]') ||
        Math.abs(event.deltaX) <= Math.abs(event.deltaY)
      )
        return;
      event.preventDefault();
      if (motion.current.moving) stop();
      drag(motion.current.offset - event.deltaX);
      clearTimeout(motion.current.timer);
      motion.current.timer = setTimeout(
        () => settle(-Math.round(motion.current.offset / spacing)),
        120,
      );
    };
    window.addEventListener('keydown', keyboard);
    window.addEventListener('wheel', wheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', keyboard);
      window.removeEventListener('wheel', wheel);
    };
  });
  useEffect(() => {
    const state = motion.current;
    return () => {
      clearTimeout(state.timer);
      offset.stopAnimation();
    };
  }, [offset]);

  // PanResponder reads motion state only when handling a gesture.
  // eslint-disable-next-line react-hooks/refs
  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy),
    onPanResponderGrant: stop,
    onPanResponderMove: (_, { dx }) => drag(dx),
    onPanResponderRelease: (_, { dx }) =>
      settle(
        Math.abs(dx) < 24 ? 0 : -Math.sign(dx) * Math.max(1, Math.round(Math.abs(dx) / spacing)),
      ),
    onPanResponderTerminate: () => settle(0),
  });
  return (
    <View testID="avatar-picker" style={styles.picker}>
      <View
        style={[
          styles.viewport,
          { height: viewportHeight },
          Platform.OS === 'web' && webGestureStyle,
        ]}
        {...pan.panHandlers}
      >
        <View
          pointerEvents="none"
          style={[
            styles.focusRing,
            { width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
            { borderColor: colors.secondary, backgroundColor: colors.mintMuted },
          ]}
        />
        {[-3, -2, -1, 0, 1, 2, 3].map((relative) => {
          const sprite = avatars[wrap(index + relative)]!;
          const x = Animated.add(offset, relative * spacing);
          return (
            <Animated.View
              key={sprite.name}
              pointerEvents="none"
              style={[
                styles.slide,
                {
                  opacity: x.interpolate({
                    inputRange: [-spacing * 2, -spacing, 0, spacing, spacing * 2],
                    outputRange: [0.14, 0.55, 1, 0.55, 0.14],
                    extrapolate: 'clamp',
                  }),
                  transform: [
                    { translateX: x },
                    {
                      scale: x.interpolate({
                        inputRange: [-spacing, 0, spacing],
                        outputRange: [0.69, 1, 0.69],
                        extrapolate: 'clamp',
                      }),
                    },
                  ],
                },
              ]}
            >
              <AvatarSprite avatar={sprite.name} size={spriteSize} bare />
            </Animated.View>
          );
        })}
      </View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Предыдущий аватар"
          style={styles.arrow}
          onPress={() => {
            if (!motion.current.moving) settle(-1);
          }}
        >
          <Text style={{ color: colors.secondary, fontSize: 27 }}>‹</Text>
        </Pressable>
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.textPrimary, minWidth: 90, textAlign: 'center' }}
        >
          {avatar}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Следующий аватар"
          style={styles.arrow}
          onPress={() => {
            if (!motion.current.moving) settle(1);
          }}
        >
          <Text style={{ color: colors.secondary, fontSize: 27 }}>›</Text>
        </Pressable>
      </View>
      {error && (
        <Text accessibilityRole="alert" style={{ color: colors.error }}>
          Не удалось сохранить аватар.
        </Text>
      )}
    </View>
  );
}

const webGestureStyle = { overflow: 'hidden' as const, touchAction: 'pan-y' };
const styles = StyleSheet.create({
  viewport: {
    width: '100%',

    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusRing: { position: 'absolute', borderWidth: 1 },
  slide: { position: 'absolute' },
  picker: { width: '100%', alignItems: 'center', gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  circle: { borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  arrow: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
});
