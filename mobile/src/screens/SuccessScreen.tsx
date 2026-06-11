import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorMessage, PrimaryButton } from '../components/ui';
import { fullDateTime, money } from '../format';
import { api } from '../services/api';
import { colors, fonts } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

export function SuccessScreen({ navigation, route }: Props) {
  const { appointment } = route.params;
  const [status, setStatus] = useState(appointment.status);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const confirmed = status === 'CONFIRMED';
  const payment = appointment.paymentPayload;
  const hasQrImage = payment?.qrCodeBase64.startsWith('iVBOR') ?? false;

  async function copyPix() {
    if (!payment) return;
    await Clipboard.setStringAsync(payment.copyPasteCode);
    setCopied(true);
  }

  async function simulatePayment() {
    setLoading(true);
    setError('');
    try {
      const result = await api.confirmMockPayment(appointment.appointmentId);
      setStatus(result.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao confirmar o PIX.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusIcon, confirmed && styles.statusIconConfirmed]}>
          <Ionicons
            name={confirmed ? 'checkmark' : 'time-outline'}
            size={40}
            color={colors.white}
          />
        </View>
        <Text style={styles.eyebrow}>
          {confirmed ? 'AGENDAMENTO CONFIRMADO' : 'AGUARDANDO PAGAMENTO'}
        </Text>
        <Text style={styles.title}>
          {confirmed ? 'Seu horário está garantido.' : 'O horário está reservado.'}
        </Text>
        <Text style={styles.subtitle}>
          {confirmed
            ? 'Agora é só chegar e deixar o resto com a Razorfy.'
            : 'Conclua o PIX em até 10 minutos para confirmar.'}
        </Text>

        <View style={styles.details}>
          <Detail
            icon="calendar-outline"
            label="Quando"
            value={fullDateTime.format(new Date(appointment.startTimestamp))}
          />
          <Detail
            icon="person-outline"
            label="Profissional"
            value={appointment.barberName}
          />
          <Detail
            icon="receipt-outline"
            label="Valor"
            value={money.format(appointment.amountToPay)}
          />
        </View>

        {!confirmed && payment ? (
          <View style={styles.pixCard}>
            {hasQrImage ? (
              <Image
                source={{ uri: `data:image/png;base64,${payment.qrCodeBase64}` }}
                style={styles.qrCode}
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={64} color={colors.blue} />
                <Text style={styles.qrPlaceholderText}>PIX gerado</Text>
              </View>
            )}
            <Text style={styles.pixLabel}>PIX COPIA E COLA</Text>
            <Pressable style={styles.copyRow} onPress={copyPix}>
              <Text style={styles.pixCode} numberOfLines={1}>
                {payment.copyPasteCode}
              </Text>
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={21}
                color={copied ? colors.success : colors.red}
              />
            </Pressable>
            {copied ? <Text style={styles.copied}>Código copiado.</Text> : null}
          </View>
        ) : null}

        <ErrorMessage message={error} />
        <View style={styles.actions}>
          {__DEV__ && !confirmed && payment ? (
            <PrimaryButton
              label="Simular PIX aprovado"
              variant="outline"
              loading={loading}
              onPress={simulatePayment}
            />
          ) : null}
          <PrimaryButton
            label={confirmed ? 'Ver minha agenda' : 'Voltar ao início'}
            icon="arrow-forward"
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'MainTabs',
                    params: confirmed ? { screen: 'Appointments' } : { screen: 'Home' },
                  },
                ],
              })
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={19} color={colors.blue} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 22,
    alignItems: 'center',
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  statusIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  statusIconConfirmed: {
    backgroundColor: colors.success,
  },
  eyebrow: {
    color: colors.red,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.7,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.extraBold,
    fontSize: 25,
    lineHeight: 31,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  details: {
    width: '100%',
    borderRadius: 21,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  detailIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCopy: {
    flex: 1,
    marginLeft: 10,
  },
  detailLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 8,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  pixCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 15,
    marginBottom: 14,
  },
  qrCode: {
    width: 116,
    height: 116,
    marginBottom: 12,
  },
  qrPlaceholder: {
    width: 116,
    height: 116,
    borderRadius: 18,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  qrPlaceholderText: {
    color: colors.blue,
    fontFamily: fonts.bold,
    fontSize: 9,
    marginTop: 5,
  },
  pixLabel: {
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.2,
    alignSelf: 'flex-start',
  },
  copyRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 12,
    backgroundColor: colors.cream,
    marginTop: 7,
  },
  pixCode: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: 9,
    marginRight: 8,
  },
  copied: {
    color: colors.success,
    fontFamily: fonts.semibold,
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 5,
  },
});
