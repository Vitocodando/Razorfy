"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTimeToMinutes = parseTimeToMinutes;
exports.fits = fits;
function parseTimeToMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}
function fits(slot, startMin, endMin, startDate, endDate) {
    // Appointment must not span midnight (same calendar day)
    if (startDate.toDateString() !== endDate.toDateString())
        return false;
    if (startMin < slot.startMinutes)
        return false;
    if (endMin > slot.endMinutes)
        return false;
    if (slot.lunchStartMinutes === null || slot.lunchEndMinutes === null)
        return true;
    // Must not overlap lunch [lunchStart, lunchEnd)
    // OK if: entirely before lunch OR entirely after lunch
    return startMin >= slot.lunchEndMinutes || endMin <= slot.lunchStartMinutes;
}
