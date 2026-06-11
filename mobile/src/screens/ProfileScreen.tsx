import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Card, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../services/api';
import { colors, fonts } from '../theme';

export function ProfileScreen() {
  const { session, logout } = useAuth();
  if (!session) return null;

  function confirmLogout() {
    Alert.alert('Sair da Razorfy?', 'Você precisará entrar novamente para acessar sua agenda.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => void logout(),
      },
    ]);
  }

  return (
    <Screen>
      <AppHeader
        eyebrow="SUA CONTA"
        title="Perfil"
        description="Seus dados de acesso e preferências."
      />

      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {session.user.name.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{session.user.name}</Text>
        <Text style={styles.role}>CLIENTE RAZORFY</Text>
      </Card>

      <Text style={styles.sectionTitle}>Dados pessoais</Text>
      <Card style={styles.infoCard}>
        <InfoRow icon="mail-outline" label="E-mail" value={session.user.email} />
        <View style={styles.divider} />
        <InfoRow
          icon="logo-whatsapp"
          label="WhatsApp"
          value={session.user.phone}
        />
      </Card>

      <Text style={styles.sectionTitle}>Aplicativo</Text>
      <Card style={styles.infoCard}>
        <InfoRow
          icon="shield-checkmark-outline"
          label="Sessão"
          value="Protegida no dispositivo"
        />
        {__DEV__ ? (
          <>
            <View style={styles.divider} />
            <InfoRow
              icon="server-outline"
              label="API de desenvolvimento"
              value={API_URL}
            />
          </>
        ) : null}
      </Card>

      <Pressable style={styles.logoutButton} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.red} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </Pressable>

      <Text style={styles.version}>Razorfy Mobile · versão 1.0.0</Text>
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={20} color={colors.blue} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    alignItems: 'center',
    paddingVertical: 26,
    marginBottom: 27,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 27,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: colors.white,
    fontFamily: fonts.extraBold,
    fontSize: 23,
  },
  name: {
    color: colors.ink,
    fontFamily: fonts.extraBold,
    fontSize: 19,
    textAlign: 'center',
  },
  role: {
    color: colors.red,
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.5,
    marginTop: 6,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 15,
    marginBottom: 10,
  },
  infoCard: {
    paddingVertical: 8,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
    marginLeft: 11,
  },
  infoLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 9,
    marginBottom: 3,
  },
  infoValue: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line,
  },
  logoutButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.red,
  },
  logoutText: {
    color: colors.red,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  version: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 8,
    textAlign: 'center',
    marginTop: 18,
  },
});
