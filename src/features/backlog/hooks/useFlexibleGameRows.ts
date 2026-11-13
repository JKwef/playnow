import { useWindowDimensions } from 'react-native';

/** Card and list must agree whether row heights can be predicted. */
export function useFlexibleGameRows(): boolean {
  const { width, fontScale } = useWindowDimensions();
  return width < 360 || fontScale > 1.2;
}
