import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEO_SCRIPT = path.join(ROOT, 'scripts', 'generate-seo.js');
let refreshQueue = Promise.resolve();

export function refreshSeoOutput() {
  const currentRefresh = refreshQueue.then(async () => {
    const { stdout, stderr } = await execFileAsync(process.execPath, [SEO_SCRIPT], {
      cwd: ROOT,
      maxBuffer: 1024 * 1024
    });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  });

  refreshQueue = currentRefresh.catch(() => {});
  return currentRefresh;
}
