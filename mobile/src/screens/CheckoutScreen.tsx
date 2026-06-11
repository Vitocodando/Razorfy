import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Card,
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
  RootStackParamList,
  ServiceItem,
  Wallet,
} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;
type PaymentMethod = 'ONLINE_PIX' | 'PRESENTIAL';

export function CheckoutScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [cashbackInput, setCashbackInput] = useState('0');
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('ONLINE_PIX');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    Promise.all([api.services(), api.wallet(session.accessToken)])
      .then(([serviceData, walletData]) => {
        setServices(serviceData);
        setWallet(walletData);
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Falha ao montar o resumo.'),
      )
      .finally(() => setLoading(false));
  }, [session]);

  const chosen = useMemo(
    () => services.filter((service) => route.params.serviceIds.includes(service.id)),
    [route.params.serviceIds, services],
  );
  const total = chosen.reduce((sum, service) => sum + Number(service.price), 0);
  const duration = chosen.reduce(
    (sum, service) => sum + service.durationMinutes,
    0,
  );
  const requestedCashback = Number(cashbackInput.replace(',', '.')) || 0;
  const maxCashback = Math.min(total, wallet?.availableBalance ?? 0);
  const cashback = Math.min(Math.max(requestedCashback, 0), maxCashback);
  const amountToPay = Math.max(total - cashback, 0);

  async function submit() {
    if (!session) return;
    setSubmitting(true);
    setError('');
    try {
      const appointment = await api.createAppointment(session.accessToken, {
        barberId: route.params.barberId,
        serviceIds: route.params.serviceIds,
        startTimestamp: route.params.startTimestamp,
        useCashback: cashback > 0,
        cashbackAmountToApply: cashback,
        paymentMethod,
      });
      navigation.replace('Success', { appointment });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível criar o agendamento.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Screen scroll={false} withTopInset={false}><LoadingState /></Screen>;
  }

  return (
    <Screen withTopInset={false}>
      <Text style={styles.eyebrow}>ETAPA 3 DE 3</Text>
      <Text style={styles.title}>Tudo certo para confirmar?</Text>
      <Text style={styles.subtitle}>
        Revise os detalhes e escolha como prefere pagar.
      </Text>

      <Card style={styles.scheduleCard}>
        <View style={styles.scheduleIcon}>
          <Ionicons name="calendar" size={22} color={colors.white} />
        </View>
        <View style={styles.scheduleCopy}>
          <Text style={styles.scheduleDate}>
            {fullDateTime.format(new Date(route.params.startTimestamp))}
          </Text>
          <Text style={styles.scheduleBarber}>
            {route.params.barberName} · {duration} minutos
          </Text>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Serviços</Text>
      <Card style={styles.summaryCard}>
        {chosen.map((service) => (
          <View style={styles.summaryRow} key={service.id}>
            <View>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceMeta}>{service.durationMinutes} min</Text>
            </View>
            <Text style={styles.servicePrice}>{money.format(service.price)}</Text>
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{money.format(total)}</Text>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Cashback</Text>
      <Card style={styles.cashbackCard}>
        <View style={styles.cashbackHeader}>
          <View style={styles.walletIcon}>
            <Ionicons name="wallet-outline" size={21} color={colors.blue} />
          </View>
          <View style={styles.cashbackCopy}>
            <Text style={styles.cashbackTitle}>Usar saldo</Text>
            <Text style={styles.cashbackBalance}>
              Disponível: {money.format(wallet?.availableBalance ?? 0)}
            </Text>
          </View>
          <View style={styles.cashbackInputWrap}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={cashbackInput}
              onChangeText={setCashbackInput}
              onBlur={() => setCashbackInput(cashback.toFixed(2).replace('.', ','))}
              selectTextOnFocus
              style={styles.cashbackInput}
            />
          </View>
        </View>
        <Pressable
          onPress={() => setCashbackInput(maxCashback.toFixed(2).replace('.', ','))}
        >
          <Text style={styles.useMaximum}>
            Aplicar máximo de {money.format(maxCashback)}
          </Text>
        </Pressable>
      </Card>

      <Text style={styles.sectionTitle}>Forma de pagamento</Text>
      <View style={styles.paymentList}>
        <PaymentOption
          selected={paymentMethod === 'ONLINE_PIX'}
          icon="qr-code-outline"
          title="PIX online"
          description="Confirmação após a compensação"
          onPress={() => setPaymentMethod('ONLINE_PIX')}
        />
        <PaymentOption
          selected={paymentMethod === 'PRESENTIAL'}
          icon="storefront-outline"
          title="Pagar no balcão"
          description="Pagamento no dia do atendimento"
          onPress={() => setPaymentMethod('PRESENTIAL')}
        />
      </View>

      <Card style={styles.finalTotal}>
        <View>
          <Text style={styles.finalLabel}>Total a pagar</Text>
          {cashback > 0 ? (
            <Text style={styles.discountText}>
              {money.format(cashback)} em cashback aplicado
            </Text>
          ) : null}
        </View>
        <Text style={styles.finalValue}>{money.format(amountToPay)}</Text>
      </Card>

      <ErrorMessage message={error} />
      <PrimaryButton
        label={
          paymentMethod === 'ONLINE_PIX'
            ? 'Reservar e gerar PIX'
            : 'Confirmar agendamento'
        }
        icon="checkmark"
        loading={submitting}
        onPress={submit}
      />
      {paymentMethod === 'ONLINE_PIX' ? (
        <Text style={styles.holdNote}>
          O horário ficará protegido por 10 minutos enquanto o PIX é pago.
        </Text>
      ) : null}
    </Screen>
  );
}

function PaymentOption({
  selected,
  icon,
  title,
  description,
  onPress,
}: {
  selected: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.paymentOption, selected && styles.paymentOptionSelected]}
    >
      <View style={[styles.paymentIcon, selected && styles.paymentIconSelected]}>
        <Ionicons
          name={icon}
          size={22}
          color={selected ? colors.white : colors.blue}
        />
      </View>
      <View style={styles.paymentCopy}>
        <Text style={styles.paymentTitle}>{title}</Text>
        <Text style={styles.paymentDescription}>{description}</Text>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={21}
        color={selected ? colors.red : colors.line}
      />
    </Pressable>
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
    marginBottom: 21,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  scheduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleCopy: {
    flex: 1,
    marginLeft: 13,
  },
  scheduleDate: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 18,
    textTransform: 'capitalize',
  },
  scheduleBarber: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 15,
    marginBottom: 11,
  },
  summaryCard: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 7,
  },
  serviceName: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  serviceMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 9,
    marginTop: 3,
  },
  servicePrice: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
    marginVertical: 8,
  },
  totalLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  totalValue: {
    color: colors.blue,
    fontFamily: fonts.extraBold,
    fontSize: 16,
  },
  cashbackCard: {
    marginBottom: 24,
  },
  cashbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashbackCopy: {
    flex: 1,
    marginLeft: 11,
  },
  cashbackTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  cashbackBalance: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 9,
    marginTop: 3,
  },
  cashbackInputWrap: {
    width: 94,
    height: 43,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
  },
  currencyPrefix: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  cashbackInput: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 12,
    textAlign: 'right',
  },
  useMaximum: {
    color: colors.red,
    fontFamily: fonts.semibold,
    fontSize: 10,
    textAlign: 'right',
    marginTop: 11,
  },
  paymentList: {
    gap: 10,
    marginBottom: 24,
  },
  paymentOption: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  paymentOptionSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.blueSoft,
  },
  paymentIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIconSelected: {
    backgroundColor: colors.blue,
  },
  paymentCopy: {
    flex: 1,
    marginLeft: 11,
  },
  paymentTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  paymentDescription: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 9,
    marginTop: 4,
  },
  finalTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  finalLabel: {
    color: '#c5cae9',
    fontFamily: fonts.medium,
    fontSize: 10,
  },
  discountText: {
    color: colors.white,
    fontFamily: fonts.regular,
    fontSize: 8,
    marginTop: 4,
  },
  finalValue: {
    color: colors.white,
    fontFamily: fonts.extraBold,
    fontSize: 23,
  },
  holdNote: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 10,
  },
});
