import { render, within } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { GameCard } from '@/features/backlog/components/GameCard';
import { Screen } from '@/shared/components/Screen';
import { makeGame } from './fixtures/game';

const longName =
  'Очень длинное название игры, которое должно оставаться читаемым при увеличении системного шрифта';
const game = makeGame({ name: longName, genres: ['puzzle', 'adventure'] });
const dimensions = (width: number, height: number, fontScale: number) =>
  jest
    .spyOn(jest.requireActual<typeof ReactNative>('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width, height, fontScale, scale: 1 });
afterEach(() => jest.restoreAllMocks());

test.each([
  [320, 1],
  [390, 2],
])('library cards keep full text at width %s, font scale %s', async (width, fontScale) => {
  dimensions(width, 844, fontScale);
  const card = await render(<GameCard game={game} onPress={jest.fn()} />);
  expect(card.getByText(longName).props.numberOfLines).toBeUndefined();
  expect(card.getByRole('button', { name: new RegExp(longName) })).toBeTruthy();
});

test('ordinary-size cards keep their compact text layout', async () => {
  dimensions(390, 844, 1);
  const card = await render(<GameCard game={game} onPress={jest.fn()} />);
  expect(card.getByText(longName).props.numberOfLines).toBe(2);
});

test.each([
  [844, 390, 1],
  [390, 844, 2],
])(
  'short windows and large fonts scroll the main action with content (%s x %s, %s)',
  async (width, height, fontScale) => {
    dimensions(width, height, fontScale);
    const screen = await render(
      <Screen footer={<ReactNative.Text>Основное действие</ReactNative.Text>}>
        <ReactNative.Text>Содержимое</ReactNative.Text>
      </Screen>,
    );
    const scroll = screen.getByTestId('screen-content-scroll');
    expect(within(scroll).getByText('Основное действие')).toBeTruthy();
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(screen.getAllByText('Основное действие')).toHaveLength(1);
  },
);

test('ordinary phone keeps the main action outside the scroll area', async () => {
  dimensions(390, 844, 1);
  const screen = await render(
    <Screen footer={<ReactNative.Text>Основное действие</ReactNative.Text>}>
      <ReactNative.Text>Содержимое</ReactNative.Text>
    </Screen>,
  );
  expect(
    within(screen.getByTestId('screen-content-scroll')).queryByText('Основное действие'),
  ).toBeNull();
  expect(screen.getByText('Основное действие')).toBeTruthy();
});
