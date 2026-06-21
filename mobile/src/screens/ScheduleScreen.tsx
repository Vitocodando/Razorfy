import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ErrorMessage,
  LoadingState,
  PrimaryButton,
  Screen,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { nextDays, toDateKey } from '../format';
import { api } from '../services/api';
import { colors, fonts } from '../theme';
import type {
  Barber,
  RootStackParamList,
  ServiceItem,
} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Schedule'>;

export function ScheduleScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const tenantId = session?.user.tenantId;
  const dates = useMemo(() => nextDays(), []);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barberId, setBarberId] = useState('');
  const [date, setDate] = useState(toDateKey(dates[0]));
  const [times, setTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [error, setError] = useState('');
  const [ratings, setRatings] = useState<Record<string, { average: number; count: number }>>({});

  const duration = services
    .filter((service) => route.params.serviceIds.includes(service.id))
    .reduce((total, service) => total + service.durationMinutes, 0);

  useEffect(() => {
    Promise.all([api.services(tenantId), api.barbers(tenantId)])
      .then(([serviceData, barberData]) => {
        setServices(serviceData);
        setBarbers(barberData);
        setBarberId(barberData[0]?.id ?? '');
        // Notas médias dos barbeiros (públicas) para exibir na seleção.
        void Promise.all(
          barberData.map((barber) =>
            api
              .barberRating(barber.id)
              .then((r) => [barber.id, r] as const)
              .catch(() => null),
          ),
        ).then((entries) => {
          const map: Record<string, { average: number; count: number }> = {};
          for (const entry of entries) if (entry) map[entry[0]] = entry[1];
          setRatings(map);
        });
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Falha ao carregar agenda.'),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!barberId || !duration || !date) return;
    let active = true;
    setLoadingTimes(true);
    setSelectedTime('');
    setError('');

    api
      .availability(barberId, date, duration, tenantId)
      .then((data) => {
        if (active) setTimes(data.availableStarts);
      })
      .catch((cause) => {
        if (active) {
          setTimes([]);
          setError(
            cause instanceof Error ? cause.message : 'Falha ao consultar horários.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingTimes(false);
      });

    return () => {
      active = false;
    };
  }, [barberId, date, duration]);

  if (loading) {
    return <Screen scroll={false} withTopInset={false}><LoadingState /></Screen>;
  }

  const selectedBarber = barbers.find((barber) => barber.id === barberId);

  return (
    <Screen withTopInset={false}>
      <Text style={styles.eyebrow}>ETAPA 2 DE 3</Text>
      <Text style={styles.title}>Encontre seu melhor horário</Text>
      <Text style={styles.subtitle}>
        A agenda considera os {duration} minutos necessários para seus serviços.
      </Text>

      <Text style={styles.sectionTitle}>Profissional</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      >
        {barbers.map((barber) => {
          const selected = barber.id === barberId;
          return (
            <Pressable
              key={barber.id}
              onPress={() => setBarberId(barber.id)}
              style={[styles.barberCard, selected && styles.barberCardSelected]}
            >
              <View style={[styles.barberAvatar, selected && styles.barberAvatarSelected]}>
                <Text
                  style={[
                    styles.barberInitials,
                    selected && styles.barberInitialsSelected,
                  ]}
                >
                  {barber.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.barberName, selected && styles.barberNameSelected]}>
                {barber.name}
              </Text>
              {ratings[barber.id] && ratings[barber.id].count > 0 ? (
                <View style={styles.barberRating}>
                  <Ionicons name="star" size={11} color="#f5b301" />
                  <Text style={styles.barberRatingText}>
                    {ratings[barber.id].average.toFixed(1)} ({ratings[barber.id].count})
                  </Text>
                </View>
              ) : (
                <Text style={styles.barberRole}>Barbeiro</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionTitle}>Data</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      >
        {dates.map((item) => {
          const key = toDateKey(item);
          const selected = key === date;
          return (
            <Pressable
              key={key}
              onPress={() => setDate(key)}
              style={[styles.dayCard, selected && styles.dayCardSelected]}
            >
              <Text style={[styles.dayWeek, selected && styles.dayTextSelected]}>
                {item
                  .toLocaleDateString('pt-BR', { weekday: 'short' })
                  .replace('.', '')
                  .toUpperCase()}
              </Text>
              <Text style={[styles.dayNumber, selected && styles.dayTextSelected]}>
                {item.getDate()}
              </Text>
              <Text style={[styles.dayMonth, selected && styles.dayTextSelected]}>
                {item
                  .toLocaleDateString('pt-BR', { month: 'short' })
                  .replace('.', '')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.timeHeading}>
        <Text style={styles.sectionTitle}>Horários disponíveis</Text>
        <View style={styles.durationPill}>
          <Ionicons name="time-outline" size={14} color={colors.blue} />
          <Text style={styles.durationText}>{duration} min</Text>
        </View>
      </View>

      <ErrorMessage message={error} />
      {loadingTimes ? (
        <View style={styles.timeLoading}>
          <ActivityIndicator color={colors.red} />
          <Text style={styles.loadingText}>Consultando a agenda...</Text>
        </View>
      ) : times.length ? (
        <View style={styles.timeGrid}>
          {times.map((time) => {
            const selected = time === selectedTime;
            return (
              <Pressable
                key={time}
                onPress={() => setSelectedTime(time)}
                style={[styles.timeButton, selected && styles.timeButtonSelected]}
              >
                <Text style={[styles.timeText, selected && styles.timeTextSelected]}>
                  {new Date(time).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.noTimes}>
          <Ionicons name="calendar-clear-outline" size={27} color={colors.muted} />
          <Text style={styles.noTimesText}>
            Nenhum horário comporta esta combinação nessa data.
          </Text>
        </View>
      )}

      <PrimaryButton
        label="Revisar agendamento"
        icon="arrow-forward"
        disabled={!selectedTime || !selectedBarber}
        onPress={() =>
          navigation.navigate('Checkout', {
            serviceIds: route.params.serviceIds,
            barberId,
            barberName: selectedBarber?.name ?? '',
            startTimestamp: selectedTime,
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.red,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.7,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.extraBold,
    fontSize: 27,
    lineHeight: 33,
    marginTop: 8,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 25,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 15,
    marginBottom: 12,
  },
  horizontalList: {
    gap: 10,
    paddingBottom: 24,
  },
  barberCard: {
    width: 112,
    minHeight: 125,
    padding: 13,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    alignItems: 'center',
  },
  barberCardSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.blueSoft,
  },
  barberAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecebe4',
    marginBottom: 10,
  },
  barberAvatarSelected: {
    backgroundColor: colors.blue,
  },
  barberInitials: {
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  barberInitialsSelected: {
    color: colors.white,
  },
  barberName: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'center',
  },
  barberNameSelected: {
    color: colors.blue,
  },
  barberRole: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 9,
    marginTop: 3,
  },
  barberRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  barberRatingText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 9,
  },
  dayCard: {
    width: 68,
    height: 91,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCardSelected: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  dayWeek: {
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 8,
  },
  dayNumber: {
    color: colors.ink,
    fontFamily: fonts.extraBold,
    fontSize: 23,
    marginVertical: 2,
  },
  dayMonth: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 9,
    textTransform: 'capitalize',
  },
  dayTextSelected: {
    color: colors.white,
  },
  timeHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.blueSoft,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  durationText: {
    color: colors.blue,
    fontFamily: fonts.bold,
    fontSize: 9,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 25,
  },
  timeButton: {
    width: '31%',
    minHeight: 47,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButtonSelected: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  timeText: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  timeTextSelected: {
    color: colors.white,
  },
  timeLoading: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  noTimes: {
    minHeight: 130,
    borderRadius: 18,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginBottom: 25,
  },
  noTimesText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 9,
  },
});
