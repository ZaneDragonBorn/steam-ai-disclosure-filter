import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
// Preserve the user's auto-install configuration while producing a local package.
const file = '.millennium.package.toml';
const manifest = readFileSync('millennium.toml', 'utf8');
writeFileSync(
    file,
    manifest.replace(/^output_path\s*=.*$/m, 'output_path = "ai-disclosure-filter.star"'),
    { flag: 'wx' },
);
try {
    const result = spawnSync(
        process.execPath,
        [
            'node_modules/@steambrew/starlight/bin/starlight.js',
            'pack',
            '--release',
            '--config',
            file,
        ],
        { stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} finally {
    unlinkSync(file);
}
