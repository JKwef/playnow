import { View } from 'react-native';

// Отдельные пиксельные слои героя из фирменного знака: плащ, волосы, лицо и сапоги.
const HERO = [
  [12, 0, 22, 4, '#604713'],
  [8, 4, 30, 5, '#51380C'],
  [8, 9, 10, 15, '#51380C'],
  [18, 9, 16, 5, '#FFF4D4'],
  [14, 14, 24, 14, '#FFF4D4'],
  [23, 17, 3, 4, '#111912'],
  [33, 17, 3, 4, '#111912'],
  [8, 26, 8, 9, '#AD1745'],
  [4, 35, 12, 7, '#AD1745'],
  [0, 42, 16, 8, '#AD1745'],
  [16, 28, 22, 5, '#AD1745'],
  [16, 33, 22, 17, '#B9B9B6'],
  [16, 31, 4, 10, '#595B58'],
  [34, 33, 4, 8, '#595B58'],
  [18, 50, 5, 9, '#595B58'],
  [31, 50, 5, 9, '#595B58'],
] as const;

export function PixelHero() {
  return (
    <View style={{ width: 40, height: 60 }}>
      {HERO.map(([left, top, width, height, backgroundColor], index) => (
        <View
          key={index}
          style={{ position: 'absolute', left, top, width, height, backgroundColor }}
        />
      ))}
    </View>
  );
}

const CURSOR = [
  '10000000000',
  '11000000000',
  '12100000000',
  '12210000000',
  '12221000000',
  '12222100000',
  '12222210000',
  '12222221000',
  '12222222100',
  '12222222210',
  '12222211111',
  '12212210000',
  '12101221000',
  '11001221000',
  '10000122100',
  '00000122100',
  '00000011000',
];

// Классический курсор нарисован пикселями, поэтому одинаково выглядит на iOS/Android/web.
export function PixelCursor() {
  return (
    <View style={{ width: 22, height: 34 }}>
      {CURSOR.flatMap((row, y) =>
        Array.from(row, (pixel, x) =>
          pixel === '0' ? null : (
            <View
              key={`${x}:${y}`}
              style={{
                position: 'absolute',
                left: x * 2,
                top: y * 2,
                width: 2,
                height: 2,
                backgroundColor: pixel === '1' ? '#07110B' : '#FFFFFF',
              }}
            />
          ),
        ),
      )}
    </View>
  );
}
