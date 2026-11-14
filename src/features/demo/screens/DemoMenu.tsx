import { DemoFriends } from './DemoFriends';
import { fontFamily } from '@/shared/constants';
import { BrandReplay } from '@/shared/components/BrandReplay';
import { AppText as Text } from '@/shared/components/AppText';
import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/shared/components/Button';
import { ThemeSelector } from '@/shared/components/ThemeSelector';
import { AccountAuth } from '@/features/auth/screens/AccountAuth';
import { AccountScreen, useHeaderProfileName } from '@/features/auth/screens/AccountScreen';
import { selectIsAuthenticated, useAuth } from '@/features/auth/hooks/useAuth';
import {
  friendlyInvitation,
  type InvitationEntry,
} from '@/features/demo/services/friendlyInvitations';
import { AvatarPicker, AvatarSprite, useAvatarDimensions, useProfileAvatar } from './AvatarPicker';
import { useThemeColors } from '@/shared/theme/useTheme';

type Panel = 'menu' | 'notifications' | 'profile' | 'settings' | 'about' | 'contact' | 'companions';

export function DemoMenu({
  onBrandPaper = false,
  onFavorites,
  onOpenFriend,
  onJoin,
  onAcceptInvitation,
  onSettings,
}: {
  onBrandPaper?: boolean;
  onFavorites: () => void;
  onOpenFriend?: (friendId: string) => void;
  onJoin?: () => void;
  onAcceptInvitation: (sessionId: string) => void;
  onSettings: () => void;
}) {
  const status = useAuth((state) => state.status);
  const signIn = useAuth((state) => state.signIn);
  const signOut = useAuth((state) => state.signOut);
  const signedIn = status === 'signedIn' || status === 'signedInEmail' || status === 'demoAdmin';
  const profileName = useHeaderProfileName(onBrandPaper && signedIn);
  const avatar = useProfileAvatar(status === 'demoAdmin', signedIn);
  const { spriteSize } = useAvatarDimensions();
  const [avatarHover, setAvatarHover] = useState(false);
  const colors = useThemeColors();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [unread, setUnread] = useState(Boolean(onJoin));
  const [invitation, setInvitation] = useState(Boolean(onJoin));
  const authenticated = useAuth(selectIsAuthenticated);
  const [inbox, setInbox] = useState<InvitationEntry[]>([]);
  const [answering, setAnswering] = useState(false);
  const [inboxError, setInboxError] = useState(false);
  useEffect(() => {
    if (!authenticated || answering) return;
    let alive = true;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const rows = await friendlyInvitation<InvitationEntry>({ action: 'inbox' });
        if (alive) setInbox(rows);
      } catch {
        // Keep the last successful inbox until the next refresh.
      } finally {
        running = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [authenticated, answering, panel]);
  const answer = async (action: 'accept' | 'decline', id: string) => {
    if (answering) return;
    setAnswering(true);
    setInboxError(false);
    try {
      await friendlyInvitation({ action, target: id });
      setInbox((current) => current.filter((item) => item.id !== id));
      if (action === 'accept') {
        setPanel(null);
        onAcceptInvitation(id);
      }
    } catch {
      setInboxError(true);
    } finally {
      setAnswering(false);
    }
  };
  const hasUnread = authenticated ? inbox.length > 0 : unread;
  const [authVisible, setAuthVisible] = useState(false);
  const [addFriendError, setAddFriendError] = useState(false);
  const close = () => {
    setPanel(null);
    setAddFriendError(false);
  };
  const { width } = useWindowDimensions();
  const controlColor = onBrandPaper ? '#14281D' : colors.textPrimary;
  const text = { color: colors.textPrimary };
  const title = { ...text, fontSize: 21, fontWeight: '700' as const };
  const titles = {
    menu: 'Меню',
    notifications: 'Уведомления',
    profile: 'Профиль',
    settings: 'Настройки',
    about: 'О нас',
    contact: 'Связаться с нами',
    companions: 'Компаньоны',
  };

  const headerLinks = (
    items: readonly ('profile' | 'favorites' | 'settings' | 'about' | 'contact' | 'companions')[],
  ) =>
    items.map((item) => (
      <Pressable
        key={item}
        accessibilityRole="button"
        style={[
          styles.headerLink,
          item === 'profile' && profileName ? styles.profileLink : undefined,
        ]}
        accessibilityLabel={
          item === 'profile' && profileName ? 'Профиль · ' + profileName : undefined
        }
        onPress={() => {
          if (item === 'favorites') onFavorites();
          else if (item === 'settings' && signedIn) onSettings();
          else setPanel(item);
        }}
      >
        {item === 'profile' && !!profileName && (
          <AvatarSprite avatar={avatar.avatar} size={48} pixelSize={3} bare />
        )}
        {item === 'profile' && profileName ? (
          <View style={styles.profileText}>
            <Text numberOfLines={1} style={[styles.headerLabel, { color: controlColor }]}>
              {profileName}
            </Text>
            <Text style={{ color: controlColor, fontSize: 11 }}>Профиль</Text>
          </View>
        ) : (
          <Text style={[styles.headerLabel, { color: controlColor }]}>
            {item === 'favorites' ? 'Избранное' : item === 'contact' ? 'На связи' : titles[item]}
          </Text>
        )}
      </Pressable>
    ));
  const utilities = (
    <>
      <ThemeSelector compact onBrandPaper={onBrandPaper} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasUnread ? 'Уведомления, есть новые' : 'Уведомления'}
        style={styles.iconButton}
        onPress={() => {
          setPanel('notifications');
          setUnread(false);
        }}
      >
        <View style={styles.bell}>
          <View style={[styles.bellBody, { borderColor: controlColor }]} />
          <View style={[styles.bellRim, { backgroundColor: controlColor }]} />
          <View style={[styles.bellClapper, { backgroundColor: controlColor }]} />
        </View>
        {hasUnread && (
          <View
            style={[
              styles.dot,
              { backgroundColor: colors.secondary, borderColor: controlColor, borderWidth: 1 },
            ]}
          />
        )}
      </Pressable>
    </>
  );

  return (
    <View style={[styles.controls, onBrandPaper && styles.headerControls]}>
      {authVisible && <AccountAuth onClose={() => setAuthVisible(false)} />}
      {onBrandPaper ? (
        <>
          <View style={styles.headerGroup}>
            {headerLinks(['profile', 'companions', 'favorites'])}
          </View>
          <BrandReplay {...(width < 860 ? { width: 112 } : {})} />
          <View style={styles.headerGroup}>
            {headerLinks(['settings', 'about', 'contact'])}
            {utilities}
          </View>
        </>
      ) : (
        <>
          {utilities}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Открыть меню"
            style={styles.iconButton}
            onPress={() => setPanel('menu')}
          >
            {[0, 1, 2].map((line) => (
              <View key={line} style={[styles.menuLine, { backgroundColor: colors.textPrimary }]} />
            ))}
          </Pressable>
        </>
      )}
      {panel && (
        <Modal transparent animationType="fade" visible onRequestClose={close}>
          <View style={[styles.overlay, onBrandPaper && styles.dialogOverlay]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel={onBrandPaper ? 'Закрыть окно' : 'Закрыть боковую панель'}
              onPress={close}
            />
            <View
              style={[
                styles.drawer,
                onBrandPaper && styles.dialog,
                { backgroundColor: colors.surface },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={onBrandPaper ? 'Закрыть раздел' : 'Скрыть меню'}
                onPress={close}
                style={[
                  styles.collapse,
                  onBrandPaper && styles.dialogClose,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text style={{ color: colors.secondary, fontSize: 24 }}>
                  {onBrandPaper ? '×' : '›'}
                </Text>
              </Pressable>
              <Text accessibilityRole="header" style={title}>
                {titles[panel]}
              </Text>
              {panel === 'menu' ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Редактировать аватар"
                    onHoverIn={() => setAvatarHover(true)}
                    onHoverOut={() => setAvatarHover(false)}
                    onFocus={() => setAvatarHover(true)}
                    onBlur={() => setAvatarHover(false)}
                    onPress={() => {
                      setAvatarHover(false);
                      setPanel('profile');
                    }}
                    style={{ alignSelf: 'center' }}
                  >
                    {signedIn ? (
                      <AvatarSprite avatar={avatar.avatar} size={spriteSize} />
                    ) : (
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: colors.mintMuted, borderColor: colors.border },
                        ]}
                      />
                    )}
                    {(avatarHover || Platform.OS !== 'web') && (
                      <Text
                        style={{
                          position: 'absolute',
                          right: 0,
                          bottom: 0,
                          color: colors.onPrimary,
                          backgroundColor: colors.secondary,
                          borderRadius: 10,
                          paddingHorizontal: 5,
                        }}
                      >
                        ✎
                      </Text>
                    )}
                  </Pressable>
                  {signedIn && (
                    <>
                      <AccountScreen embedded />
                      {status !== 'signedIn' && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            close();
                            void signIn();
                          }}
                          style={{ minHeight: 36, justifyContent: 'center' }}
                        >
                          <Text style={{ color: colors.secondary, fontSize: 13 }}>
                            Войти через Steam
                          </Text>
                        </Pressable>
                      )}
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {status === 'signedIn'
                          ? 'Steam подключён'
                          : status === 'demoAdmin'
                            ? 'Пробный аккаунт'
                            : 'Аккаунт по почте'}
                      </Text>
                    </>
                  )}
                  <Button label="Профиль" variant="secondary" onPress={() => setPanel('profile')} />
                  <Button
                    label="Избранное"
                    variant="secondary"
                    onPress={() => {
                      close();
                      onFavorites();
                    }}
                  />
                  <Button
                    label="Настройки"
                    variant="secondary"
                    onPress={() => {
                      if (signedIn) {
                        close();
                        onSettings();
                      } else setPanel('settings');
                    }}
                  />
                  <View style={styles.spacer} />
                  <View style={{ gap: 0 }}>
                    <Button label="О нас" variant="tertiary" onPress={() => setPanel('about')} />
                    <Button
                      label="Связаться с нами"
                      variant="tertiary"
                      onPress={() => setPanel('contact')}
                    />
                  </View>
                </>
              ) : panel === 'companions' ? (
                <>
                  <Button
                    label="Добавить друга"
                    accessibilityHint="Откроет страницу добавления друзей в Steam"
                    onPress={() => {
                      setAddFriendError(false);
                      void Linking.openURL('https://steamcommunity.com/my/friends/add').catch(() =>
                        setAddFriendError(true),
                      );
                    }}
                  />
                  {addFriendError && (
                    <Text accessibilityRole="alert" style={text}>
                      Не удалось открыть Steam.
                    </Text>
                  )}
                  <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
                    {authenticated ? (
                      <Text style={text}>Список друзей Steam пока недоступен в Quaeso.</Text>
                    ) : (
                      <DemoFriends
                        onOpen={(friendId) => {
                          close();
                          onOpenFriend?.(friendId);
                        }}
                      />
                    )}
                  </ScrollView>
                </>
              ) : panel === 'notifications' ? (
                authenticated ? (
                  <>
                    {inboxError && (
                      <Text accessibilityRole="alert" style={{ color: colors.error }}>
                        Не удалось ответить на приглашение. Попробуй ещё раз.
                      </Text>
                    )}
                    {inbox.length ? (
                      <ScrollView contentContainerStyle={{ gap: 14 }}>
                        {inbox.map(({ id, name }) => (
                          <View key={id} style={{ gap: 6 }}>
                            <Text style={text}>{name} приглашает тебя посвайпать вместе.</Text>
                            <Button
                              label="Присоединиться"
                              disabled={answering}
                              onPress={() => void answer('accept', id)}
                            />
                            <Button
                              label="Отклонить"
                              variant="tertiary"
                              disabled={answering}
                              onPress={() => void answer('decline', id)}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    ) : (
                      <Text style={text}>Новых уведомлений нет.</Text>
                    )}
                  </>
                ) : onJoin ? (
                  <>
                    {invitation && (
                      <>
                        <Text style={text}>
                          Демо · MintKnight приглашает тебя в совместный подбор.
                        </Text>
                        <Button
                          label="Присоединиться"
                          onPress={() => {
                            setInvitation(false);
                            close();
                            onJoin();
                          }}
                        />
                      </>
                    )}
                    <Text style={text}>Демо · PixelFox добавил игры в избранное.</Text>
                    <Text style={text}>Демо · NovaByte закончил дружеский свайп.</Text>
                  </>
                ) : (
                  <Text style={text}>Новых уведомлений нет.</Text>
                )
              ) : panel === 'profile' && signedIn ? (
                <>
                  <AvatarPicker {...avatar} />
                  {onBrandPaper && status !== 'signedIn' && (
                    <Button
                      label="Войти через Steam"
                      variant="secondary"
                      onPress={() => {
                        close();
                        void signIn();
                      }}
                    />
                  )}
                  <AccountScreen embedded />
                  {!onBrandPaper && (
                    <Button
                      label="Назад в меню"
                      variant="tertiary"
                      onPress={() => setPanel('menu')}
                    />
                  )}
                  <Button
                    label="Выйти из аккаунта"
                    variant="tertiary"
                    onPress={() => {
                      close();
                      if (status === 'demoAdmin')
                        useAuth.setState({ status: 'signedOut', user: null, error: null });
                      else void signOut();
                    }}
                  />
                </>
              ) : panel === 'profile' || panel === 'settings' ? (
                <Button
                  label="Войти или зарегистрироваться"
                  onPress={() => {
                    close();
                    setAuthVisible(true);
                  }}
                />
              ) : (
                <>
                  <Text style={text}>
                    {panel === 'about'
                      ? 'Quaeso помогает выбрать игру для себя или компании.'
                      : 'Канал связи пока не настроен.'}
                  </Text>
                  {!onBrandPaper && (
                    <Button
                      label="Назад в меню"
                      variant="tertiary"
                      onPress={() => setPanel('menu')}
                    />
                  )}
                </>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignSelf: 'flex-end' },
  headerControls: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  headerGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    columnGap: 4,
  },
  profileLink: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 124 },
  profileText: { minWidth: 0, flexShrink: 1 },
  headerLabel: { fontFamily: fontFamily.display, fontSize: 15 },
  headerLink: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  dialogOverlay: { alignItems: 'center', justifyContent: 'center' },
  dialog: {
    width: '90%',
    maxWidth: 540,
    height: 'auto',
    maxHeight: '90%',
    borderRadius: 16,
    paddingTop: 20,
  },
  dialogClose: { top: 8, left: undefined, right: 8, zIndex: 1 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', gap: 4 },
  menuLine: { width: 19, height: 2, borderRadius: 1 },
  bell: { alignItems: 'center' },
  bellBody: {
    width: 14,
    height: 14,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  bellRim: { width: 18, height: 2, borderRadius: 1 },
  bellClapper: { width: 4, height: 2, marginTop: 2, borderRadius: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, position: 'absolute', top: 8, right: 8 },
  overlay: { flex: 1, alignItems: 'flex-end', backgroundColor: '#0008' },
  drawer: { width: '85%', maxWidth: 340, height: '100%', padding: 20, paddingTop: 32, gap: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, alignSelf: 'center' },
  spacer: { flex: 1 },
  collapse: {
    position: 'absolute',
    top: 30,
    left: -34,
    width: 34,
    height: 44,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
