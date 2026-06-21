import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AppHeader,
  Card,
  EmptyState,
  ErrorMessage,
  LoadingState,
  PrimaryButton,
  Screen,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { fullDateTime, money } from '../format';
import { api } from '../services/api';
import { colors, fonts } from '../theme';
import type {
  Appointment,
  RootStackParamList,
  ServiceItem,
  Wallet,
} from '../types';

export function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!session) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      const [serviceData, walletData, appointmentData] = await Promise.all([
        api.services(session.user.tenantId),
        api.wallet(session.accessToken),
        api.appointments(session.accessToken),
      ]);
      const upcoming =
        appointmentData
          .filter(
            (item) =>
              ['CONFIRMED', 'PENDING_PAYMENT'].includes(item.status) &&
              new Date(item.startTimestamp).getTime() > Date.now(),
          )
          .sort(
            (a, b) =>
              new Date(a.startTimestamp).getTime() -
              new Date(b.startTimestamp).getTime(),
          )[0] ?? null;

      setServices(serviceData);
      setWallet(walletData);
      setNextAppointment(upcoming);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o início.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading) return <Screen scroll={false}><LoadingState /></Screen>;

  const firstName = session?.user.name.split(' ')[0] ?? '';

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={colors.red}
        />
      }
    >
      <AppHeader
        eyebrow="RAZORFY"
        title={`Olá, ${firstName}`}
        description="Seu próximo cuidado começa por aqui."
        right={
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {session?.user.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
        }
      />

      <ErrorMessage message={error} />

      <View style={styles.heroCard}>
        <View style={styles.heroOrnament}>
          <Ionicons name="cut" size={34} color={colors.white} />
        </View>
        <Text style={styles.heroEyebrow}>NOVO AGENDAMENTO</Text>
        <Text style={styles.heroTitle}>Visual em dia,{'\n'}agenda sem espera.</Text>
        <Text style={styles.heroText}>
          Combine serviços e encontre um horário que comporte tudo.
        </Text>
        <PrimaryButton
          label="Escolher serviços"
          icon="arrow-forward"
          onPress={() => navigation.navigate('Services')}
        />
      </View>

      <View style={styles.balanceRow}>
        <Card style={styles.balanceCard}>
          <View style={styles.smallIcon}>
            <Ionicons name="wallet-outline" size={20} color={colors.blue} />
          </View>
          <Text style={styles.cardLabel}>Cashback disponível</Text>
          <Text style={styles.balanceValue}>
            {money.format(wallet?.availableBalance ?? 0)}
          </Text>
        </Card>
        <Card style={styles.balanceCard}>
          <View style={[styles.smallIcon, styles.smallIconRed]}>
            <Ionicons name="time-outline" size={20} color={colors.red} />
          </View>
          <Text style={styles.cardLabel}>Serviços ativos</Text>
          <Text style={styles.balanceValue}>{services.length}</Text>
        </Card>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Próximo horário</Text>
        <Ionicons name="calendar-outline" size={21} color={colors.blue} />
      </View>

      {nextAppointment ? (
        <Card style={styles.appointmentCard}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateDay}>
              {new Date(nextAppointment.startTimestamp).getDate()}
            </Text>
            <Text style={styles.dateMonth}>
              {new Date(nextAppointment.startTimestamp)
                .toLocaleDateString('pt-BR', { month: 'short' })
                .replace('.', '')
                .toUpperCase()}
            </Text>
          </View>
          <View style={styles.appointmentCopy}>
            <Text style={styles.appointmentServices} numberOfLines={2}>
              {nextAppointment.services.map((item) => item.name).join(' + ')}
            </Text>
            <Text style={styles.appointmentMeta}>
              {nextAppointment.barberName}
            </Text>
            <Text style={styles.appointmentMeta}>
              {fullDateTime.format(new Date(nextAppointment.startTimestamp))}
            </Text>
          </View>
        </Card>
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="Agenda livre"
          description="Quando você marcar um horário, ele aparecerá aqui."
        />
      )}

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Serviços em destaque</Text>
      </View>
      <View style={styles.services}>
        {services.slice(0, 3).map((service) => (
          <View style={styles.serviceRow} key={service.id}>
            <View style={styles.serviceIcon}>
              <Ionicons name="cut-outline" size={20} color={colors.red} />
            </View>
            <View style={styles.serviceCopy}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceDuration}>{service.durationMinutes} min</Text>
            </View>
            <Text style={styles.servicePrice}>{money.format(service.price)}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  heroCard: {
    overflow: 'hidden',
    backgroundColor: colors.blue,
    borderRadius: 26,
    padding: 22,
    marginBottom: 16,
  },
  heroOrnament: {
    position: 'absolute',
    right: -20,
    top: -18,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-12deg' }],
  },
  heroEyebrow: {
    color: '#c5cae9',
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.7,
    marginBottom: 10,
  },
  heroTitle: {
    color: colors.white,
    fontFamily: fonts.extraBold,
    fontSize: 27,
    lineHeight: 31,
    maxWidth: '82%',
  },
  heroText: {
    color: '#e8eaf6',
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    maxWidth: '78%',
    marginTop: 10,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 26,
  },
  balanceCard: {
    flex: 1,
    minHeight: 135,
  },
  smallIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  smallIconRed: {
    backgroundColor: colors.redSoft,
  },
  cardLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 10,
    marginBottom: 5,
  },
  balanceValue: {
    color: colors.ink,
    fontFamily: fonts.extraBold,
    fontSize: 20,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  appointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 26,
  },
  dateBadge: {
    width: 62,
    height: 70,
    borderRadius: 18,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    color: colors.red,
    fontFamily: fonts.extraBold,
    fontSize: 24,
  },
  dateMonth: {
    color: colors.redDark,
    fontFamily: fonts.bold,
    fontSize: 9,
  },
  appointmentCopy: {
    flex: 1,
  },
  appointmentServices: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 5,
  },
  appointmentMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    textTransform: 'capitalize',
  },
  services: {
    gap: 10,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  serviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceCopy: {
    flex: 1,
    marginLeft: 12,
  },
  serviceName: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  serviceDuration: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 3,
  },
  servicePrice: {
    color: colors.blue,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
});
