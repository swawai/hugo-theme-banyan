import assert from 'node:assert/strict';
import path from 'node:path';

import * as esbuild from 'esbuild';

const policyEntry = path.join(
    process.cwd(),
    'themes/banyan/assets/js/prefetch/policy.js'
);

const build = await esbuild.build({
    bundle: true,
    entryPoints: [policyEntry],
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false
});
const source = build.outputFiles[0].text;
const policy = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

assert.deepEqual(
    [
        policy.buildRuntimeEnvironmentKey(true, true),
        policy.buildRuntimeEnvironmentKey(true, false),
        policy.buildRuntimeEnvironmentKey(false, true),
        policy.buildRuntimeEnvironmentKey(false, false)
    ],
    ['TT', 'TF', 'FT', 'FF'],
    'runtime environment keys keep the link/SW capability order'
);

const directConfig = {nav: 'link_xf'};
const aliasedConfig = {crumb: 'sw_mf_g'};
const configByEnvironment = {
    TT: directConfig,
    TF: 'FT',
    FT: aliasedConfig,
    FF: 'missing'
};
assert.deepEqual(
    policy.resolveRuntimeConfig(configByEnvironment, 'TT'),
    {targetEnv: 'TT', config: directConfig},
    'a canonical environment resolves directly'
);
assert.deepEqual(
    policy.resolveRuntimeConfig(configByEnvironment, 'TF'),
    {targetEnv: 'FT', config: aliasedConfig},
    'a compact environment alias resolves its canonical config'
);
assert.equal(
    policy.resolveRuntimeConfig(configByEnvironment, 'FF'),
    null,
    'a dangling environment alias is rejected'
);

assert.deepEqual(
    policy.parseRuntimeMode(' LINK_SF_G '),
    {eagerness: 'conservative', globalGate: true, transport: 'link'}
);
assert.deepEqual(
    policy.parseRuntimeMode('sw_mf'),
    {eagerness: 'moderate', globalGate: false, transport: 'sw'}
);
assert.deepEqual(
    policy.parseRuntimeMode('link_xf'),
    {eagerness: 'eager', globalGate: false, transport: 'link'}
);
assert.equal(policy.parseRuntimeMode('off'), null);
assert.equal(policy.parseRuntimeMode('spec_xf'), null);

assert.equal(
    policy.normalizeNavigationUrl('../next/#section', 'https://example.test/zh/current/'),
    'https://example.test/zh/next/',
    'navigation normalization resolves relative paths and removes fragments'
);
assert.equal(policy.normalizeNavigationUrl('http://[invalid', 'https://example.test/'), '');

const unsupportedCoordination = policy.resolveRuntimeCoordination({
    coordination_mode: 'preempt_runtime_when_supported',
    owned_slots: [' nav ', 'crumb', 'nav', '', null]
}, false);
assert.deepEqual(unsupportedCoordination, {
    activeOwnedSlots: [],
    browserSupportsSpeculationRules: false,
    coordinationMode: 'preempt_runtime_when_supported',
    declaredOwnedSlots: ['nav', 'crumb'],
    preemptionActive: false
});
assert.deepEqual(
    policy.resolveRuntimeCoordination({
        coordination_mode: 'preempt_runtime_when_supported',
        owned_slots: [' nav ', 'crumb', 'nav']
    }, true).activeOwnedSlots,
    ['nav', 'crumb'],
    'supported speculation rules preempt the normalized owned slots'
);
assert.deepEqual(
    policy.resolveActiveSpeculationOwnedSlots({
        coordination_mode: 'preempt_runtime_when_supported',
        owned_slots: [' nav ', 'crumb', 'nav']
    }, true),
    ['nav', 'crumb'],
    'the runtime-only resolver uses the same normalized ownership policy without debug details'
);

const pageUrl = 'https://example.test/zh/current/?probe=1#top';
const candidates = [
    {slot: 'crumb', href: '/shared/#crumb'},
    {slot: 'nav', href: '/a/#one'},
    {slot: 'nav', href: '/shared/#nav'},
    {slot: 'nav', href: pageUrl},
    {slot: 'crumb', href: '/c/'},
    {slot: 'sort', href: '/s/'},
    {slot: 'post', href: '/post/'}
];
const config = {
    nav: 'link_xf',
    crumb: 'sw_mf_g',
    sort: 'sw_sf',
    desc: 'off',
    post: 'link_sf'
};
assert.deepEqual(
    policy.buildRuntimeActions(config, candidates, pageUrl),
    {
        lx: ['https://example.test/a/', 'https://example.test/shared/'],
        wmg: ['https://example.test/c/'],
        ws: ['https://example.test/s/'],
        ls: ['https://example.test/post/']
    },
    'action planning follows slot priority, removes the current page, and deduplicates normalized URLs'
);
assert.deepEqual(
    policy.buildRuntimeActions(config, candidates, pageUrl, new Set(['nav'])),
    {
        wmg: ['https://example.test/shared/', 'https://example.test/c/'],
        ws: ['https://example.test/s/'],
        ls: ['https://example.test/post/']
    },
    'a preempted slot releases duplicate URLs to the next active slot'
);
assert.equal(
    policy.getRuntimeModeForSlot(config, 'nav', new Set(['nav'])),
    null,
    'dynamic runtime targets use the same slot preemption policy'
);

console.log('Prefetch policy checks passed.');
