import { Image, StyleSheet, View } from 'react-native';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <View style={styles.compact} accessibilityLabel="Razorfy">
        <Image
          source={require('../../assets/razorfy.png')}
          style={styles.compactImage}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View style={styles.full} accessibilityLabel="Razorfy">
      <Image
        source={require('../../assets/razorfy.png')}
        style={styles.fullImage}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    width: 220,
    height: 175,
    borderRadius: 22,
    overflow: 'hidden',
  },
  fullImage: {
    position: 'absolute',
    width: 220,
    height: 220,
    top: -35,
  },
  compact: {
    width: 45,
    height: 50,
    overflow: 'hidden',
  },
  compactImage: {
    position: 'absolute',
    width: 145,
    height: 145,
    top: -33,
    left: -50,
  },
});
