import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { RootStackParamList } from './src/navigation';
import { CreateHandoffScreen } from './src/screens/CreateHandoffScreen';
import { HandoffDetailScreen } from './src/screens/HandoffDetailScreen';
import { HandoffListScreen } from './src/screens/HandoffListScreen';
import { RelayProvider } from './src/services/relay';
import { colors } from './src/theme/tokens';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.line,
    primary: colors.amber,
    notification: colors.critical,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <RelayProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style="light" />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '600' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="List" component={HandoffListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Detail" component={HandoffDetailScreen} options={{ title: 'Handoff' }} />
            <Stack.Screen
              name="Create"
              component={CreateHandoffScreen}
              options={{ title: 'New handoff', presentation: 'modal' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </RelayProvider>
    </SafeAreaProvider>
  );
}
