import type { Movie } from '../types';
import { generateMoviesModule } from './movie-import';

const MOVIES_PATH = 'src/data/movies.ts';
export const COMING_SOON_WORKFLOW = 'nightly-coming-soon-refresh.yml';

export interface GitHubConfig {
  token?: string;
  owner?: string;
  repo?: string;
  branch?: string;
}

interface BranchState {
  commitSha: string;
  treeSha: string;
  movies: Movie[];
}

function configFromEnv(): GitHubConfig {
  return {
    token: process.env.XMASDB_GITHUB_TOKEN,
    owner: process.env.XMASDB_GITHUB_OWNER,
    repo: process.env.XMASDB_GITHUB_REPO,
    branch: process.env.XMASDB_GITHUB_BRANCH || 'main',
  };
}

export function getGitHubConfig(): GitHubConfig {
  return configFromEnv();
}

export function isGitHubConfigured(config = configFromEnv()): boolean {
  return Boolean(config.token && config.owner && config.repo && config.branch);
}

function repositoryUrl(config: GitHubConfig, suffix: string): string {
  return `https://api.github.com/repos/${encodeURIComponent(config.owner!)}/${encodeURIComponent(config.repo!)}${suffix}`;
}

async function githubRequest<T>(config: GitHubConfig, suffix: string, init?: RequestInit): Promise<T> {
  if (!isGitHubConfigured(config)) throw new Error('GitHub catalogue integration is not configured.');
  const response = await fetch(repositoryUrl(config, suffix), {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub request failed with status ${response.status}.`);
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export class WorkflowDispatchCooldown {
  private lastDispatchAt = 0;

  constructor(private readonly cooldownMs = 5 * 60 * 1000) {}

  canDispatch(now = Date.now()): boolean {
    return now - this.lastDispatchAt >= this.cooldownMs;
  }

  record(now = Date.now()): void {
    this.lastDispatchAt = now;
  }

  remainingMs(now = Date.now()): number {
    return Math.max(0, this.cooldownMs - (now - this.lastDispatchAt));
  }
}

/** Starts the fixed Coming Soon workflow; callers cannot select another repository or workflow. */
export async function dispatchComingSoonRefresh(config = configFromEnv()): Promise<void> {
  await githubRequest<void>(config, `/actions/workflows/${COMING_SOON_WORKFLOW}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: config.branch }),
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseMoviesModule(source: string): Movie[] {
  const match = source.match(/export const MOVIES: Movie\[\] = ([\s\S]*?);\n\nexport function/);
  if (!match) throw new Error('Canonical movies module has an unexpected format.');
  const parsed: unknown = JSON.parse(match[1]);
  if (!Array.isArray(parsed)) throw new Error('Canonical movies module does not contain an array.');
  return parsed as Movie[];
}

export async function readGitHubBranch(config = configFromEnv()): Promise<BranchState> {
  const ref = await githubRequest<{ object: { sha: string } }>(config, `/git/ref/heads/${encodeURIComponent(config.branch!)}`);
  const commit = await githubRequest<{ tree: { sha: string } }>(config, `/git/commits/${ref.object.sha}`);
  const file = await githubRequest<{ content: string }>(config, `/contents/${MOVIES_PATH}?ref=${encodeURIComponent(ref.object.sha)}`);
  const source = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return { commitSha: ref.object.sha, treeSha: commit.tree.sha, movies: parseMoviesModule(source) };
}

export async function commitMoviesToGitHub(
  movies: Movie[],
  baseSha: string,
  message: string,
  config = configFromEnv(),
): Promise<{ commitSha: string }> {
  const current = await readGitHubBranch(config);
  if (current.commitSha !== baseSha) throw new Error('The XmasDB repository changed while you were reviewing these movies. Refresh the preview and try again.');
  const blob = await githubRequest<{ sha: string }>(config, '/git/blobs', {
    method: 'POST',
    body: JSON.stringify({ content: generateMoviesModule(movies), encoding: 'utf-8' }),
    headers: { 'Content-Type': 'application/json' },
  });
  const tree = await githubRequest<{ sha: string }>(config, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: current.treeSha, tree: [{ path: MOVIES_PATH, mode: '100644', type: 'blob', sha: blob.sha }] }),
    headers: { 'Content-Type': 'application/json' },
  });
  const commit = await githubRequest<{ sha: string }>(config, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] }),
    headers: { 'Content-Type': 'application/json' },
  });
  await githubRequest(config, `/git/refs/heads/${encodeURIComponent(config.branch!)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
    headers: { 'Content-Type': 'application/json' },
  });
  return { commitSha: commit.sha };
}
