"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const BusinessError_1 = require("./BusinessError");
// Criptografia simétrica em repouso (AES-256-GCM) para o segredo TOTP (NFR FEAT-076).
// Formato armazenado (base64): iv(12) | authTag(16) | ciphertext.
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
function key() {
    if (!config_1.config.TOTP_ENC_KEY) {
        throw new BusinessError_1.BusinessError('TWO_FA_UNAVAILABLE', 'Autenticação em duas etapas não está configurada neste ambiente.', 503);
    }
    return Buffer.from(config_1.config.TOTP_ENC_KEY, 'hex');
}
function encryptSecret(plain) {
    const iv = crypto_1.default.randomBytes(IV_LEN);
    const cipher = crypto_1.default.createCipheriv(ALGO, key(), iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString('base64');
}
function decryptSecret(stored) {
    const buf = Buffer.from(stored, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto_1.default.createDecipheriv(ALGO, key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
