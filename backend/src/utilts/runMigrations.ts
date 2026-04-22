import { spawn } from 'child_process';
import path from 'path';

/**
 * Runs database migrations using node-pg-migrate at app startup.
 * Portable across any deployment platform — EB, ECS, Docker, K8s, bare VM.
 *
 * Reads connection from DATABASE_URL or DataBaseUrl env var.
 * Skip with SKIP_MIGRATIONS=true (useful for local dev or read replicas).
 */
export function runMigrations(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (process.env.SKIP_MIGRATIONS === 'true') {
            console.log('[migrations] SKIP_MIGRATIONS=true — skipping');
            return resolve();
        }

        const databaseUrl = process.env.DATABASE_URL || process.env.DataBaseUrl;
        if (!databaseUrl) {
            console.warn('[migrations] No DATABASE_URL set — skipping');
            return resolve();
        }

        console.log('[migrations] Running pending migrations...');

        // Use node to run the CJS entry point directly, avoiding binary symlink issues
        const cjsBin = path.resolve(process.cwd(), 'node_modules/node-pg-migrate/bin/node-pg-migrate.js');

        const child = spawn(process.execPath, [cjsBin, 'up'], {
            env: { ...process.env, DATABASE_URL: databaseUrl },
            stdio: 'inherit',
        });

        child.on('error', (err) => {
            console.error('[migrations] Failed to spawn:', err);
            reject(err);
        });

        child.on('exit', (code) => {
            if (code === 0) {
                console.log('[migrations] Done');
                resolve();
            } else {
                reject(new Error(`Migration exited with code ${code}`));
            }
        });
    });
}
