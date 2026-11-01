import { registerRootComponent } from 'expo';

import App from '@/App';

// registerRootComponent вызывает AppRegistry.registerComponent('main', () => App)
// и корректно настраивает окружение и в Expo Go, и в нативной сборке.
registerRootComponent(App);
