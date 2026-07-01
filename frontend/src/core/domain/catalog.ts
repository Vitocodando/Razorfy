import type { ServiceItem } from '../types'

// Categorias do catálogo e heurística de classificação por nome do serviço.
export const CATEGORIES = ['Cabelo', 'Barba', 'Sobrancelha', 'Especiais'] as const
export type Category = (typeof CATEGORIES)[number]

export function categoryOf(service: ServiceItem): Category {
  const name = service.name.toLowerCase()
  if (name.includes('+') || name.includes('premium') || name.includes('combo')) return 'Especiais'
  if (name.includes('sobrancelha')) return 'Sobrancelha'
  if (name.includes('barba')) return 'Barba'
  return 'Cabelo'
}

export const CATEGORY_META: Record<Category, { icon: string; description: string }> = {
  Cabelo: { icon: 'content_cut', description: 'Cortes e acabamentos' },
  Barba: { icon: 'face', description: 'Barba e bigode' },
  Sobrancelha: { icon: 'visibility', description: 'Design de sobrancelha' },
  Especiais: { icon: 'auto_awesome', description: 'Combos e premium' },
}

// Sugestão de cashback: paga serviços completos em ordem crescente de preço enquanto o saldo
// cobrir; para no primeiro que não couber. Cashback nunca abate parcialmente um serviço.
export function suggestCashback(
  services: { id: string; name: string; price: number }[],
  available: number,
): { services: { id: string; name: string; price: number }[]; amount: number } {
  const sorted = [...services].sort((a, b) => a.price - b.price)
  const picked: typeof sorted = []
  let sum = 0
  for (const s of sorted) {
    if (sum + s.price <= available + 1e-6) {
      picked.push(s)
      sum += s.price
    } else {
      break
    }
  }
  return { services: picked, amount: Number(sum.toFixed(2)) }
}
