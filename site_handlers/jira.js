(function() {
    if (!window.CustomSiteHandlers) return;

    const IGNORED_JIRA_USERS = [
        'automation.bot',
        'status.bot',
        'service.account'
    ];

    const rawHosts = window.OWUI_URL_CONFIG?.jiraHosts;
    const fallbackHost = window.OWUI_URL_CONFIG?.jiraHost;
    const hostCandidates = [];

    if (Array.isArray(rawHosts)) {
        hostCandidates.push(...rawHosts);
    } else if (rawHosts) {
        hostCandidates.push(rawHosts);
    }
    if (fallbackHost) {
        hostCandidates.push(fallbackHost);
    }

    const jiraHosts = Array.from(new Set(
        hostCandidates
            .map(host => (host || '').toLowerCase())
            .filter(Boolean)
    ));

    if (!jiraHosts.length) {
        jiraHosts.push('jira.foo.bar');
    }

    const registerHandler = (host) => {
        window.CustomSiteHandlers.register({
            id: host,
            matches: (urlObj) => urlObj.hostname.toLowerCase() === host && /\/browse\//i.test(urlObj.pathname),
            handle: async ({ tab, dropTextFile, showStatusMessage }) => {
                if (!tab?.id || typeof dropTextFile !== 'function') {
                    return { handled: false };
                }

                showStatusMessage('Fetching Jira issue details...');
                try {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        args: [IGNORED_JIRA_USERS],
                        func: async (ignoredUsersList) => {
                            const normalizeToken = (token) => (token ? token.toString().trim().toLowerCase() : '');
                            const ignoredSet = new Set((ignoredUsersList || []).map(normalizeToken).filter(Boolean));
                            const shouldIgnoreComment = (author) => {
                                if (!author) return false;
                                const tokens = [
                                    author.name,
                                    author.key,
                                    author.accountId,
                                    author.emailAddress,
                                    author.username,
                                    author.userName
                                ];
                                if (author.displayName) {
                                    tokens.push(author.displayName.replace(/\s+/g, ''));
                                    tokens.push(author.displayName);
                                }
                                return tokens.map(normalizeToken).some(token => token && ignoredSet.has(token));
                            };
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
                        const formatList = (items) => {
                            if (!items || !items.length) return '—';
                            const values = items
                                .map(item => {
                                    if (typeof item === 'string') return item;
                                    if (item && typeof item === 'object') {
                                        return item.name || item.value || item.id || '';
                                    }
                                    return '';
                                })
                                .map(value => value?.toString().trim())
                                .filter(Boolean);
                            return values.length ? values.join(', ') : '—';
                        };

                        const description = cleanHtml(fields.description || issue.renderedFields?.description || '');
                        const summaryText = replaceUserMentions(fields.summary || '—');
                        const commentsSource = (fields.comment?.comments || []).filter(comment => !shouldIgnoreComment(comment.author));
                            const comments = commentsSource.map(comment => {
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
                            `Priority: ${fields.priority?.name || '—'}`,
                            `Assignee: ${formatUser(fields.assignee)}`,
                            `Reporter: ${formatUser(fields.reporter)}`,
                            `Created: ${formatDate(fields.created)}`,
                            `Updated: ${formatDate(fields.updated)}`,
                            `Resolved: ${formatDate(fields.resolutiondate)}`,
                            `Epic: ${fields.customfield_10011 || fields.epic?.name || '—'}`,
                            `Affects Versions: ${formatList(fields.versions)}`,
                            `Fix Versions: ${formatList(fields.fixVersions)}`,
                            `Labels: ${formatList(fields.labels)}`,
                            `Components: ${formatList(fields.components)}`,
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
    };

    jiraHosts.forEach(registerHandler);
})();
