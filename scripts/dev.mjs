import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const { hashSync } = require('bcryptjs');

dotenv.config({ path: join(projectRoot, '.env.local'), quiet: true });

const localDatabaseHost = '127.0.0.1';
const localDatabasePort = 55432;
const localDatabaseUrl = `postgresql://postgres:postgres@${localDatabaseHost}:${localDatabasePort}/postgres?sslmode=disable`;
const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
const useEmbeddedDatabase = !configuredDatabaseUrl;

const environment = {
  ...process.env,
  DATABASE_URL: configuredDatabaseUrl || localDatabaseUrl,
};

if (!environment.ADMIN_USERNAME) {
  environment.ADMIN_USERNAME = 'admin';
}

let generatedPassword;
if (!environment.ADMIN_PASSWORD_HASH) {
  generatedPassword = randomBytes(9).toString('base64url');
  environment.ADMIN_PASSWORD_HASH = hashSync(generatedPassword, 12);
}

if (!environment.JWT_SECRET) {
  environment.JWT_SECRET = randomBytes(32).toString('base64url');
}

if (!environment.CAPTCHA_SECRET) {
  environment.CAPTCHA_SECRET = randomBytes(32).toString('base64url');
}

const prismaCli = join(projectRoot, 'node_modules', 'prisma', 'build', 'index.js');
const nextCli = join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const pgliteEntry = require.resolve('@electric-sql/pglite-socket');
const pgliteServer = join(dirname(pgliteEntry), 'scripts', 'server.js');
const pgliteData = join(projectRoot, 'data', 'pglite');

let databaseProcess;
let nextProcess;
let isStopping = false;

function isPortReachable(host, port, timeout = 500) {
  return new Promise(resolve => {
    const socket = createConnection({ host, port });
    const finish = value => {
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function waitForDatabase() {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (databaseProcess?.exitCode !== null && databaseProcess?.exitCode !== undefined) {
      throw new Error(`Local database exited with code ${databaseProcess.exitCode}`);
    }
    if (await isPortReachable(localDatabaseHost, localDatabasePort)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  throw new Error('Timed out while starting the local database');
}

function run(command, args, options = {}) {
  return spawn(command, args, {
    cwd: projectRoot,
    env: environment,
    stdio: 'inherit',
    ...options,
  });
}

function runToCompletion(command, args) {
  return new Promise((resolve, reject) => {
    const child = run(command, args);
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function stop(exitCode = 0) {
  if (isStopping) return;
  isStopping = true;

  if (nextProcess?.exitCode === null) nextProcess.kill('SIGTERM');
  if (databaseProcess?.exitCode === null) databaseProcess.kill('SIGTERM');

  process.exitCode = exitCode;
}

async function main() {
  if (useEmbeddedDatabase) {
    const databaseAlreadyRunning = await isPortReachable(localDatabaseHost, localDatabasePort);
    if (databaseAlreadyRunning) {
      console.log(`Using the existing local database on ${localDatabaseHost}:${localDatabasePort}.`);
    } else {
      console.log(`Starting the local development database in ${pgliteData}.`);
      mkdirSync(dirname(pgliteData), { recursive: true });
      databaseProcess = run(process.execPath, [
        pgliteServer,
        `--db=${pgliteData}`,
        `--host=${localDatabaseHost}`,
        `--port=${localDatabasePort}`,
        '--max-connections=20',
      ]);
      await waitForDatabase();
    }
  } else {
    console.log('Using DATABASE_URL from the environment or .env.local.');
  }

  console.log('Applying database migrations.');
  await runToCompletion(process.execPath, [prismaCli, 'migrate', 'deploy']);

  if (generatedPassword) {
    console.log(`Local admin for this run: ${environment.ADMIN_USERNAME} / ${generatedPassword}`);
    console.log('Set ADMIN_PASSWORD_HASH in .env.local when you want a persistent password.');
  }

  nextProcess = run(process.execPath, [nextCli, 'dev', ...process.argv.slice(2)]);
  nextProcess.once('error', error => {
    console.error('Could not start Next.js:', error.message);
    stop(1);
  });
  nextProcess.once('exit', code => stop(code ?? 0));
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

main().catch(error => {
  console.error(`Development server failed: ${error instanceof Error ? error.message : String(error)}`);
  stop(1);
});
