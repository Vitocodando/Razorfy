import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
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
  Screen,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { money, shortDateTime } from '../format';
import { api } from '../services/api';
import { colors, fonts } from '../theme';
import type { Wallet } from '../types';

export function WalletScreen() {
  const { session } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!session) return;
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      setWallet(await api.wallet(session.accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar a carteira.');
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
        eyebrow="FIDELIDADE"
        title="Minha carteira"
        description="Seu cuidado volta para você em forma de crédito."
      />
      <ErrorMessage message={error} />

      <LinearGradient
        colors={[colors.blueDark, colors.blue, '#3949ab']}
        style={styles.balanceCard}
      >
        <View style={styles.balanceTop}>
          <View>
            <Text style={styles.balanceLabel}>SALDO DISPONÍVEL</Text>
            <Text style={styles.balanceValue}>
              {money.format(wallet?.availableBalance ?? 0)}
            </Text>
          </View>
          <View style={styles.walletMark}>
            <Ionicons name="wallet" size={26} color={colors.white} />
          </View>
        </View>
        <Text style={styles.balanceHint}>
          Use no próximo agendamento, parcial ou integralmente.
        </Text>
        {(wallet?.reservedBalance ?? 0) > 0 ? (
          <View style={styles.reservedRow}>
            <Ionicons name="time-outline" size={15} color="#d7daf5" />
            <Text style={styles.reservedText}>
              {money.format(wallet?.reservedBalance ?? 0)} reservado em pagamento
            </Text>
          </View>
        ) : null}
      </LinearGradient>

      <Card style={styles.ruleCard}>
        <View style={styles.ruleIcon}>
          <Ionicons name="sparkles-outline" size={21} color={colors.red} />
        </View>
        <View style={styles.ruleCopy}>
          <Text style={styles.ruleTitle}>Como o cashback funciona?</Text>
          <Text style={styles.ruleText}>
            O crédito é liberado quando o atendimento é concluído e considera
            apenas o valor efetivamente pago.
          </Text>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Extrato</Text>
      {!wallet?.transactions.length ? (
        <EmptyState
          icon="receipt-outline"
          title="Nenhuma movimentação"
          description="Cashbacks ganhos e utilizados aparecerão neste extrato."
        />
      ) : (
        <View style={styles.transactions}>
          {wallet.transactions.map((transaction, index) => {
            const debit = transaction.type === 'DEBIT';
            return (
              <View
                style={styles.transaction}
                key={`${transaction.createdAt}-${index}`}
              >
                <View
                  style={[
                    styles.transactionIcon,
                    debit && styles.transactionIconDebit,
                  ]}
                >
                  <Ionicons
                    name={debit ? 'arrow-up' : 'arrow-down'}
                    size={18}
                    color={debit ? colors.red : colors.success}
                  />
                </View>
                <View style={styles.transactionCopy}>
                  <Text style={styles.transactionTitle}>
                    {transaction.description}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {shortDateTime.format(new Date(transaction.createdAt))}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.transactionAmount,
                    debit && styles.transactionAmountDebit,
                  ]}
                >
                  {debit ? '- ' : '+ '}
                  {money.format(transaction.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    borderRadius: 25,
    padding: 21,
    marginBottom: 14,
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  balanceLabel: {
    color: '#c5cae9',
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.3,
  },
  balanceValue: {
    color: colors.white,
    fontFamily: fonts.extraBold,
    fontSize: 31,
    marginTop: 7,
  },
  walletMark: {
    width: 51,
    height: 51,
    borderRadius: 18,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceHint: {
    color: '#e8eaf6',
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 13,
  },
  reservedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.16)',
    marginTop: 13,
  },
  reservedText: {
    color: '#d7daf5',
    fontFamily: fonts.medium,
    fontSize: 9,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 27,
  },
  ruleIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleCopy: {
    flex: 1,
    marginLeft: 12,
  },
  ruleTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  ruleText: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 17,
    marginBottom: 12,
  },
  transactions: {
    borderRadius: 21,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 15,
  },
  transaction: {
    minHeight: 77,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#e5f5eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionIconDebit: {
    backgroundColor: colors.redSoft,
  },
  transactionCopy: {
    flex: 1,
    marginLeft: 11,
  },
  transactionTitle: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 10,
  },
  transactionDate: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 8,
    marginTop: 4,
  },
  transactionAmount: {
    color: colors.success,
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  transactionAmountDebit: {
    color: colors.red,
  },
});
