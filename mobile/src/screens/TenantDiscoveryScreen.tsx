import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ErrorMessage, Screen } from '../components/ui';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors, fonts } from '../theme';

// Extrai código de texto cru ou deep-link (razorfy://connect/X, .../c/X).
function parseConnectionCode(raw: string): string {
  const t = raw.trim();
  const m = t.match(/(?:\/c\/|\/connect\/)([A-Za-z0-9]+)/);
  return (m ? m[1] : t).trim().toUpperCase();
}

// FEAT-074: conexão por código/QR (substitui busca aberta). RN02 case-insensitive (uppercase mask).
export function TenantDiscoveryScreen() {
  const { selectTenant } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  const submit = useCallback(
    async (raw: string) => {
      const c = parseConnectionCode(raw);
      if (!c) {
        setError('Digite o código de conexão.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        await selectTenant(await api.connect(c));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Não foi possível conectar.');
        handled.current = false;
      } finally {
        setLoading(false);
      }
    },
    [selectTenant],
  );

  const openScanner = useCallback(async () => {
    setError('');
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        setError('Permissão de câmera negada. Digite o código manualmente.');
        return;
      }
    }
    handled.current = false;
    setScanning(true);
  }, [permission, requestPermission]);

  if (scanning) {
    return (
      <Screen scroll={false}>
        <View style={styles.scanWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (handled.current) return;
              handled.current = true;
              setScanning(false);
              void submit(data);
            }}
          />
          <View style={styles.scanFrame} pointerEvents="none" />
        </View>
        <Pressable style={styles.secondaryBtn} onPress={() => setScanning(false)}>
          <Ionicons name="keypad-outline" size={18} color={colors.ink} />
          <Text style={styles.secondaryText}>Digitar código</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <BrandLogo />
        <Text style={styles.title}>Conecte-se à barbearia</Text>
        <Text style={styles.subtitle}>
          Informe o código de conexão ou escaneie o QR Code fornecido pela barbearia.
        </Text>
      </View>

      <TextInput
        autoFocus
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        placeholder="EX: BARBA55"
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={10}
        style={styles.codeInput}
      />

      <ErrorMessage message={error} />

      <Pressable
        style={[styles.primaryBtn, (!code || loading) && styles.btnDisabled]}
        disabled={!code || loading}
        onPress={() => void submit(code)}
      >
        {loading ? (
          <ActivityIndicator color={colors.paper} />
        ) : (
          <Text style={styles.primaryText}>Conectar</Text>
        )}
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => void openScanner()}>
        <Ionicons name="qr-code-outline" size={18} color={colors.ink} />
        <Text style={styles.secondaryText}>Escanear QR Code</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 22 },
  title: { fontFamily: fonts.extraBold, fontSize: 22, color: colors.ink, marginTop: 14, textAlign: 'center' },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 6, textAlign: 'center' },
  codeInput: {
    height: 58,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: fonts.extraBold,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 12,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 15,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: colors.paper, fontFamily: fonts.bold, fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 15,
    marginTop: 14,
  },
  secondaryText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 14 },
  scanWrap: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 8,
  },
  scanFrame: {
    position: 'absolute',
    top: '20%',
    left: '12%',
    right: '12%',
    bottom: '20%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
  },
});
