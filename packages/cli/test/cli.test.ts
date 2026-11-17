import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { names, Prompter, run } from '../src/index.js';
import { singular } from '../src/names.js';
import { addArrayToFeature, addImport, addToArray } from '../src/register.js';

const repo = resolve(import.meta.dir, '../../..');
// Inside the repository, so generated projects resolve zod, pino, pino-pretty and @opentelemetry/api from
// this package's devDependencies.
const tmp = join(import.meta.dir, '.tmp', String(process.pid));
mkdirSync(tmp, { recursive: true });
afterAll(() => rmSync(join(import.meta.dir, '.tmp'), { recursive: true, force: true }));

const cli = async (cwd: string, ...argv: string[]) => {
  const lines: string[] = [];
  const code = await run(argv, { cwd, log: (line) => lines.push(line) });
  return { code, output: lines.join('\n') };
};
const read = (...path: string[]) => readFileSync(join(...path), 'utf8');

/** A project created by the CLI, pointed at this repository's packages instead of npm. */
async function project(name: string, ...flags: string[]) {
  const result = await cli(tmp, 'new', name, '--skip-install', '--skip-git', ...flags);
  expect(result.code).toBe(0);
  const root = join(tmp, name);
  const tsconfig = JSON.parse(read(root, 'tsconfig.json'));
  tsconfig.compilerOptions.paths = { '@sukujs/*': [`${repo}/packages/*/src/index.ts`] };
  // The paths above make tsc check the packages' source, not their declarations, and
  // @sukujs/crypto's source (reached through @sukujs/security) needs the Web Crypto types.
  // An installed project never checks it: the starter sets skipLibCheck.
  tsconfig.compilerOptions.lib = [...tsconfig.compilerOptions.lib, 'DOM'];
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  return root;
}

const sh = (cwd: string, ...command: string[]) => {
  const result = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' });
  return { code: result.exitCode, output: `${result.stdout}${result.stderr}` };
};

describe('names', () => {
  test('every spelling gives the same casings', () => {
    for (const input of ['userProfiles', 'user_profiles', 'User Profiles', 'user-profiles']) {
      expect(names(input)).toEqual({
        kebab: 'user-profiles',
        pascal: 'UserProfiles',
        camel: 'userProfiles',
      });
    }
  });

  test('singular', () => {
    expect(
      ['users', 'categories', 'addresses', 'boxes', 'news-items', 'staff'].map(singular),
    ).toEqual(['user', 'category', 'address', 'box', 'news-item', 'staff']);
  });
});

describe('register', () => {
  test('adds to an empty, a one-line and a multi-line array, once', () => {
    expect(addToArray('x({ routes: [] })', 'routes', 'A')).toBe('x({ routes: [A] })');
    expect(addToArray('x({ routes: [A] })', 'routes', 'B')).toBe('x({ routes: [A, B] })');
    expect(addToArray('x({ routes: [A, B] })', 'routes', 'B')).toBe('x({ routes: [A, B] })');
    expect(addToArray('x({\n  routes: [\n    A,\n  ],\n})', 'routes', 'B')).toBe(
      'x({\n  routes: [\n    A,\n    B,\n  ],\n})',
    );
    expect(addToArray('x({})', 'routes', 'A')).toBeUndefined();
  });

  test('adds a missing array to a feature', () => {
    expect(addArrayToFeature("feature('a', {\n  routes: [R],\n})", 'services', 'S')).toBe(
      "feature('a', {\n  services: [S],\n  routes: [R],\n})",
    );
    expect(addArrayToFeature("feature('a', {})", 'services', 'S')).toBe(
      "feature('a', { services: [S] })",
    );
  });

  test('adds an import after the last one, once', () => {
    const source = "import { a } from 'a';\nimport {\n  b,\n} from 'b';\n\nconst x = 1;\n";
    const next = addImport(source, 'C', './c');
    expect(next).toBe(
      "import { a } from 'a';\nimport {\n  b,\n} from 'b';\nimport { C } from './c';\n\nconst x = 1;\n",
    );
    expect(addImport(next, 'C', './c')).toBe(next);
  });
});

describe('prompts', () => {
  const session = () => {
    const input = new PassThrough();
    const output = new PassThrough();
    output.resume();
    const keys = async (...sequence: string[]) => {
      for (const key of sequence) {
        await new Promise((done) => setTimeout(done, 5));
        input.write(key);
      }
    };
    return { prompter: new Prompter(input, output), keys };
  };
  const DOWN = '\x1b[B';

  test('select moves with the arrows and wraps', async () => {
    const { prompter, keys } = session();
    const choices = ['a', 'b', 'c'].map((value) => ({ value, label: value }));
    const answer = prompter.select('Pick', choices);
    await keys(DOWN, DOWN, DOWN, DOWN, '\r');
    expect(await answer).toBe('b');
  });

  test('multiselect toggles with space and may be empty', async () => {
    const { prompter, keys } = session();
    const choices = ['a', 'b', 'c'].map((value) => ({ value, label: value }));
    const some = prompter.multiselect('Pick', choices);
    await keys(' ', DOWN, DOWN, ' ', '\r');
    expect(await some).toEqual(['a', 'c']);

    const none = session();
    const empty = none.prompter.multiselect('Pick', choices);
    await none.keys('\r');
    expect(await empty).toEqual([]);
  });

  test('text and confirm take a default on enter', async () => {
    const a = session();
    const typed = a.prompter.text('Name', 'my-api');
    await a.keys('s', 'h', 'o', 'x', '\x7f', 'p', '\r');
    expect(await typed).toBe('shop');

    const b = session();
    const fallback = b.prompter.text('Name', 'my-api');
    await b.keys('\r');
    expect(await fallback).toBe('my-api');

    const c = session();
    const no = c.prompter.confirm('Sure?');
    await c.keys('n');
    expect(await no).toBe(false);
  });

  test('suku new asks for whatever the flags left open', async () => {
    const { prompter, keys } = session();
    const lines: string[] = [];
    const done = run(['new', '--dry-run'], { cwd: tmp, log: (line) => lines.push(line), prompter });
    // name, runtime: Bun, package manager: bun, deploy: Docker + Vercel, git: no, install: no
    await keys(
      'a',
      's',
      'k',
      'e',
      'd',
      '\r',
      DOWN,
      '\r',
      '\r',
      ' ',
      DOWN,
      DOWN,
      DOWN,
      DOWN,
      ' ',
      '\r',
      'n',
      'n',
    );
    expect(await done).toBe(0);
    const output = lines.join('\n');
    expect(output).toContain('CREATE Dockerfile');
    expect(output).toContain('CREATE api/index.ts');
    expect(output).not.toContain('wrangler.jsonc');
    expect(existsSync(join(tmp, 'asked'))).toBe(false);
  });
});

describe('suku generate', () => {
  test('refuses outside a project and for unknown schematics', async () => {
    const outside = join(tmp, 'empty');
    mkdirSync(outside, { recursive: true });
    expect((await cli(outside, 'g', 'feature', 'x')).output).toContain('No package.json here');
    const root = await project('refuses');
    expect((await cli(root, 'g', 'widget', 'x')).output).toContain('Unknown schematic "widget"');
    expect((await cli(root, 'bogus')).code).toBe(1);
  });

  test('feature, routes and service register themselves', async () => {
    const root = await project('pieces');
    expect((await cli(root, 'g', 'feature', 'billing')).code).toBe(0);
    expect((await cli(root, 'g', 'routes', 'billing')).code).toBe(0);
    expect((await cli(root, 'g', 's', 'billing')).code).toBe(0);
    expect((await cli(root, 'g', 'mw', 'audit')).code).toBe(0);

    expect(read(root, 'src/app.feature.ts')).toContain('imports: [HelloFeature, BillingFeature]');
    expect(read(root, 'src/app.feature.ts')).toContain(
      "import { BillingFeature } from './billing/billing.feature';",
    );
    const feature = read(root, 'src/billing/billing.feature.ts');
    expect(feature).toContain('routes: [BillingRoutes]');
    expect(feature).toContain('services: [BillingService]');
    expect(existsSync(join(root, 'src/middlewares/audit.middleware.ts'))).toBe(true);
  });

  test('--dry-run writes nothing and an existing file is not overwritten', async () => {
    const root = await project('careful');
    const dry = await cli(root, 'g', 'resource', 'orders', '--dry-run');
    expect(dry.output).toContain('CREATE src/orders/orders.routes.ts');
    expect(dry.output).toContain('UPDATE src/app.feature.ts');
    expect(existsSync(join(root, 'src/orders'))).toBe(false);
    expect(read(root, 'src/app.feature.ts')).not.toContain('Orders');

    const again = await cli(root, 'g', 'service', 'hello');
    expect(again.code).toBe(1);
    expect(again.output).toContain('Refusing to overwrite src/hello/hello.service.ts');
  });

  test('--classless generates functions, nested names generate nested folders', async () => {
    const root = await project('classless');
    await cli(root, 'g', 'feature', 'admin/reports');
    await cli(root, 'g', 'routes', 'admin/reports', '--classless');
    await cli(root, 'g', 'service', 'admin/reports', '--classless');
    expect(read(root, 'src/admin/reports/reports.routes.ts')).toContain("route.group('/reports'");
    expect(read(root, 'src/admin/reports/reports.feature.ts')).toContain('routes: [reportsRoutes]');
    expect(read(root, 'src/app.feature.ts')).toContain("from './admin/reports/reports.feature'");
  });
});

describe('a generated project', () => {
  test('passes its own tests, with a generated resource, and typechecks', async () => {
    const root = await project('shop', '--deploy', 'docker,pm2,systemd,cloudflare,vercel');
    for (const file of [
      'Dockerfile',
      'docker-compose.yml',
      'ecosystem.config.cjs',
      'deploy/shop.service',
      'src/worker.ts',
      'wrangler.jsonc',
      'api/index.ts',
      'vercel.json',
    ]) {
      expect(existsSync(join(root, file))).toBe(true);
    }
    expect(JSON.parse(read(root, 'package.json')).scripts['deploy:cloudflare']).toBe(
      'wrangler deploy',
    );
    expect(JSON.parse(read(root, 'package.json')).dependencies['@sukujs/security']).toBeDefined();
    expect(read(root, 'Dockerfile')).toContain('bun install --frozen-lockfile');
    const { dependencies } = JSON.parse(read(root, 'package.json'));
    expect(dependencies.pino).toBeDefined();
    expect(dependencies['pino-pretty']).toBeDefined();
    expect(dependencies['@opentelemetry/api']).toBeDefined();
    expect(read(root, 'src/main.ts')).toContain('services: [singleton(Logger, PinoLogger)]');
    // Every entry point of the starter sets the defensive headers.
    for (const entry of ['src/main.ts', 'src/worker.ts', 'api/index.ts']) {
      expect(read(root, entry)).toContain('securityHeaders()]');
    }

    expect((await cli(root, 'g', 'resource', 'products')).code).toBe(0);
    expect((await cli(root, 'g', 'res', 'categories', '--skip-tests')).code).toBe(0);
    expect(read(root, 'src/categories/categories.schemas.ts')).toContain(
      'export interface Category',
    );

    const tests = sh(root, 'bun', 'test');
    expect(tests.output).toContain('3 pass');
    expect(tests.code).toBe(0);

    const types = sh(root, 'bunx', 'tsc', '--noEmit', '-p', 'tsconfig.json');
    expect(types.output).toBe('');
  }, 120_000);

  test('builds, starts on Node, serves requests and shuts down on SIGTERM', async () => {
    const root = await project('served');
    await cli(root, 'g', 'resource', 'products');
    const built = sh(root, 'bun', join(repo, 'packages/cli/src/bin.ts'), 'build');
    expect(built.code).toBe(0);
    expect(built.output).toContain('Built for node');

    const server = Bun.spawn(['bun', join(repo, 'packages/cli/src/bin.ts'), 'start'], {
      cwd: root,
      env: { ...process.env, PORT: '0' },
      stdout: 'pipe',
    });
    // The app logs with pino: every line of stdout is one JSON object.
    const reader = server.stdout.getReader();
    let text = '';
    const logged = async (msg: string): Promise<Record<string, unknown>> => {
      for (;;) {
        const lines = text.split('\n').filter((line) => line.startsWith('{'));
        const entry = lines.map((line) => JSON.parse(line)).find((e) => e.msg.startsWith(msg));
        if (entry) return entry;
        const { value, done } = await reader.read();
        if (done) throw new Error(`No "${msg}" log line in:\n${text}`);
        text += new TextDecoder().decode(value);
      }
    };
    const url = /listening on (\S+)/.exec((await logged('listening on')).msg as string)?.[1];
    expect(url).toBeDefined();
    const hello = await fetch(`${url}/hello/Ada`);
    expect(await hello.json()).toEqual({ message: 'Hello, Ada!' });
    expect(await logged('request')).toMatchObject({
      level: 30,
      method: 'GET',
      path: '/hello/Ada',
      status: 200,
      duration_ms: expect.any(Number),
    });
    expect(hello.headers.get('x-content-type-options')).toBe('nosniff');
    expect(hello.headers.get('content-security-policy')).toContain("default-src 'none'");
    // Unmatched routes get the headers too.
    expect((await fetch(`${url}/nope`)).headers.get('x-frame-options')).toBe('DENY');
    expect(await (await fetch(`${url}/products`)).json()).toEqual([]);
    server.kill('SIGTERM');
    expect(await server.exited).toBe(0);
  }, 120_000);

  test('log lines carry the ids of the active OpenTelemetry span', async () => {
    const root = await project('traced');
    // Stands in for an OpenTelemetry SDK: makes a span active, then logs inside and outside it.
    writeFileSync(
      join(root, 'trace-check.ts'),
      `import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { context, trace } from '@opentelemetry/api';
import { PinoLogger } from './src/logger';

context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
const format = process.env.LOG_FORMAT as 'pretty' | undefined;
const logger = new PinoLogger({ PORT: 0, LOG_LEVEL: 'debug', LOG_FORMAT: format });
const span = trace.wrapSpanContext({
  traceId: '0af7651916cd43dd8448eb211c80319c',
  spanId: 'b7ad6b7169203331',
  traceFlags: 1,
});
context.with(trace.setSpan(context.active(), span), () => logger.debug('inside', { user: 7 }));
logger.error(new Error('outside'));
`,
    );
    const result = sh(root, 'bun', 'trace-check.ts');
    expect(result.code).toBe(0);
    // Not a terminal, so the lines are JSON.
    const [inside, outside] = result.output
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(inside).toMatchObject({
      level: 20,
      msg: 'inside',
      user: 7,
      trace_id: '0af7651916cd43dd8448eb211c80319c',
      span_id: 'b7ad6b7169203331',
      trace_flags: '01',
    });
    expect(outside).toMatchObject({
      level: 50,
      msg: 'outside',
      err: { type: 'Error', message: 'outside', stack: expect.any(String) },
    });
    expect(outside.trace_id).toBeUndefined();

    // LOG_FORMAT=pretty gives the same two entries through pino-pretty.
    const pretty = Bun.spawnSync(['bun', 'trace-check.ts'], {
      cwd: root,
      env: { ...process.env, LOG_FORMAT: 'pretty' },
    });
    const lines = pretty.stdout.toString().split('\n');
    expect(lines[0]).toMatch(
      /^\[\d{4}-\d\d-\d\d .+\] DEBUG: inside \{"trace_id":"0af7651916cd43dd8448eb211c80319c",.*"user":7\}$/,
    );
    expect(lines[1]).toMatch(/^\[.+\] ERROR: outside/);
    expect(pretty.stdout.toString()).toContain('Error: outside\n');
  }, 60_000);

  test('the Worker bundle keeps constructor injection working', async () => {
    const root = await project('edge', '--deploy', 'cloudflare');
    const pkg = JSON.parse(read(root, 'package.json'));
    const built = sh(root, ...pkg.scripts['build:worker'].split(' '));
    expect(built.code).toBe(0);
    const worker = (await import(join(root, 'dist/worker.js'))).default as {
      fetch: (request: Request, env: Record<string, unknown>) => Promise<Response>;
    };
    const response = await worker.fetch(new Request('http://edge/hello/Ada'), {});
    expect(await response.json()).toEqual({ message: 'Hello, Ada!' });
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  }, 60_000);
});

describe('suku', () => {
  test('--help, --version and info', async () => {
    expect((await cli(tmp, '--help')).output).toContain('generate <schematic> <name>');
    const version = JSON.parse(read(repo, 'packages/cli/package.json')).version;
    expect((await cli(tmp, '--version')).output).toBe(version);
    expect((await cli(tmp, 'info')).output).toContain(`Suku CLI   ${version}`);
  });

  test('new refuses a non-empty folder and unknown options', async () => {
    await project('taken');
    expect((await cli(tmp, 'new', 'taken', '--yes', '--skip-install')).output).toContain(
      'not empty',
    );
    expect((await cli(tmp, 'new', 'x', '--deploy', 'heroku', '--yes')).output).toContain(
      'Unknown deployment target',
    );
    expect((await cli(tmp, 'new', 'x', '--runtime', 'deno', '--yes')).output).toContain(
      'must be "node" or "bun"',
    );
    expect((await cli(tmp, 'new', '--yes')).output).toContain('Usage: suku new <name>');
  });
});
