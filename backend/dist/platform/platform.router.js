"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const authenticate_1 = require("../middleware/authenticate");
const platform_middleware_1 = require("./platform.middleware");
const asyncHandler_1 = require("../common/asyncHandler");
const platform_schemas_1 = require("./platform.schemas");
const platform_service_1 = require("./platform.service");
// Backoffice mestre (FEAT-075): /api/v1/platform/* — exclusivo role DEV.
exports.platformRouter = (0, express_1.Router)();
exports.platformRouter.use(authenticate_1.authenticate, platform_middleware_1.requireDev);
const UuidParam = zod_1.z.string().uuid();
// RF01
exports.platformRouter.get('/tenants', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { page, size } = platform_schemas_1.ListTenantsQuery.parse(req.query);
    res.json(await (0, platform_service_1.listTenants)(page, size));
}));
// RF02
exports.platformRouter.post('/tenants', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const body = platform_schemas_1.CreateTenantSchema.parse(req.body);
    res.status(201).json(await (0, platform_service_1.createTenant)(body));
}));
// RF03 (kill-switch)
exports.platformRouter.patch('/tenants/:tenantId/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const tenantId = UuidParam.parse(req.params.tenantId);
    const { isActive } = platform_schemas_1.TenantStatusSchema.parse(req.body);
    res.json(await (0, platform_service_1.setTenantStatus)(tenantId, isActive));
}));
