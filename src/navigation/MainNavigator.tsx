import { useDesktopHeader } from '@/shared/hooks/useDesktopHeader';
import { DemoMenu } from '@/features/demo/screens/DemoMenu';
import { useNavigation } from '@react-navigation/native';
import { AppText as Text } from '@/shared/components/AppText';
import { BrandBar } from '@/shared/components/BrandBar';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PickerScreen } from '@/features/picker/screens/PickerScreen';
import { BacklogScreen } from '@/features/backlog/screens/BacklogScreen';
import { SettingsScreen } from '@/features/settings/screens/SettingsScreen';
import { useThemeColors } from '@/shared/theme/useTheme';
import type { MainTabParamList } from '@/navigation/types';

const Tabs = createBottomTabNavigator<MainTabParamList>();
const labels = { Picker: 'Подбор', Backlog: 'Библиотека', Settings: 'Настройки' };

function NavigationBar({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{ backgroundColor: colors.background }}
    >
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: colors.border }}>
        {state.routes.map((route, index) => {
          const selected = state.index === index;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              aria-selected={selected}
              accessibilityState={{ selected }}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{ flex: 1, minHeight: 52, padding: 8, justifyContent: 'center' }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  textAlign: 'center',
                  fontWeight: selected ? '800' : '400',
                  fontSize: 13,
                }}
              >
                {selected ? '• ' : ''}
                {labels[route.name as keyof MainTabParamList]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export function MainNavigator() {
  const desktopHeader = useDesktopHeader();
  const navigation = useNavigation();
  const colors = useThemeColors();
  return (
    <Tabs.Navigator
      tabBar={(props) => <NavigationBar {...props} />}
      screenOptions={{
        header: () => (
          <BrandBar
            controls={
              desktopHeader && (
                <DemoMenu
                  onBrandPaper
                  onOpenFriend={(friendId) => navigation.navigate('DemoFriend', { friendId })}
                  onSettings={() => navigation.navigate('AccountSettings')}
                  onFavorites={() => navigation.navigate('Favorites')}
                  onAcceptInvitation={(sessionId) => navigation.navigate('Demo', { sessionId })}
                />
              )
            }
          />
        ),
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="Picker" component={PickerScreen} options={{ title: 'Подбор' }} />
      <Tabs.Screen name="Backlog" component={BacklogScreen} options={{ title: 'Библиотека' }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
    </Tabs.Navigator>
  );
}
