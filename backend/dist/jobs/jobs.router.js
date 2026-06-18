"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobsRouter = void 0;
const express_1 = require("express");
const config_1 = require("../config");
const asyncHandler_1 = require("../common/asyncHandler");
const paymentHoldExpiration_job_1 = require("./paymentHoldExpiration.job");
const outboxProcessor_1 = require("../notification/outboxProcessor");
const winBack_job_1 = require("./winBack.job");
// Endpoints internos acionados por agendador externo (Vercel Cron, cron-job.org, pg_cron).
// O Vercel Cron envia "Authorization: Bearer ${CRON_SECRET}" automaticamente.
function requireCronSecret(req, res, next) {
    if (!config_1.config.CRON_SECRET) {
        return res.status(503).json({ message: 'CRON_SECRET não configurado.' });
    }
    const header = req.headers.authorization;
    if (header !== `Bearer ${config_1.config.CRON_SECRET}`) {
        return res.status(401).json({ message: 'Não autorizado.' });
    }
    next();
}
exports.jobsRouter = (0, express_1.Router)();
exports.jobsRouter.use(requireCronSecret);
const expireHolds = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const processed = await (0, paymentHoldExpiration_job_1.runPaymentHoldExpiration)();
    res.json({ job: 'expire-holds', processed });
});
const outbox = (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const sent = await (0, outboxProcessor_1.processOutbox)();
    res.json({ job: 'process-outbox', sent });
});
const winBack = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const result = await (0, winBack_job_1.runWinBack)(date);
    res.json(result);
});
exports.jobsRouter.get('/expire-holds', expireHolds);
exports.jobsRouter.post('/expire-holds', expireHolds);
exports.jobsRouter.get('/process-outbox', outbox);
exports.jobsRouter.post('/process-outbox', outbox);
exports.jobsRouter.get('/win-back', winBack);
exports.jobsRouter.post('/win-back', winBack);
