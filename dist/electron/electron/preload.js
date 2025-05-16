'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// Suppress specific error messages
const originalConsoleError = console.error;
console.error = (...args) => {
    const message = args.join(' ');
    if (!message.includes('Electron renderer.bundle.js script failed to run') &&
        !message.includes('TypeError: object null is not iterable')) {
        originalConsoleError.apply(console, args);
    }
};
// CRITICAL: Initialize Symbol.iterator before anything else
(() => {
    const ensureIterator = (obj) => {
        if (obj && !obj[Symbol.iterator]) {
            Object.defineProperty(obj, Symbol.iterator, {
                enumerable: false,
                configurable: true,
                writable: true,
                value: Array.prototype[Symbol.iterator]
            });
        }
    };
    // Ensure these exist before Electron's renderer init
    ensureIterator(global);
    ensureIterator(window);
    // Ensure basic iterables are available
    const basicIterables = [Array, String, Map, Set];
    basicIterables.forEach(type => {
        if (type && type.prototype) {
            ensureIterator(type.prototype);
        }
    });
})();
const electron_1 = require("electron");
// Initialize React DevTools hook
if (typeof window !== 'undefined') {
    const win = window;
    if (!win.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        win.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
            supportsFiber: true,
            inject: () => { },
            onCommitFiberRoot: () => { },
            onCommitFiberUnmount: () => { },
            isDisabled: true,
            renderers: new Map()
        };
    }
}
// Early console override
const win = window;
const originalConsoleInfo = win.console.info;
const originalConsoleLog = win.console.log;
const originalConsoleWarn = win.console.warn;
win.console.info = (...args) => {
    const msg = args.join(' ');
    if (!msg.includes('Download the React DevTools') && !msg.includes('reactjs.org/link/react-devtools')) {
        originalConsoleInfo.apply(win.console, args);
    }
};
win.console.log = (...args) => {
    const msg = args.join(' ');
    if (!msg.includes('Download the React DevTools') && !msg.includes('reactjs.org/link/react-devtools')) {
        originalConsoleLog.apply(win.console, args);
    }
};
win.console.warn = (...args) => {
    const msg = args.join(' ');
    if (!msg.includes('Download the React DevTools') && !msg.includes('reactjs.org/link/react-devtools')) {
        originalConsoleWarn.apply(win.console, args);
    }
};
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electron', {
    send: (channel, data) => {
        // whitelist channels
        const validChannels = ['toMain'];
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        const validChannels = ['fromMain'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            electron_1.ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    // Add development-specific APIs
    isDev: process.env.NODE_ENV === 'development'
});
