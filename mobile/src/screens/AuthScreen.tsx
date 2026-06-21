import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandLogo } from '../components/BrandLogo';
import { ErrorMessage, PrimaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../theme';

type Mode = 'login' | 'register';

export function AuthScreen() {
  const { login, verify2fa, register, tenant, clearTenant } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preAuth, setPreAuth] = useState<string | null>(null); // FA01: 2FA pendente
  const [code, setCode] = useState('');

  async function submit() {
    setError('');
    if (mode === 'register' && name.trim().length < 3) {
      setError('Informe seu nome completo.');
      return;
    }
    if (!email.includes('@')) {
      setError('Informe um e-mail válido.');
      return;
    }
    if (mode === 'register' && !/^\+?[1-9]\d{1,14}$/.test(phone.trim())) {
      setError('Informe o WhatsApp no formato internacional, como +5511999999999.');
      return;
    }
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const r = await login(email, password);
        if (r.require2fa && r.preAuthToken) { setPreAuth(r.preAuthToken); setCode(''); }
      } else {
        await register(name, email, phone, password);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível autenticar.');
    } finally {
      setLoading(false);
    }
  }

  async function submitCode() {
    if (!preAuth || code.length !== 6) return;
    setError(''); setLoading(true);
    try {
      await verify2fa(preAuth, code);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Código inválido.');
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError('');
  }

  // FA01: tela de verificação 2FA após credenciais válidas.
  if (preAuth) {
    return (
      <LinearGradient colors={[colors.blueDark, colors.blue, '#3949ab']} style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <View style={styles.formCard}>
                <Ionicons name="shield-checkmark-outline" size={40} color={colors.blue} style={{ alignSelf: 'center' }} />
                <Text style={[styles.formTitle, { textAlign: 'center', marginTop: 8 }]}>Verificação em duas etapas</Text>
                <Text style={[styles.formSubtitle, { textAlign: 'center' }]}>Digite o código de 6 dígitos do seu app autenticador.</Text>
                <ErrorMessage message={error} />
                <TextInput
                  autoFocus
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor={colors.muted}
                  maxLength={6}
                  style={styles.codeInput}
                />
                <PrimaryButton label={loading ? 'Verificando...' : 'Verificar'} onPress={submitCode} disabled={loading || code.length !== 6} />
                <Pressable onPress={() => { setPreAuth(null); setCode(''); setError(''); }} style={{ marginTop: 12, alignSelf: 'center' }}>
                  <Text style={styles.tenantChipChange}>Voltar ao login</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.blueDark, colors.blue, '#3949ab']}
      style={styles.background}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <BrandLogo />
              <Text style={styles.heroEyebrow}>BARBEARIA INTELIGENTE</Text>
              <Text style={styles.heroTitle}>Seu estilo,{'\n'}no seu tempo.</Text>
              <Text style={styles.heroText}>
                Serviços, horários e cashback na palma da sua mão.
              </Text>
              {tenant ? (
                <Pressable style={styles.tenantChip} onPress={() => void clearTenant()}>
                  <Ionicons name="storefront-outline" size={15} color={colors.red} />
                  <Text style={styles.tenantChipText}>{tenant.name}</Text>
                  <Text style={styles.tenantChipChange}>· trocar</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.formCard}>
              <View style={styles.modeTabs}>
                <Pressable
                  style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}
                  onPress={() => changeMode('login')}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      mode === 'login' && styles.modeTabTextActive,
                    ]}
                  >
                    Entrar
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modeTab, mode === 'register' && styles.modeTabActive]}
                  onPress={() => changeMode('register')}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      mode === 'register' && styles.modeTabTextActive,
                    ]}
                  >
                    Criar conta
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.formTitle}>
                {mode === 'login' ? 'Bem-vindo de volta' : 'Comece pela Razorfy'}
              </Text>
              <Text style={styles.formSubtitle}>
                {mode === 'login'
                  ? 'Acesse sua agenda e seus benefícios.'
                  : 'Crie sua conta para marcar o próximo horário.'}
              </Text>

              {mode === 'register' ? (
                <Field
                  icon="person-outline"
                  label="Nome completo"
                  placeholder="Como podemos chamar você?"
                  value={name}
                  onChangeText={setName}
                  textContentType="name"
                />
              ) : null}

              <Field
                icon="mail-outline"
                label="E-mail"
                placeholder="voce@email.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
              />

              {mode === 'register' ? (
                <Field
                  icon="logo-whatsapp"
                  label="WhatsApp"
                  placeholder="+5511999999999"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                />
              ) : null}

              <View>
                <Field
                  icon="lock-closed-outline"
                  label="Senha"
                  placeholder="Mínimo de 8 caracteres"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secure}
                  textContentType={mode === 'login' ? 'password' : 'newPassword'}
                />
                <Pressable
                  accessibilityLabel={secure ? 'Mostrar senha' : 'Ocultar senha'}
                  style={styles.passwordToggle}
                  onPress={() => setSecure((current) => !current)}
                >
                  <Ionicons
                    name={secure ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={colors.muted}
                  />
                </Pressable>
              </View>

              <ErrorMessage message={error} />
              <PrimaryButton
                label={mode === 'login' ? 'Entrar na Razorfy' : 'Criar conta e agendar'}
                icon="arrow-forward"
                loading={loading}
                onPress={submit}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Field({
  icon,
  label,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon} size={19} color={colors.blue} />
        <TextInput
          placeholderTextColor="#96958e"
          style={styles.input}
          {...inputProps}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 12,
    paddingBottom: 28,
  },
  tenantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.paper,
  },
  tenantChipText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 12 },
  tenantChipChange: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11 },
  heroEyebrow: {
    color: '#d7daf5',
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 2.1,
    marginTop: 4,
  },
  heroTitle: {
    color: colors.white,
    fontFamily: fonts.extraBold,
    fontSize: 31,
    lineHeight: 35,
    textAlign: 'center',
    marginTop: 12,
  },
  heroText: {
    color: '#e8eaf6',
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  formCard: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 28,
  },
  codeInput: {
    height: 58,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: fonts.extraBold,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    marginVertical: 12,
  },
  modeTabs: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 15,
    backgroundColor: '#eae9df',
    marginBottom: 22,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: colors.paper,
  },
  modeTabText: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  modeTabTextActive: {
    color: colors.blue,
  },
  formTitle: {
    color: colors.ink,
    fontFamily: fonts.extraBold,
    fontSize: 23,
  },
  formSubtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 5,
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 11,
    marginBottom: 7,
  },
  inputWrap: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: 13,
    paddingVertical: 0,
  },
  passwordToggle: {
    position: 'absolute',
    right: 14,
    bottom: 30,
    padding: 5,
  },
});
