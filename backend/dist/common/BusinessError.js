"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessError = void 0;
class BusinessError extends Error {
    code;
    statusCode;
    constructor(code, message, statusCode) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'BusinessError';
    }
}
exports.BusinessError = BusinessError;
