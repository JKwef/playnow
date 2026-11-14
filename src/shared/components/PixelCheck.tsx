import { View } from 'react-native';

const checkmark = ['0000001', '0000011', '0000110', '1001100', '1111000', '0110000'];

export function PixelCheck({ color }: { color: string }) {
  return (
    <View accessible={false} style={{ width: 14, height: 12 }}>
      {checkmark.flatMap((row, y) =>
        Array.from(row, (pixel, x) =>
          pixel === '1' ? (
            <View
              key={y * 7 + x}
              style={{
                position: 'absolute',
                top: y * 2,
                left: x * 2,
                width: 2,
                height: 2,
                backgroundColor: color,
              }}
            />
          ) : null,
        ),
      )}
    </View>
  );
}
