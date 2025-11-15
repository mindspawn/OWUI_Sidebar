// Centralized defaults for OWUI endpoints.
const OWUI_URL_CONFIG = {
    sidebarUrl: 'https://chat.foo.bar',
    externalUrl: 'https://chat.foo.bar'
};

// Expose the config globally so it can be consumed from service workers and DOM contexts.
if (typeof self !== 'undefined') {
    self.OWUI_URL_CONFIG = OWUI_URL_CONFIG;
}

// Support CommonJS style imports if we ever bundle or test this file.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OWUI_URL_CONFIG;
}
