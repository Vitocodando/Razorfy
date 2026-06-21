"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRouter = void 0;
const express_1 = require("express");
const catalog_service_1 = require("./catalog.service");
const asyncHandler_1 = require("../common/asyncHandler");
exports.catalogRouter = (0, express_1.Router)();
// Rotas legadas (sem tenant na URL) → resolvem o tenant default (compatibilidade com o app atual).
exports.catalogRouter.get('/services', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json(await (0, catalog_service_1.findActiveServices)());
}));
exports.catalogRouter.get('/barbers', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    res.json(await (0, catalog_service_1.findBarbers)());
}));
