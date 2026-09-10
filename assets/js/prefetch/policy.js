export const PREFETCH_SLOT_ORDER = Object.freeze(['nav', 'crumb', 'sort', 'desc', 'post']);

export function buildRuntimeEnvironmentKey(linkPrefetchSupported, serviceWorkerSupported) {
    return `${linkPrefetchSupported ? 'T' : 'F'}${serviceWorkerSupported ? 'T' : 'F'}`;
}

export function resolveRuntimeConfig(configByEnvironment, environmentKey) {
    if (!configByEnvironment || typeof configByEnvironment !== 'object') return null;

    const entry = configByEnvironment[environmentKey] || null;
    if (!entry) return null;

    if (typeof entry === 'string') {
        const target = configByEnvironment[entry] || null;
        return target && typeof target === 'object'
            ? { targetEnv: entry, config: target }
            : null;
    }

    return typeof entry === 'object'
        ? { targetEnv: environmentKey, config: entry }
        : null;
}

export function parseRuntimeMode(rawValue) {
    const raw = String(rawValue || '').trim().toLowerCase();
    if (!raw || raw === 'off' || raw === '<nil>') return null;

    const globalGate = raw.endsWith('_g');
    const normalized = globalGate ? raw.slice(0, -2) : raw;
    const match = /^(link|sw)_([smx])f$/.exec(normalized);
    if (!match) return null;

    return {
        eagerness: match[2] === 's'
            ? 'conservative'
            : match[2] === 'm'
                ? 'moderate'
                : 'eager',
        globalGate,
        transport: match[1]
    };
}

export function normalizeNavigationUrl(rawUrl, baseUrl) {
    try {
        const url = new URL(rawUrl, baseUrl);
        url.hash = '';
        return url.toString();
    } catch (error) {
        return '';
    }
}

function readRuntimeCoordinationMode(runtimeMeta) {
    return runtimeMeta && runtimeMeta.coordination_mode
        ? String(runtimeMeta.coordination_mode)
        : 'independent';
}

function normalizeDeclaredOwnedSlots(runtimeMeta) {
    const declared = Array.isArray(runtimeMeta && runtimeMeta.owned_slots)
        ? runtimeMeta.owned_slots
        : [];
    const declaredOwnedSlots = [];
    const seenSlots = new Set();

    for (const rawSlot of declared) {
        const slot = typeof rawSlot === 'string' ? rawSlot.trim() : '';
        if (!slot || seenSlots.has(slot)) continue;
        seenSlots.add(slot);
        declaredOwnedSlots.push(slot);
    }

    return declaredOwnedSlots;
}

function isRuntimePreemptionActive(runtimeMeta, speculationRulesSupported) {
    return readRuntimeCoordinationMode(runtimeMeta) === 'preempt_runtime_when_supported'
        && Boolean(speculationRulesSupported);
}

export function resolveActiveSpeculationOwnedSlots(runtimeMeta, speculationRulesSupported) {
    return isRuntimePreemptionActive(runtimeMeta, speculationRulesSupported)
        ? normalizeDeclaredOwnedSlots(runtimeMeta)
        : [];
}

export function resolveRuntimeCoordination(runtimeMeta, speculationRulesSupported) {
    const declaredOwnedSlots = normalizeDeclaredOwnedSlots(runtimeMeta);

    const coordinationMode = readRuntimeCoordinationMode(runtimeMeta);
    const browserSupportsSpeculationRules = Boolean(speculationRulesSupported);
    const preemptionActive = isRuntimePreemptionActive(runtimeMeta, speculationRulesSupported);

    return {
        activeOwnedSlots: preemptionActive ? declaredOwnedSlots : [],
        browserSupportsSpeculationRules,
        coordinationMode,
        declaredOwnedSlots,
        preemptionActive
    };
}

function toRuntimeActionKey(mode) {
    if (!mode) return '';

    const transportCode = mode.transport === 'link' ? 'l' : mode.transport === 'sw' ? 'w' : '';
    if (!transportCode) return '';

    const eagernessCode = mode.eagerness === 'conservative'
        ? 's'
        : mode.eagerness === 'moderate'
            ? 'm'
            : 'x';
    return `${transportCode}${eagernessCode}${mode.globalGate ? 'g' : ''}`;
}

export function getRuntimeModeForSlot(config, slot, suppressedSlots = null) {
    if (!slot || !config || typeof config !== 'object') return null;
    if (suppressedSlots && suppressedSlots.has(slot)) return null;
    return parseRuntimeMode(config[slot]);
}

export function buildRuntimeActions(config, candidates, pageUrl, suppressedSlots = null) {
    if (!config || typeof config !== 'object' || !Array.isArray(candidates)) return {};

    const currentUrl = normalizeNavigationUrl(pageUrl, pageUrl);
    const actions = {};
    const seenUrls = new Set();

    for (const slot of PREFETCH_SLOT_ORDER) {
        const mode = getRuntimeModeForSlot(config, slot, suppressedSlots);
        if (!mode) continue;

        const actionKey = toRuntimeActionKey(mode);
        if (!actionKey) continue;

        const urls = [];
        for (const candidate of candidates) {
            if (!candidate || candidate.slot !== slot) continue;

            const href = normalizeNavigationUrl(candidate.href, pageUrl);
            if (!href || href === currentUrl || seenUrls.has(href)) continue;
            seenUrls.add(href);
            urls.push(href);
        }

        if (urls.length > 0) {
            actions[actionKey] = (actions[actionKey] || []).concat(urls);
        }
    }

    return actions;
}
