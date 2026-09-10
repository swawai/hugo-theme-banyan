import {
    buildRuntimeActions,
    buildRuntimeEnvironmentKey,
    normalizeNavigationUrl,
    resolveRuntimeConfig,
    resolveRuntimeCoordination
} from './policy.js';
import {
    readPrefetchAnchorCandidates,
    readPrefetchPayload,
    readPrefetchRuntimeMeta,
    supportsLinkPrefetch,
    supportsServiceWorkerApi,
    supportsSpeculationRules
} from './browser.js';

(function () {
    function normalizeForCurrentPage(rawUrl) {
        return normalizeNavigationUrl(rawUrl, window.location.href);
    }

    function collectSuppressedActions(rawActions, filteredActions) {
        if (!(rawActions && typeof rawActions === 'object')) return {};

        var suppressed = {};
        Object.keys(rawActions).forEach(function (key) {
            var rawUrls = Array.isArray(rawActions[key]) ? rawActions[key] : [];
            var filteredUrls = filteredActions && Array.isArray(filteredActions[key]) ? filteredActions[key] : [];
            var filteredSet = Object.create(null);

            for (var i = 0; i < filteredUrls.length; i += 1) {
                var normalized = normalizeForCurrentPage(filteredUrls[i]);
                if (normalized) filteredSet[normalized] = true;
            }

            var removed = [];
            for (var j = 0; j < rawUrls.length; j += 1) {
                var candidate = rawUrls[j];
                var normalizedCandidate = normalizeForCurrentPage(candidate);
                if (normalizedCandidate && filteredSet[normalizedCandidate]) continue;
                removed.push(candidate);
            }

            if (removed.length > 0) {
                suppressed[key] = removed;
            }
        });
        return suppressed;
    }

    function writePre(id, value) {
        var node = document.getElementById(id);
        if (!node) return;
        node.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }

    function describeWorker(worker) {
        if (!worker) return null;
        return {
            scriptURL: worker.scriptURL || '',
            state: worker.state || '',
            type: worker.type || ''
        };
    }

    function inspectRuntime() {
        var speculationRulesCount = document.head.querySelectorAll('script[type="speculationrules"][data-prefetch-generated="runtime"]').length;
        var prefetchLinkCount = document.head.querySelectorAll('link[rel="prefetch"][data-prefetch-link="runtime"]').length;
        var serviceWorkerApi = supportsServiceWorkerApi();
        var container = serviceWorkerApi ? navigator.serviceWorker : null;
        var swState = {
            apiAvailable: serviceWorkerApi,
            secureContext: !!window.isSecureContext,
            protocol: window.location.protocol,
            controllerPresent: !!(container && container.controller),
            hasReadyPromise: !!(container && container.ready),
            hasGetRegistration: !!(container && typeof container.getRegistration === 'function'),
            hasGetRegistrations: !!(container && typeof container.getRegistrations === 'function'),
            controller: describeWorker(container && container.controller)
        };

        return {
            speculationRulesCount: speculationRulesCount,
            prefetchLinkCount: prefetchLinkCount,
            serviceWorker: swState
        };
    }

    function stripWrappedQuotes(value) {
        if (!value) return '';
        var trimmed = String(value).trim();
        if (
            (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')
            || (trimmed.charAt(0) === '\'' && trimmed.charAt(trimmed.length - 1) === '\'')
        ) {
            return trimmed.slice(1, -1);
        }
        return trimmed;
    }

    async function readSpeculationRulesHeaderState() {
        var state = {
            contentType: '',
            header: '',
            responseOk: false,
            rulesPath: '',
            rulesPayload: null,
            rulesResponseOk: false
        };

        try {
            var response = await fetch(window.location.href, {
                cache: 'no-store',
                credentials: 'same-origin'
            });
            state.responseOk = !!response.ok;
            state.contentType = response.headers.get('content-type') || '';
            state.header = response.headers.get('Speculation-Rules') || '';
            state.rulesPath = stripWrappedQuotes(state.header);

            if (state.rulesPath) {
                var rulesResponse = await fetch(new URL(state.rulesPath, window.location.href).toString(), {
                    cache: 'no-store',
                    credentials: 'same-origin'
                });
                state.rulesResponseOk = !!rulesResponse.ok;
                state.rulesContentType = rulesResponse.headers.get('content-type') || '';
                if (rulesResponse.ok) {
                    state.rulesPayload = await rulesResponse.json().catch(function () { return null; });
                }
            }
        } catch (error) {
            state.error = String(error && error.message ? error.message : error);
        }

        return state;
    }

    async function refresh() {
        var payload = readPrefetchPayload();
        var runtimeMeta = readPrefetchRuntimeMeta();
        var speculationRulesSupported = supportsSpeculationRules();
        var runtimeEnvSequence = buildRuntimeEnvironmentKey(
            supportsLinkPrefetch(),
            supportsServiceWorkerApi()
        );
        var picked = resolveRuntimeConfig(payload, runtimeEnvSequence);
        var candidates = readPrefetchAnchorCandidates();
        var rawActions = picked
            ? buildRuntimeActions(picked.config, candidates, window.location.href)
            : null;
        var ownedSlotDetails = resolveRuntimeCoordination(runtimeMeta, speculationRulesSupported);
        var filteredActions = picked
            ? buildRuntimeActions(
                picked.config,
                candidates,
                window.location.href,
                new Set(ownedSlotDetails.activeOwnedSlots)
            )
            : null;
        var suppressedActions = collectSuppressedActions(rawActions, filteredActions);
        var runtimeState = inspectRuntime();
        var speculationHeaderState = await readSpeculationRulesHeaderState();
        runtimeState.speculationRulesHeader = speculationHeaderState;
        runtimeState.runtimeCoordination = runtimeMeta;

        if (runtimeState.serviceWorker.apiAvailable) {
            try {
                var registration = await navigator.serviceWorker.getRegistration();
                runtimeState.serviceWorker.getRegistrationResult = !!registration;
                runtimeState.serviceWorker.registration = registration ? {
                    scope: registration.scope || '',
                    updateViaCache: registration.updateViaCache || '',
                    installing: describeWorker(registration.installing),
                    waiting: describeWorker(registration.waiting),
                    active: describeWorker(registration.active)
                } : null;
            } catch (error) {
                runtimeState.serviceWorker.getRegistrationError = String(error && error.message ? error.message : error);
            }

            try {
                var readyRegistration = await navigator.serviceWorker.ready;
                runtimeState.serviceWorker.ready = readyRegistration ? {
                    scope: readyRegistration.scope || '',
                    installing: describeWorker(readyRegistration.installing),
                    waiting: describeWorker(readyRegistration.waiting),
                    active: describeWorker(readyRegistration.active)
                } : null;
            } catch (error) {
                runtimeState.serviceWorker.readyError = String(error && error.message ? error.message : error);
            }

            if (typeof navigator.serviceWorker.getRegistrations === 'function') {
                try {
                    var registrations = await navigator.serviceWorker.getRegistrations();
                    runtimeState.serviceWorker.registrationCount = Array.isArray(registrations) ? registrations.length : 0;
                    runtimeState.serviceWorker.registrations = Array.isArray(registrations)
                        ? registrations.map(function (item) {
                            return {
                                scope: item.scope || '',
                                installing: describeWorker(item.installing),
                                waiting: describeWorker(item.waiting),
                                active: describeWorker(item.active)
                            };
                        })
                        : [];
                } catch (error) {
                    runtimeState.serviceWorker.getRegistrationsError = String(error && error.message ? error.message : error);
                }
            }
        }

        writePre('prefetch-debug-support', {
            speculationRules: speculationRulesSupported,
            linkPrefetch: supportsLinkPrefetch(),
            serviceWorkerApi: supportsServiceWorkerApi(),
            secureContext: !!window.isSecureContext
        });
        writePre('prefetch-debug-env', {
            runtimeEnvSequence: runtimeEnvSequence,
            payloadEntry: payload && typeof payload === 'object' ? payload[runtimeEnvSequence] || null : null,
            resolvedEnv: picked ? picked.targetEnv : null,
            runtimeCoordinationMode: ownedSlotDetails.coordinationMode,
            preemptionActive: ownedSlotDetails.preemptionActive
        });
        writePre('prefetch-debug-actions', rawActions || 'No actions for current env');
        writePre('prefetch-debug-spec-owned', ownedSlotDetails);
        writePre('prefetch-debug-actions-filtered', rawActions ? {
            filteredActions: filteredActions,
            suppressedActions: suppressedActions
        } : 'No actions for current env');
        writePre('prefetch-debug-runtime', runtimeState);
        writePre('prefetch-debug-payload', {
            runtimePayload: payload || 'No site-prefetch-data found',
            runtimeMeta: runtimeMeta || null,
            speculationRulesHeader: speculationHeaderState.header || '',
            speculationRulesPayload: speculationHeaderState.rulesPayload || null
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        void refresh();
        window.setTimeout(function () { void refresh(); }, 250);
        window.setTimeout(function () { void refresh(); }, 1200);
    });
}());
