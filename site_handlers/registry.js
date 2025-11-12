(function() {
    const handlers = [];

    function register(handler) {
        if (!handler || typeof handler.matches !== 'function' || typeof handler.handle !== 'function') {
            console.warn('Attempted to register invalid site handler', handler);
            return;
        }
        handlers.push(handler);
    }

    function getHandlerForUrl(url) {
        if (!url) return null;
        let urlObj;
        try {
            urlObj = typeof url === 'string' ? new URL(url) : url;
        } catch (error) {
            console.warn('Invalid URL passed to handler lookup', url);
            return null;
        }

        for (const handler of handlers) {
            try {
                if (handler.matches(urlObj)) {
                    return handler;
                }
            } catch (err) {
                console.error(`Error evaluating handler match for ${handler.id}`, err);
            }
        }
        return null;
    }

    window.CustomSiteHandlers = {
        register,
        getHandlerForUrl
    };
})();
