// Builds release/clearstack-data-mcp-<version>.mcpb: compiled server + production dependencies + manifest.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf-8'));
if (manifest.version !== pkg.version) throw new Error(`manifest.json ${manifest.version} != package.json ${pkg.version}`);

const stage = join(root, 'build', 'mcpb');
const out = join(root, 'release', `clearstack-data-mcp-${pkg.version}.mcpb`);
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

run('npm run build');
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'server'), { recursive: true });
mkdirSync(join(root, 'release'), { recursive: true });

cpSync(join(root, 'dist'), join(stage, 'server'), { recursive: true });
cpSync(join(root, 'assets'), join(stage, 'assets'), { recursive: true });
for (const f of ['manifest.json', 'README.md', 'LICENSE']) cpSync(join(root, f), join(stage, f));
writeFileSync(
    join(stage, 'package.json'),
    JSON.stringify({ name: pkg.name, version: pkg.version, type: 'module', private: true, dependencies: pkg.dependencies }, null, 2),
);

run('npm install --omit=dev --ignore-scripts --no-audit --no-fund', stage);
run(`npx -y @anthropic-ai/mcpb pack "${stage}" "${out}"`);
console.log(`\nBuilt ${out}`);
