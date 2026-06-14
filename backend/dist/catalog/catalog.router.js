"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogRouter = void 0;
const express_1 = require("express");
const catalog_service_1 = require("./catalog.service");
const asyncHandler_1 = require("../common/asyncHandler");
exports.catalogRouter = (0, express_1.Router)();
exports.catalogRouter.get('/services', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const services = await (0, catalog_service_1.findActiveServices)();
    res.json(services);
}));
exports.catalogRouter.get('/barbers', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const barbers = await (0, catalog_service_1.findBarbers)();
    res.json(barbers);
}));
