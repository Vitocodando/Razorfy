import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ErrorMessage,
  LoadingState,
  PrimaryButton,
  Screen,
} from '../components/ui';
import { money } from '../format';
import { api } from '../services/api';
import { colors, fonts, shadow } from '../theme';
import type { RootStackParamList, ServiceItem } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Services'>;

export function ServicesScreen({ navigation }: Props) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .services()
      .then(setServices)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Falha ao carregar serviços.'),
      )
      .finally(() => setLoading(false));
  }, []);

  const chosen = useMemo(
    () => services.filter((service) => selected.includes(service.id)),
    [selected, services],
  );
  const duration = chosen.reduce(
    (total, service) => total + service.durationMinutes,
    0,
  );
  const total = chosen.reduce((sum, service) => sum + Number(service.price), 0);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((serviceId) => serviceId !== id)
        : [...current, id],
    );
  }

  if (loading) {
    return <Screen scroll={false} withTopInset={false}><LoadingState /></Screen>;
  }

  return (
    <Screen withTopInset={false} contentStyle={styles.content}>
      <Text style={styles.eyebrow}>ETAPA 1 DE 3</Text>
      <Text style={styles.title}>Como você quer sair hoje?</Text>
      <Text style={styles.subtitle}>
        Escolha um ou mais serviços. O tempo é somado automaticamente.
      </Text>

      <ErrorMessage message={error} />

      <View style={styles.list}>
        {services.map((service) => {
          const isSelected = selected.includes(service.id);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              key={service.id}
              onPress={() => toggle(service.id)}
              style={({ pressed }) => [
                styles.serviceCard,
                isSelected && styles.serviceCardSelected,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.serviceIcon,
                  isSelected && styles.serviceIconSelected,
                ]}
              >
                <Ionicons
                  name={isSelected ? 'checkmark' : 'cut-outline'}
                  size={22}
                  color={isSelected ? colors.white : colors.red}
                />
              </View>
              <View style={styles.serviceCopy}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDuration}>
                  {service.durationMinutes} minutos
                </Text>
              </View>
              <Text style={styles.servicePrice}>{money.format(service.price)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>
            {selected.length} {selected.length === 1 ? 'serviço' : 'serviços'}
          </Text>
          <Text style={styles.summaryMeta}>{duration} minutos no total</Text>
        </View>
        <Text style={styles.summaryPrice}>{money.format(total)}</Text>
      </View>

      <PrimaryButton
        label="Escolher profissional e horário"
        icon="arrow-forward"
        disabled={!selected.length}
        onPress={() => navigation.navigate('Schedule', { serviceIds: selected })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
  },
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
    marginBottom: 22,
  },
  list: {
    gap: 11,
  },
  serviceCard: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 20,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.line,
    ...shadow,
  },
  serviceCardSelected: {
    borderColor: colors.blue,
    backgroundColor: colors.blueSoft,
  },
  pressed: {
    opacity: 0.85,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIconSelected: {
    backgroundColor: colors.blue,
  },
  serviceCopy: {
    flex: 1,
    marginLeft: 13,
  },
  serviceName: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  serviceDuration: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 11,
    marginTop: 5,
  },
  servicePrice: {
    color: colors.blue,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    marginTop: 8,
  },
  summaryLabel: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  summaryMeta: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 3,
  },
  summaryPrice: {
    color: colors.red,
    fontFamily: fonts.extraBold,
    fontSize: 19,
  },
});
