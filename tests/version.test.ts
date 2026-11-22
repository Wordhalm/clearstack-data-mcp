import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/server.js';

const read = (f: string) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), 'utf-8'));

describe('release metadata', () => {
    it('uses one version everywhere', () => {
        const pkg = read('package.json');
        const server = read('server.json');
        expect(VERSION).toBe(pkg.version);
        expect(read('manifest.json').version).toBe(pkg.version);
        expect(server.version).toBe(pkg.version);
        for (const p of server.packages) if (p.registryType === 'npm') expect(p.version).toBe(pkg.version);
    });

    it('matches the registry name and package name', () => {
        const pkg = read('package.json');
        const server = read('server.json');
        expect(server.name).toBe(pkg.mcpName);
        expect(server.description.length).toBeLessThanOrEqual(100);
        expect(server.packages.find((p: { registryType: string }) => p.registryType === 'npm').identifier).toBe(pkg.name);
    });
});
