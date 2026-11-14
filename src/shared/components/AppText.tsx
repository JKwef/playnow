import { StyleSheet, Text, type TextProps } from 'react-native';

import { fontFamily } from '@/shared/constants';

export function AppText({ style, accessibilityRole, ...props }: TextProps) {
  const { fontWeight, fontFamily: customFamily } = StyleSheet.flatten(style) ?? {};
  const family =
    accessibilityRole === 'header'
      ? fontFamily.display
      : Number(fontWeight) >= 600 || fontWeight === 'bold'
        ? fontFamily.bold
        : fontFamily.regular;
  return (
    <Text
      {...props}
      accessibilityRole={accessibilityRole}
      style={[style, !customFamily && { fontFamily: family, fontWeight: 'normal' }]}
    />
  );
}
