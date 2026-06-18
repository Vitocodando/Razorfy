"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWinBack = runWinBack;
exports.startWinBackJob = startWinBackJob;
const config_1 = require("../config");
const availability_service_1 = require("../schedule/availability.service");
const admin_service_1 = require("../admin/admin.service");
let lastRunDate = null;
async function runWinBack(referenceDate = (0, availability_service_1.localDateString)()) {
    return (0, admin_service_1.runWinBackCampaign)(referenceDate);
}
function startWinBackJob() {
    return setInterval(async () => {
        try {
            const now = new Date();
            const parts = new Intl.DateTimeFormat('en-GB', {
                timeZone: config_1.config.BUSINESS_TIMEZONE,
                hour: '2-digit',
                hour12: false,
            }).formatToParts(now);
            const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
            const today = (0, availability_service_1.localDateString)(now);
            if (hour === 0 && lastRunDate !== today) {
                await runWinBack(today);
                lastRunDate = today;
            }
        }
        catch (err) {
            console.error('[winback] erro no job:', err);
        }
    }, 5 * 60_000);
}
