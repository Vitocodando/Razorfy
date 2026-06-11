export const colors = {
  red: '#e53935',
  redDark: '#c62828',
  redSoft: '#ffebee',
  blue: '#283593',
  blueDark: '#1a237e',
  blueSoft: '#e8eaf6',
  cream: '#f6f5ea',
  paper: '#fffef8',
  ink: '#171717',
  muted: '#6c6b65',
  line: '#deddd3',
  white: '#ffffff',
  success: '#198754',
  warning: '#b26a00',
} as const;

export const fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extraBold: 'Montserrat_800ExtraBold',
} as const;

export const shadow = {
  shadowColor: '#1a237e',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 3,
} as const;
