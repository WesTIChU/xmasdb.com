import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const port = 3150;
const marionettePort = 2828;
const routes = [
  { path: '/', text: 'Discover Christmas Movies' },
  { path: '/movies/', text: 'All Christmas Movies' },
  { path: '/hallmark/', text: 'Hallmark Christmas Movies' },
  { path: '/lifetime/', text: 'Lifetime Christmas Movies' },
  { path: '/gaf/', text: 'GAF Christmas Movies' },
  { path: '/hallmark/2025/', text: 'Hallmark Christmas Movies' },
  { path: '/feeds/', text: 'Christmas Movie Radarr & JSON Feeds' },
  { path: '/about/', text: 'Why XmasDB Exists' },
  { path: '/privacy/', text: 'PRIVACY & AI' },
  { path: '/contact/', text: 'CONTACT XMASDB' },
  { path: '/year/2025/', text: 'Christmas Movies of 2025' },
  { path: '/movie/1773035/snow-globe-town/', text: 'Snow Globe Town' },
  { path: '/actor/65220/danica-mckellar/', text: 'Danica McKellar' },
] as const;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await wait(200);
  }
  throw new Error('Production server did not start in time.');
}

async function connectMarionette(): Promise<net.Socket> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      return await new Promise<net.Socket>((resolve, reject) => {
        const socket = net.createConnection({ host: '127.0.0.1', port: marionettePort });
        socket.once('connect', () => resolve(socket));
        socket.once('error', reject);
      });
    } catch {
      await wait(200);
    }
  }
  throw new Error('Firefox Marionette did not start in time.');
}

async function readFrame(iterator: AsyncIterator<Buffer>, pending: { value: Buffer }): Promise<unknown> {
  while (!pending.value.includes(58)) {
    const next = await iterator.next();
    if (next.done) throw new Error('Firefox Marionette closed the connection.');
    pending.value = Buffer.concat([pending.value, next.value]);
  }
  const separator = pending.value.indexOf(58);
  const length = Number(pending.value.subarray(0, separator).toString('utf8'));
  pending.value = pending.value.subarray(separator + 1);
  while (pending.value.length < length) {
    const next = await iterator.next();
    if (next.done) throw new Error('Firefox Marionette closed the connection.');
    pending.value = Buffer.concat([pending.value, next.value]);
  }
  const body = pending.value.subarray(0, length).toString('utf8');
  pending.value = pending.value.subarray(length);
  return JSON.parse(body) as unknown;
}

async function command(iterator: AsyncIterator<Buffer>, socket: net.Socket, pending: { value: Buffer }, id: number, name: string, parameters: Record<string, unknown>): Promise<any> {
  const message = JSON.stringify([0, id, name, parameters]);
  socket.write(`${Buffer.byteLength(message)}:${message}`);
  return readFrame(iterator, pending);
}

async function main(): Promise<void> {
  const server = spawn(process.execPath, ['dist/server.cjs'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
    stdio: 'ignore',
  });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-browser-'));
  const firefox = spawn('firefox', ['--headless', '--no-remote', '--marionette', '-profile', profile], { stdio: 'ignore' });
  let socket: net.Socket | undefined;
  try {
    await waitForServer();
    socket = await connectMarionette();
    const iterator = socket[Symbol.asyncIterator]();
    const pending = { value: Buffer.alloc(0) };
    await readFrame(iterator, pending); // Marionette greeting.
    const session = await command(iterator, socket, pending, 1, 'WebDriver:NewSession', { capabilities: { alwaysMatch: { browserName: 'firefox' } } });
    const sessionId = session[3]?.sessionId;
    if (!sessionId) throw new Error('Firefox did not create a browser session.');

    for (const route of routes) {
      const navigation = await command(iterator, socket, pending, 2, 'WebDriver:Navigate', { sessionId, url: `http://127.0.0.1:${port}${route.path}` });
      if (navigation[2]) throw new Error(`Could not navigate to ${route.path}: ${navigation[2].message}`);
      await wait(1500);
      const result = await command(iterator, socket, pending, 3, 'WebDriver:ExecuteScript', {
        sessionId,
        script: 'return { text: document.body.innerText, title: document.title, canonical: document.querySelector("link[rel=canonical]")?.getAttribute("href"), robots: document.querySelector("meta[name=robots]")?.getAttribute("content"), links: document.querySelectorAll("a[href]").length, resources: performance.getEntriesByType("resource").map((entry) => entry.name) };',
        args: [],
      });
      const value = result[3]?.value as { text?: string; title?: string; canonical?: string; robots?: string; links?: number; resources?: string[] } | undefined;
      if (!value?.text?.includes(route.text)) throw new Error(`${route.path} did not render ${route.text}.`);
      if (value.text.includes('Something went wrong loading this page.')) throw new Error(`${route.path} rendered the generic error state.`);
      if (!value.title || !value.canonical || value.robots !== 'index,follow' || !value.links) throw new Error(`${route.path} did not produce complete indexable page metadata.`);
      if (value.resources?.some((resource) => resource.includes(`/api/${route.path.split('/')[1]}/`))) throw new Error(`${route.path} unexpectedly fetched its entity API after bootstrapping.`);
    }
    await command(iterator, socket, pending, 4, 'WebDriver:DeleteSession', { sessionId });
    console.log('Production browser route tests passed.');
  } finally {
    socket?.destroy();
    firefox.kill('SIGTERM');
    server.kill('SIGTERM');
    await fs.rm(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[Production Browser Test] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
