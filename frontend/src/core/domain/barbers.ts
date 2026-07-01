// Imagens ilustrativas de barbeiros por nome (fallback: iniciais/avatar).
const BARBER_IMAGES: { match: string; src: string }[] = [
  { match: 'rafael', src: '/barbers/rafael.png' },
  { match: 'bruno', src: '/barbers/bruno.png' },
]

export function barberImageFor(name?: string): string | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase()
  return BARBER_IMAGES.find((b) => lower.includes(b.match))?.src
}
