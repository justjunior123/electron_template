"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const server_1 = require("./server");
const electron_updater_1 = require("electron-updater");
const DatabaseService_1 = require("./services/database/DatabaseService");
const electron_devtools_installer_1 = __importStar(require("electron-devtools-installer"));
// Define pattern at module scope for reuse
const reactDevToolsPattern = /(?:Download the React DevTools|Download React DevTools|React DevTools download|reactjs\.org\/link\/react-devtools)/i;
const webpackInternalPattern = /webpack-internal:\/\/.*react-dom\.development\.js/i;
const rendererErrorPattern = /(?:Electron renderer\.bundle\.js script failed to run|TypeError: object null is not iterable)/i;
const rscPayloadPattern = /Failed to fetch RSC payload.*Falling back to browser navigation/i;
// Suppress specific Electron warnings in development
if (process.env.NODE_ENV === 'development') {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
    // Suppress React DevTools message
    process.env.REACT_DEVTOOLS_INSTALLED = 'true';
    // Enhanced console filtering
    const originalConsole = console;
    // Add newline after every console message
    const withNewline = (fn) => (...args) => {
        fn.apply(console, args);
        process.stdout.write('\n');
    };
    console = {
        ...console,
        log: withNewline(originalConsole.log),
        info: withNewline(originalConsole.info),
        warn: withNewline(originalConsole.warn),
        error: withNewline(originalConsole.error)
    };
}
let mainWindow = null;
let serverInstance = null;
const dbService = DatabaseService_1.DatabaseService.getInstance();
const isDev = process.env.NODE_ENV === 'development';
const NEXT_PORT = process.env.PORT || 3002;
// Enable hot reload in development
if (isDev) {
    try {
        console.log('🔄 Enabling hot reload...');
        const path = require('path');
        const projectRoot = path.join(__dirname, '../..');
        require('electron-reloader')(module, {
            debug: false, // Disable debug messages
            watchRenderer: true,
            ignore: [
                'node_modules',
                '.next',
                'dist',
                'release'
            ],
            watch: [
                path.join(projectRoot, 'electron'),
                path.join(projectRoot, 'app'),
                path.join(projectRoot, 'src')
            ]
        });
    }
    catch (err) {
        console.error('❌ Error setting up hot reload:', err);
    }
}
// Add this before app.whenReady()
electron_1.app.commandLine.appendSwitch('no-sandbox');
electron_1.app.commandLine.appendSwitch('disable-site-isolation-trials');
// Ensure renderer process has required globals
electron_1.app.on('ready', () => {
    // Set up global error handlers
    process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error);
    });
    process.on('unhandledRejection', (error) => {
        console.error('Unhandled Rejection:', error);
    });
});
async function installDevTools() {
    if (isDev) {
        try {
            // Set permissions for DevTools
            electron_1.session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
                const parsedUrl = new URL(webContents.getURL());
                // Allow DevTools and localhost permissions
                if (parsedUrl.hostname === 'localhost' ||
                    webContents.getURL().startsWith('chrome-extension://') ||
                    permission === 'clipboard-sanitized-write' ||
                    permission === 'clipboard-read') {
                    callback(true);
                }
                else {
                    callback(false);
                }
            });
            // Set up content security policy for DevTools
            electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
                callback({
                    responseHeaders: {
                        ...details.responseHeaders,
                        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' data: chrome-extension:"]
                    }
                });
            });
            // Install React DevTools silently
            const reactDevToolsPath = await (0, electron_devtools_installer_1.default)(electron_devtools_installer_1.REACT_DEVELOPER_TOOLS, {
                loadExtensionOptions: {
                    allowFileAccess: true
                }
            });
            // Set environment variable to indicate React DevTools is installed
            if (reactDevToolsPath) {
                process.env.REACT_DEVTOOLS_INSTALLED = 'true';
                console.log('✅ React DevTools installed');
            }
        }
        catch (err) {
            console.error('❌ Error installing React DevTools:', err);
        }
    }
}
async function createWindow() {
    console.log('🎯 Creating Electron window...');
    // Prevent multiple windows from being created
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.focus();
        return;
    }
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            preload: (0, path_1.join)(__dirname, 'preload.js'),
            backgroundThrottling: false,
            spellcheck: false,
            devTools: isDev,
            webgl: true,
            javascript: true,
            v8CacheOptions: 'none',
            enablePreferredSizeMode: true,
            additionalArguments: ['--no-sandbox', '--enable-features=ElectronSerialChooser']
        }
    });
    // Handle console messages
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        // Replace RSC payload error with emoji
        if (message.includes('Failed to fetch RSC payload')) {
            console.log('\n🔄\n');
            event.preventDefault();
            return;
        }
    });
    // Add this before loading the URL
    if (isDev) {
        // Intercept renderer process errors
        mainWindow.webContents.on('console-message', (event, level, message) => {
            if (message.includes('Electron renderer.bundle.js script failed to run') ||
                message.includes('TypeError: object null is not iterable')) {
                event.preventDefault();
                return;
            }
        });
        // Set proper CSP for development with more permissive settings
        electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; connect-src 'self' http://localhost:* ws://localhost:*"
                    ]
                }
            });
        });
        // Wait for window to be ready before loading URL
        mainWindow.webContents.once('dom-ready', () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.openDevTools();
            }
        });
        // Handle renderer process errors
        mainWindow.webContents.on('render-process-gone', (event, details) => {
            console.error('Renderer process gone:', details.reason);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.reload();
            }
        });
        mainWindow.webContents.on('crashed', () => {
            console.error('Renderer process crashed');
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.reload();
            }
        });
        const devServerUrl = `http://localhost:${NEXT_PORT}`;
        console.log(`🌐 Loading development server at ${devServerUrl}`);
        try {
            await mainWindow.loadURL(devServerUrl);
            console.log('✅ Development server loaded successfully');
        }
        catch (error) {
            console.error('❌ Error loading development server:', error);
            // Try to reload on error
            if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
                setTimeout(() => mainWindow?.reload(), 1000);
            }
        }
    }
    else {
        // In production, use the built Next.js app
        await mainWindow.loadFile((0, path_1.join)(__dirname, '../../out/index.html'));
    }
    // Initialize auto-updater
    if (!isDev) {
        electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// App lifecycle events
electron_1.app.whenReady().then(async () => {
    try {
        console.log('🚀 Starting application...');
        await installDevTools();
        console.log('📊 Initializing database...');
        await dbService.init();
        console.log('✅ Database initialized');
        serverInstance = await (0, server_1.setupServer)();
        console.log('✅ Server started');
        await createWindow();
    }
    catch (error) {
        console.error('❌ Error during startup:', error);
        electron_1.app.quit();
    }
    electron_1.app.on('activate', async () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            await createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', async () => {
    // Cleanup both server and database
    await Promise.all([
        (0, server_1.cleanup)(),
        dbService.cleanup()
    ]).catch(err => {
        console.error('❌ Error during cleanup:', err);
    });
});
