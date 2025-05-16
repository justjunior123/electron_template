"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupServer = setupServer;
exports.cleanup = cleanup;
const express_1 = __importDefault(require("express"));
let server = null;
const API_PORT = process.env.API_PORT || 3100;
async function setupServer() {
    const app = (0, express_1.default)();
    // Basic middleware
    app.use(express_1.default.json());
    // Basic health check endpoint
    app.get('/health', (req, res) => {
        res.json({ status: 'ok' });
    });
    // Start the server
    return new Promise((resolve, reject) => {
        try {
            server = app.listen(API_PORT, () => {
                console.log(`API Server running on port ${API_PORT}`);
                resolve(server);
            });
        }
        catch (err) {
            reject(err);
        }
    });
}
function cleanup() {
    if (server) {
        server.close();
        server = null;
    }
}
