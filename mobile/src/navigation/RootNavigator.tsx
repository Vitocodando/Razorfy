import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { AppointmentListScreen } from '../screens/AppointmentListScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import { ServicesScreen } from '../screens/ServicesScreen';
import { SuccessScreen } from '../screens/SuccessScreen';
import { WalletScreen } from '../screens/WalletScreen';
import { colors, fonts } from '../theme';
import type { RootStackParamList, TabParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const tabIcons: Record<
  keyof TabParamList,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Appointments: { active: 'calendar', inactive: 'calendar-outline' },
  Wallet: { active: 'wallet', inactive: 'wallet-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

const tabLabels: Record<keyof TabParamList, string> = {
  Home: 'Início',
  Appointments: 'Agenda',
  Wallet: 'Carteira',
  Profile: 'Perfil',
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: tabLabels[route.name],
        tabBarLabelStyle: {
          fontFamily: fonts.semibold,
          fontSize: 10,
          marginTop: 2,
        },
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, focused, size }) => (
          <Ionicons
            name={focused ? tabIcons[route.name].active : tabIcons[route.name].inactive}
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Appointments" component={AppointmentListScreen} />
      <Tabs.Screen name="Wallet" component={WalletScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { session, restoring } = useAuth();

  if (restoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.red} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.cream },
        headerTintColor: colors.blue,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 15 },
        contentStyle: { backgroundColor: colors.cream },
      }}
    >
      {!session ? (
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="Services"
            component={ServicesScreen}
            options={{ title: 'Escolha os serviços' }}
          />
          <Stack.Screen
            name="Schedule"
            component={ScheduleScreen}
            options={{ title: 'Profissional e horário' }}
          />
          <Stack.Screen
            name="Checkout"
            component={CheckoutScreen}
            options={{ title: 'Confirmar agendamento' }}
          />
          <Stack.Screen
            name="Success"
            component={SuccessScreen}
            options={{ headerShown: false, gestureEnabled: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  tabBar: {
    height: 72,
    paddingTop: 8,
    paddingBottom: 9,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
});
