export interface SlotWindow {
  startMinutes: number;
  endMinutes: number;
  lunchStartMinutes: number | null;
  lunchEndMinutes: number | null;
}

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function fits(slot: SlotWindow, startMin: number, endMin: number, startDate: Date, endDate: Date): boolean {
  // Appointment must not span midnight (same calendar day)
  if (startDate.toDateString() !== endDate.toDateString()) return false;
  if (startMin < slot.startMinutes) return false;
  if (endMin > slot.endMinutes) return false;
  if (slot.lunchStartMinutes === null || slot.lunchEndMinutes === null) return true;
  // Must not overlap lunch [lunchStart, lunchEnd)
  // OK if: entirely before lunch OR entirely after lunch
  return startMin >= slot.lunchEndMinutes || endMin <= slot.lunchStartMinutes;
}
