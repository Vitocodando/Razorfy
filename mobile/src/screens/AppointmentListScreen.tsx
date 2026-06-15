import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
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
import { money } from '../format';
import { api } from '../services/api';
import { colors, fonts } from '../theme';
import type { Appointment, RootStackParamList } from '../types';

type Filter = 'upcoming' | 'history';

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: 'Aguardando pagamento',
  CONFIRMED: 'Confirmado',
  CONCLUDED: 'Concluído',
  CANCELLED: 'Cancelado',
  CANCELLED_OVERBOOKING: 'Cancelado',
  EXPIRED_PAYMENT: 'PIX expirado',
};

export function AppointmentListScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reviewTarget, setReviewTarget] = useState<Appointment | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);

  function openReview(appointment: Appointment) {
    setReviewTarget(appointment);
    setRating(5);
    setComment('');
    setReviewError('');
  }

  async function submitReview() {
    if (!session || !reviewTarget) return;
    setSubmittingReview(true);
    setReviewError('');
    try {
      await api.createReview(session.accessToken, {
        appointmentId: reviewTarget.appointmentId,
        rating,
        comment: comment.trim() || undefined,
      });
      setReviewedIds((prev) => [...prev, reviewTarget.appointmentId]);
      setReviewTarget(null);
    } catch (cause) {
      setReviewError(
        cause instanceof Error ? cause.message : 'Não foi possível enviar a avaliação.',
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  const load = useCallback(async (refresh = false) => {
    if (!session) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      setAppointments(await api.appointments(session.accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar a agenda.');
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

  const visible = useMemo(() => {
    const upcomingStatuses = ['PENDING_PAYMENT', 'CONFIRMED'];
    return appointments
      .filter((appointment) =>
        filter === 'upcoming'
          ? upcomingStatuses.includes(appointment.status) &&
            new Date(appointment.endTimestamp).getTime() > Date.now()
          : !upcomingStatuses.includes(appointment.status) ||
            new Date(appointment.endTimestamp).getTime() <= Date.now(),
      )
      .sort((a, b) => {
        const difference =
          new Date(a.startTimestamp).getTime() -
          new Date(b.startTimestamp).getTime();
        return filter === 'upcoming' ? difference : -difference;
      });
  }, [appointments, filter]);

  function requestCancellation(appointment: Appointment) {
    const hoursUntil =
      (new Date(appointment.startTimestamp).getTime() - Date.now()) / 3_600_000;
    if (hoursUntil < 2) {
      Alert.alert(
        'Prazo de cancelamento encerrado',
        'Cancelamentos automáticos exigem pelo menos 2 horas de antecedência. Entre em contato com a barbearia.',
      );
      return;
    }

    Alert.alert(
      'Cancelar horário?',
      'O agendamento será cancelado. Pagamentos online seguirão o fluxo de estorno.',
      [
        { text: 'Manter horário', style: 'cancel' },
        {
          text: 'Cancelar',
          style: 'destructive',
          onPress: async () => {
            if (!session) return;
            setError('');
            try {
              await api.cancelAppointment(
                session.accessToken,
                appointment.appointmentId,
              );
              await load(true);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'Não foi possível cancelar o horário.',
              );
            }
          },
        },
      ],
    );
  }

  if (loading) return <Screen scroll={false}><LoadingState /></Screen>;

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
        eyebrow="SUA AGENDA"
        title="Meus horários"
        description="Acompanhe os próximos atendimentos e seu histórico."
      />

      <View style={styles.filters}>
        <FilterButton
          active={filter === 'upcoming'}
          label="Próximos"
          onPress={() => setFilter('upcoming')}
        />
        <FilterButton
          active={filter === 'history'}
          label="Histórico"
          onPress={() => setFilter('history')}
        />
      </View>

      <ErrorMessage message={error} />

      {!visible.length ? (
        <>
          <EmptyState
            icon={filter === 'upcoming' ? 'calendar-outline' : 'time-outline'}
            title={
              filter === 'upcoming'
                ? 'Nenhum horário marcado'
                : 'Histórico ainda vazio'
            }
            description={
              filter === 'upcoming'
                ? 'Escolha seus serviços e encontre um horário disponível.'
                : 'Seus atendimentos concluídos aparecerão aqui.'
            }
          />
          {filter === 'upcoming' ? (
            <View style={styles.emptyAction}>
              <PrimaryButton
                label="Agendar agora"
                icon="add"
                onPress={() => navigation.navigate('Services')}
              />
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.list}>
          {visible.map((appointment) => (
            <AppointmentCard
              key={appointment.appointmentId}
              appointment={appointment}
              onCancel={() => requestCancellation(appointment)}
              reviewed={reviewedIds.includes(appointment.appointmentId)}
              onReview={() => openReview(appointment)}
            />
          ))}
        </View>
      )}

      <Modal
        visible={reviewTarget !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setReviewTarget(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setReviewTarget(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Avaliar atendimento</Text>
            <Text style={styles.modalSubtitle}>
              {reviewTarget?.barberName} ·{' '}
              {reviewTarget?.services.map((s) => s.name).join(' + ')}
            </Text>

            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} onPress={() => setRating(value)} hitSlop={6}>
                  <Ionicons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={value <= rating ? '#f5b301' : colors.muted}
                  />
                </Pressable>
              ))}
            </View>

            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Conte como foi (opcional)"
              placeholderTextColor={colors.muted}
              multiline
              style={styles.commentInput}
            />

            <ErrorMessage message={reviewError} />

            <PrimaryButton
              label={submittingReview ? 'Enviando...' : 'Enviar avaliação'}
              icon="send"
              onPress={() => void submitReview()}
              disabled={submittingReview}
            />
            <Pressable style={styles.modalCancel} onPress={() => setReviewTarget(null)}>
              <Text style={styles.modalCancelText}>Agora não</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function FilterButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterButton, active && styles.filterButtonActive]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function AppointmentCard({
  appointment,
  onCancel,
  reviewed,
  onReview,
}: {
  appointment: Appointment;
  onCancel: () => void;
  reviewed: boolean;
  onReview: () => void;
}) {
  const start = new Date(appointment.startTimestamp);
  const end = new Date(appointment.endTimestamp);
  const canCancel = appointment.status === 'CONFIRMED';
  const pending = appointment.status === 'PENDING_PAYMENT';
  const canReview = appointment.status === 'CONCLUDED' && !reviewed;

  return (
    <Card>
      <View style={styles.cardTop}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateDay}>{start.getDate()}</Text>
          <Text style={styles.dateMonth}>
            {start
              .toLocaleDateString('pt-BR', { month: 'short' })
              .replace('.', '')
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardCopy}>
          <View
            style={[
              styles.status,
              pending && styles.statusPending,
              appointment.status === 'CONCLUDED' && styles.statusConcluded,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                pending && styles.statusTextPending,
                appointment.status === 'CONCLUDED' && styles.statusTextConcluded,
              ]}
            >
              {statusLabels[appointment.status] ?? appointment.status}
            </Text>
          </View>
          <Text style={styles.services} numberOfLines={2}>
            {appointment.services.map((service) => service.name).join(' + ')}
          </Text>
          <Text style={styles.meta}>{appointment.barberName}</Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detail}>
          <Ionicons name="time-outline" size={16} color={colors.blue} />
          <Text style={styles.detailText}>
            {start.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' - '}
            {end.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <Text style={styles.price}>{money.format(appointment.amountToPay)}</Text>
      </View>

      {canCancel ? (
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Ionicons name="close-circle-outline" size={17} color={colors.red} />
          <Text style={styles.cancelText}>Cancelar horário</Text>
        </Pressable>
      ) : null}

      {canReview ? (
        <Pressable style={styles.reviewButton} onPress={onReview}>
          <Ionicons name="star-outline" size={17} color={colors.blue} />
          <Text style={styles.reviewText}>Avaliar atendimento</Text>
        </Pressable>
      ) : null}

      {appointment.status === 'CONCLUDED' && reviewed ? (
        <View style={styles.reviewedRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.reviewedText}>Avaliação enviada</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 15,
    backgroundColor: '#e9e8de',
    marginBottom: 18,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.paper,
  },
  filterText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  filterTextActive: {
    color: colors.blue,
  },
  list: {
    gap: 12,
  },
  emptyAction: {
    marginTop: 14,
  },
  cardTop: {
    flexDirection: 'row',
  },
  dateBlock: {
    width: 60,
    height: 68,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.redSoft,
  },
  dateDay: {
    color: colors.red,
    fontFamily: fonts.extraBold,
    fontSize: 23,
  },
  dateMonth: {
    color: colors.redDark,
    fontFamily: fonts.bold,
    fontSize: 8,
  },
  cardCopy: {
    flex: 1,
    marginLeft: 13,
    alignItems: 'flex-start',
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: colors.blueSoft,
    marginBottom: 7,
  },
  statusPending: {
    backgroundColor: '#fff2cf',
  },
  statusConcluded: {
    backgroundColor: '#e5f5eb',
  },
  statusText: {
    color: colors.blue,
    fontFamily: fonts.bold,
    fontSize: 8,
  },
  statusTextPending: {
    color: colors.warning,
  },
  statusTextConcluded: {
    color: colors.success,
  },
  services: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 4,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 13,
    marginTop: 14,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  price: {
    color: colors.blue,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 14,
  },
  cancelText: {
    color: colors.red,
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 14,
  },
  reviewText: {
    color: colors.blue,
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  reviewedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 14,
  },
  reviewedText: {
    color: colors.success,
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 32,
    gap: 14,
  },
  modalTitle: {
    color: colors.ink,
    fontFamily: fonts.extraBold,
    fontSize: 20,
  },
  modalSubtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: -8,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  commentInput: {
    minHeight: 80,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    padding: 13,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  modalCancelText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
});
