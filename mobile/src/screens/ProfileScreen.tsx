import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Card, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { API_URL, api } from '../services/api';
import { colors, fonts } from '../theme';

export function ProfileScreen() {
  const { session, logout, clearTenant } = useAuth();
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

  // FEAT-074 RN04: desconectar barbearia encerra sessão e volta à tela de conexão por código.
  function confirmDisconnect() {
    Alert.alert(
      'Desconectar barbearia?',
      'Você sairá da conta e voltará para a tela de conexão por código.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await logout();
              await clearTenant();
            })();
          },
        },
      ],
    );
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

      <Text style={styles.sectionTitle}>Segurança</Text>
      <TwoFactorSection token={session.accessToken} />

      <Pressable style={styles.disconnectButton} onPress={confirmDisconnect}>
        <Ionicons name="unlink-outline" size={20} color={colors.ink} />
        <Text style={styles.disconnectText}>Desconectar barbearia</Text>
      </Pressable>

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

// FEAT-076: 2FA TOTP no app. Sem QR (chave manual digitada no autenticador).
function TwoFactorSection({ token }: { token: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [secret, setSecret] = useState<string | null>(null); // chave em setup
  const [code, setCode] = useState('');
  const [pwd, setPwd] = useState('');
  const [mode, setMode] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.me(token).then((m) => setEnabled(m.is2faEnabled)).catch(() => setEnabled(false));
  }, [token]);

  const onlyDigits = (t: string) => t.replace(/\D/g, '').slice(0, 6);

  async function startSetup() {
    setBusy(true); setError('');
    try { const s = await api.setup2fa(token); setSecret(s.manualSecretKey); setMode('setup'); }
    catch (c) { setError(c instanceof Error ? c.message : 'Falha ao iniciar 2FA.'); }
    finally { setBusy(false); }
  }
  async function confirmEnable() {
    setBusy(true); setError('');
    try { await api.enable2fa(token, code); setEnabled(true); setMode('idle'); setSecret(null); setCode(''); }
    catch (c) { setError(c instanceof Error ? c.message : 'Código inválido.'); }
    finally { setBusy(false); }
  }
  async function confirmDisable() {
    setBusy(true); setError('');
    try { await api.disable2fa(token, pwd, code); setEnabled(false); setMode('idle'); setPwd(''); setCode(''); }
    catch (c) { setError(c instanceof Error ? c.message : 'Não foi possível desativar.'); }
    finally { setBusy(false); }
  }

  if (enabled === null) return <Card style={styles.infoCard}><ActivityIndicator color={colors.blue} /></Card>;

  return (
    <Card style={styles.twoFaCard}>
      <View style={styles.twoFaHead}>
        <Text style={styles.twoFaTitle}>Verificação em duas etapas</Text>
        <View style={[styles.badge, enabled ? styles.badgeOn : styles.badgeOff]}>
          <Text style={[styles.badgeText, enabled ? styles.badgeTextOn : styles.badgeTextOff]}>{enabled ? 'Ativa' : 'Inativa'}</Text>
        </View>
      </View>
      <Text style={styles.twoFaDesc}>Exige um código do app autenticador (Google Authenticator, Authy) ao entrar.</Text>
      {error ? <Text style={styles.twoFaError}>{error}</Text> : null}

      {!enabled && mode === 'idle' && (
        <Pressable style={styles.twoFaPrimary} onPress={startSetup} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.paper} /> : <Text style={styles.twoFaPrimaryText}>Habilitar 2FA</Text>}
        </Pressable>
      )}

      {!enabled && mode === 'setup' && secret && (
        <View style={{ gap: 8 }}>
          <Text style={styles.twoFaLabel}>1. Adicione esta chave no seu app autenticador:</Text>
          <Text style={styles.secretKey} selectable>{secret}</Text>
          <Text style={styles.twoFaLabel}>2. Digite o código gerado:</Text>
          <TextInput keyboardType="number-pad" value={code} onChangeText={(t) => setCode(onlyDigits(t))} placeholder="000000" placeholderTextColor={colors.muted} maxLength={6} style={styles.codeField} />
          <View style={styles.twoFaRow}>
            <Pressable style={styles.twoFaGhost} onPress={() => { setMode('idle'); setSecret(null); setCode(''); }}><Text style={styles.twoFaGhostText}>Cancelar</Text></Pressable>
            <Pressable style={[styles.twoFaPrimary, styles.flex1, (busy || code.length !== 6) && styles.disabled]} onPress={confirmEnable} disabled={busy || code.length !== 6}><Text style={styles.twoFaPrimaryText}>Ativar</Text></Pressable>
          </View>
        </View>
      )}

      {enabled && mode === 'idle' && (
        <Pressable style={styles.twoFaDanger} onPress={() => { setMode('disable'); setError(''); }}><Text style={styles.twoFaDangerText}>Desativar 2FA</Text></Pressable>
      )}

      {enabled && mode === 'disable' && (
        <View style={{ gap: 8 }}>
          <Text style={styles.twoFaLabel}>Confirme com sua senha e um código atual:</Text>
          <TextInput secureTextEntry value={pwd} onChangeText={setPwd} placeholder="Senha atual" placeholderTextColor={colors.muted} style={styles.codeField} />
          <TextInput keyboardType="number-pad" value={code} onChangeText={(t) => setCode(onlyDigits(t))} placeholder="Código (6 dígitos)" placeholderTextColor={colors.muted} maxLength={6} style={styles.codeField} />
          <View style={styles.twoFaRow}>
            <Pressable style={styles.twoFaGhost} onPress={() => { setMode('idle'); setPwd(''); setCode(''); }}><Text style={styles.twoFaGhostText}>Cancelar</Text></Pressable>
            <Pressable style={[styles.twoFaDanger, styles.flex1, (busy || !pwd || code.length !== 6) && styles.disabled]} onPress={confirmDisable} disabled={busy || !pwd || code.length !== 6}><Text style={styles.twoFaDangerText}>Confirmar</Text></Pressable>
          </View>
        </View>
      )}
    </Card>
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
  twoFaCard: { padding: 16, marginBottom: 24, gap: 10 },
  twoFaHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  twoFaTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
  twoFaDesc: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  twoFaError: { color: colors.red, fontFamily: fonts.semibold, fontSize: 12 },
  twoFaLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeOn: { backgroundColor: 'rgba(16,185,129,0.15)' },
  badgeOff: { backgroundColor: colors.line },
  badgeText: { fontFamily: fonts.bold, fontSize: 10 },
  badgeTextOn: { color: '#059669' },
  badgeTextOff: { color: colors.muted },
  secretKey: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: 2, color: colors.ink, backgroundColor: colors.paper, paddingVertical: 10, borderRadius: 12, textAlign: 'center' },
  codeField: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 14, color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  twoFaRow: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  disabled: { opacity: 0.5 },
  twoFaPrimary: { minHeight: 48, borderRadius: 12, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  twoFaPrimaryText: { color: colors.paper, fontFamily: fonts.bold, fontSize: 13 },
  twoFaGhost: { minHeight: 48, flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  twoFaGhostText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 13 },
  twoFaDanger: { minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  twoFaDangerText: { color: colors.red, fontFamily: fonts.bold, fontSize: 13 },
  disconnectButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    marginBottom: 12,
  },
  disconnectText: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 12,
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
