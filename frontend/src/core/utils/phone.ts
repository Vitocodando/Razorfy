// FEAT-083: máscara BR 99 9 9999-9999 a partir de dígitos crus (DDD+9+8).
// Compartilhada entre módulos de auth e o backoffice (PlatformUserEditModal).
export function maskPhoneBR(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 3) return `${d.slice(0, 2)} ${d.slice(2)}`
  if (d.length <= 7) return `${d.slice(0, 2)} ${d.slice(2, 3)} ${d.slice(3)}`
  return `${d.slice(0, 2)} ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
}
