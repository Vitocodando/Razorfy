"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
// Colunas BIGINT (ex.: version) chegam como BigInt e o JSON.stringify nativo não os serializa.
// Os valores aqui cabem com folga em Number (contadores de versão otimista).
BigInt.prototype.toJSON = function () {
    return Number(this);
};
// Prisma.Decimal serializa como string por padrão; o contrato da API (herdado do
// Jackson/BigDecimal do backend Java) usa números JSON para preços e saldos.
client_1.Prisma.Decimal.prototype.toJSON = function () {
    return this.toNumber();
};
const config_1 = require("./config");
const errorHandler_1 = require("./common/errorHandler");
const auth_router_1 = require("./auth/auth.router");
const catalog_router_1 = require("./catalog/catalog.router");
const schedule_router_1 = require("./schedule/schedule.router");
const appointment_router_1 = require("./appointment/appointment.router");
const wallet_router_1 = require("./cashback/wallet.router");
const payment_router_1 = require("./payment/payment.router");
const report_router_1 = require("./report/report.router");
const jobs_router_1 = require("./jobs/jobs.router");
const review_router_1 = require("./review/review.router");
const goal_router_1 = require("./goal/goal.router");
const crm_router_1 = require("./crm/crm.router");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({ origin: config_1.config.CORS_ALLOWED_ORIGIN, credentials: true }));
    app.use(express_1.default.json());
    app.get('/actuator/health', (_req, res) => res.json({ status: 'UP' }));
    app.use('/api/v1/auth', auth_router_1.authRouter);
    app.use('/api/v1', catalog_router_1.catalogRouter);
    app.use('/api/v1', schedule_router_1.scheduleRouter);
    app.use('/api/v1/appointments', appointment_router_1.appointmentRouter);
    app.use('/api/v1', wallet_router_1.walletRouter);
    app.use('/api/payments', payment_router_1.paymentRouter);
    app.use('/api/v1', report_router_1.reportRouter);
    app.use('/api/v1', review_router_1.reviewRouter);
    app.use('/api/v1', goal_router_1.goalRouter);
    app.use('/api/v1', crm_router_1.crmRouter);
    app.use('/api/internal/jobs', jobs_router_1.jobsRouter);
    app.use(errorHandler_1.errorHandler);
    return app;
}
