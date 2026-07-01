// Formatação de moeda (BRL, pt-BR) e datas — compartilhado por core e módulos.
export const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function today() {
  return dateInputValue(new Date())
}

export function tomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return dateInputValue(date)
}

export function timeLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function dateOnlyLabel(value: string) {
  const day = value.slice(0, 10)
  return new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
