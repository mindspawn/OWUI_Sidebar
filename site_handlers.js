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

    register({
        id: 'jira.foo.bar',
        matches: (urlObj) => urlObj.hostname.toLowerCase() === 'jira.foo.bar' && /\/browse\//i.test(urlObj.pathname),
        handle: async ({ tab, dropTextFile, showStatusMessage }) => {
            if (!tab?.id || typeof dropTextFile !== 'function') {
                return { handled: false };
            }

            showStatusMessage('Fetching Jira issue details...');

            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: async () => {
                        const match = window.location.pathname.match(/\/browse\/([^/?#]+)/i);
                        const issueKey = match ? match[1] : null;
                        if (!issueKey) {
                            return { success: false, error: 'Could not determine issue key from URL' };
                        }

                        const endpoint = `${window.location.origin}/rest/api/2/issue/${issueKey}?expand=renderedFields`;
                        let response;
                        try {
                            response = await fetch(endpoint, {
                                method: 'GET',
                                credentials: 'include',
                                headers: { 'Accept': 'application/json' }
                            });
                        } catch (networkError) {
                            return { success: false, error: networkError.message };
                        }

                        if (!response || !response.ok) {
                            return { success: false, error: `Jira API returned ${response ? response.status : 'network error'}` };
                        }

                        const issue = await response.json();
                        const fields = issue.fields || {};
                        const capitalizeWord = (word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
                        const humanizeIdentifier = (identifier) => {
                            if (!identifier) return 'Unknown';
                            const cleaned = identifier.replace(/^accountid:/i, '');
                            return cleaned
                                .split(/[._\-\s@]+/)
                                .filter(Boolean)
                                .map(capitalizeWord)
                                .join(' ') || identifier;
                        };
                        const replaceUserMentions = (text) => {
                            if (!text) return '';
                            return text.replace(/\[~([^\]]+)\]/g, (_, token) => humanizeIdentifier(token));
                        };
                        const cleanHtml = (value) => {
                            if (!value) return '';
                            const temp = document.createElement('div');
                            const source = typeof value === 'string' ? value : String(value);
                            temp.innerHTML = source;
                            const text = (temp.textContent || temp.innerText || '').replace(/\s+/g, ' ').trim();
                            return replaceUserMentions(text);
                        };
                        const formatUser = (user) => {
                            if (!user) return '—';
                            const parts = [user.displayName || humanizeIdentifier(user.name) || '—'];
                            if (user.emailAddress) {
                                parts.push(`<${user.emailAddress}>`);
                            }
                            return parts.join(' ');
                        };
                        const formatDate = (value) => (value ? new Date(value).toISOString() : '—');
                        const formatCommentDate = (value) => {
                            if (!value) return '—';
                            const date = new Date(value);
                            if (isNaN(date.getTime())) return '—';
                            return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
                        };

                        const description = cleanHtml(fields.description || issue.renderedFields?.description || '');
                        const summaryText = replaceUserMentions(fields.summary || '—');
                        const comments = (fields.comment?.comments || []).map(comment => {
                            const authorName = comment.author?.displayName || humanizeIdentifier(comment.author?.name) || 'Unknown';
                            const dateLabel = formatCommentDate(comment.updated || comment.created);
                            const body = cleanHtml(comment.body) || '—';
                            return `comment by ${authorName} on ${dateLabel}:\n${body}`;
                        });

                        const lines = [
                            `Issue: ${issue.key}`,
                            `URL: ${window.location.href}`,
                            '',
                            `Summary: ${summaryText}`,
                            `Status: ${fields.status?.name || '—'}`,
                            `Assignee: ${formatUser(fields.assignee)}`,
                            `Reporter: ${formatUser(fields.reporter)}`,
                            `Created: ${formatDate(fields.created)}`,
                            `Updated: ${formatDate(fields.updated)}`,
                            `Resolved: ${formatDate(fields.resolutiondate)}`,
                            `Epic: ${fields.customfield_10011 || fields.epic?.name || '—'}`,
                            '',
                            'Description:',
                            description || '—',
                            '',
                            'Comments:',
                            comments.length ? comments.join('\n\n') : 'No comments'
                        ];

                        return {
                            success: true,
                            text: lines.join('\n'),
                            fileName: `${issue.key || issueKey}.txt`
                        };
                    }
                });

                const extraction = results?.[0]?.result;
                if (!extraction || !extraction.success) {
                    showStatusMessage(extraction?.error || 'Failed to fetch Jira details', true);
                    return { handled: false };
                }

                await dropTextFile(extraction.text, extraction.fileName || 'jira_issue.txt');
                return { handled: true, message: 'Jira summary dropped' };
            } catch (error) {
                console.error('Jira handler failed:', error);
                showStatusMessage('Jira handler failed. Falling back to default extraction.', true);
                return { handled: false };
            }
        }
    });

    register({
        id: 'confluence.foo.bar',
        matches: (urlObj) => urlObj.hostname.toLowerCase() === 'confluence.foo.bar' && (/\/pages\//i.test(urlObj.pathname) || /\/display\//i.test(urlObj.pathname) || urlObj.pathname === '/pages/viewpage.action'),
        handle: async ({ tab, dropTextFile, showStatusMessage }) => {
            if (!tab?.id || typeof dropTextFile !== 'function') {
                return { handled: false };
            }

            showStatusMessage('Fetching Confluence page details...');

            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: async () => {
                        const capitalizeWord = (word) => word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
                        const humanizeIdentifier = (identifier) => {
                            if (!identifier) return 'Unknown';
                            return identifier
                                .split(/[._\-\s@]+/)
                                .filter(Boolean)
                                .map(capitalizeWord)
                                .join(' ') || identifier;
                        };
                        const replaceUserMentions = (text) => {
                            if (!text) return '';
                            return text.replace(/\[~([^\]]+)\]/g, (_, token) => humanizeIdentifier(token));
                        };
                        const cleanRichText = (html) => {
                            if (!html) return '';
                            const container = document.createElement('div');
                            container.innerHTML = html;
                            container.querySelectorAll('script, style').forEach(el => el.remove());
                            container.querySelectorAll('[data-username],[data-account-id]').forEach(node => {
                                const identifier = node.getAttribute('data-username') || node.getAttribute('data-account-id');
                                if (identifier) {
                                    node.textContent = humanizeIdentifier(identifier);
                                }
                            });
                            container.innerHTML = replaceUserMentions(container.innerHTML);
                            const text = (container.textContent || container.innerText || '')
                                .replace(/\u00A0/g, ' ')
                                .replace(/\s+\n/g, '\n')
                                .replace(/\n{3,}/g, '\n\n')
                                .replace(/[ \t]{2,}/g, ' ')
                                .trim();
                            return text;
                        };
                        const formatUser = (user) => {
                            if (!user) return '—';
                            return user.displayName || humanizeIdentifier(user.username || user.userName || user.name) || '—';
                        };
                        const formatDate = (value) => (value ? new Date(value).toISOString() : '—');

                        const getPageId = () => {
                            const params = new URLSearchParams(window.location.search || '');
                            if (params.get('pageId')) return params.get('pageId');
                            const meta = document.querySelector('meta[name="ajs-page-id"]');
                            if (meta?.content) return meta.content;
                            const dataAttr = document.querySelector('[data-page-id]');
                            if (dataAttr?.getAttribute('data-page-id')) return dataAttr.getAttribute('data-page-id');
                            return null;
                        };

                        const pageId = getPageId();
                        if (!pageId) {
                            return { success: false, error: 'Could not determine Confluence page ID' };
                        }

                        const endpoint = `${window.location.origin}/rest/api/content/${pageId}?expand=body.view,version,history,history.lastUpdated,space,metadata.labels`;
                        let response;
                        try {
                            response = await fetch(endpoint, {
                                method: 'GET',
                                credentials: 'include',
                                headers: { 'Accept': 'application/json' }
                            });
                        } catch (networkError) {
                            return { success: false, error: networkError.message };
                        }

                        if (!response || !response.ok) {
                            return { success: false, error: `Confluence API returned ${response ? response.status : 'network error'}` };
                        }

                        const page = await response.json();
                        const bodyHtml = page.body?.view?.value || '';
                        const contentText = cleanRichText(bodyHtml);

                        const headings = [];
                        if (bodyHtml) {
                            const headingContainer = document.createElement('div');
                            headingContainer.innerHTML = bodyHtml;
                            headingContainer.querySelectorAll('h1, h2, h3').forEach(h => {
                                const level = h.tagName.toLowerCase();
                                const indent = level === 'h1' ? '' : level === 'h2' ? '  ' : '    ';
                                headings.push(`${indent}- ${h.textContent.trim()}`);
                            });
                        }

                        const labels = (page.metadata?.labels?.results || page.metadata?.labels || [])
                            .map(label => label.name || label)
                            .filter(Boolean);
                        const createdDate = page.history?.createdDate || page.history?.created || page.history?.createdTime;
                        const updatedDate = page.history?.lastUpdated?.when || page.version?.when;

                        const lines = [
                            `Title: ${page.title || 'Untitled'}`,
                            `URL: ${window.location.href}`,
                            '',
                            `Space: ${page.space?.name || page.space?.key || '—'}`,
                            `Created By: ${formatUser(page.history?.createdBy || page.history?.createdByUser)}`,
                            `Created: ${formatDate(createdDate)}`,
                            `Last Updated By: ${formatUser(page.history?.lastUpdated?.by || page.version?.by)}`,
                            `Last Updated: ${formatDate(updatedDate)}`,
                            `Labels: ${labels.length ? labels.join(', ') : 'None'}`,
                            '',
                            'Headings:',
                            headings.length ? headings.join('\n') : 'No headings extracted',
                            '',
                            'Content:',
                            contentText || 'No body content'
                        ];

                        return {
                            success: true,
                            text: lines.join('\n'),
                            fileName: `${(page.title || 'confluence_page').replace(/[^a-z0-9._-]+/gi, '_')}.txt`
                        };
                    }
                });

                const extraction = results?.[0]?.result;
                if (!extraction || !extraction.success) {
                    showStatusMessage(extraction?.error || 'Failed to fetch Confluence details', true);
                    return { handled: false };
                }

                await dropTextFile(extraction.text, extraction.fileName || 'confluence_page.txt');
                return { handled: true, message: 'Confluence page dropped' };
            } catch (error) {
                console.error('Confluence handler failed:', error);
                showStatusMessage('Confluence handler failed. Falling back to default extraction.', true);
                return { handled: false };
            }
        }
    });

    window.CustomSiteHandlers = {
        register,
        getHandlerForUrl
    };
})();
