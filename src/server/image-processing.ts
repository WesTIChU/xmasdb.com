import fs from 'node:fs/promises';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ImageMagickExecutable = 'magick' | 'convert';
export type ImageMagickProbe = (executable: ImageMagickExecutable) => void;
export type ImageMagickOperation = 'convert' | 'identify';

export interface ImageMagickCommand {
  executable: string;
  args: string[];
}

/** Builds the correct command shape for ImageMagick 6 or 7. */
export function buildImageMagickCommand(executable: ImageMagickExecutable, operation: ImageMagickOperation, args: string[]): ImageMagickCommand {
  if (operation === 'identify' && executable === 'convert') return { executable: 'identify', args: [...args] };
  if (operation === 'identify') return { executable, args: ['identify', ...args] };
  return { executable, args: [...args] };
}

function defaultImageMagickProbe(executable: ImageMagickExecutable): void {
  execFileSync(executable, ['-version'], { stdio: 'ignore' });
}

/** Returns ImageMagick 7's command, or ImageMagick 6's compatible fallback. */
export function detectImageMagickExecutable(probe: ImageMagickProbe = defaultImageMagickProbe): ImageMagickExecutable | undefined {
  for (const executable of ['magick', 'convert'] as const) {
    try {
      probe(executable);
      return executable;
    } catch {
      // Try the next supported ImageMagick command.
    }
  }
  return undefined;
}

export function requireImageMagickExecutable(): ImageMagickExecutable {
  const executable = detectImageMagickExecutable();
  if (!executable) throw new Error('ImageMagick is required but neither magick nor convert is available.');
  return executable;
}

/** Converts an image to genuine WebP bytes in place using ImageMagick. */
export async function convertImageToWebp(filePath: string): Promise<void> {
  const outputPath = `${filePath}.converted.webp`;
  const executable = requireImageMagickExecutable();
  const command = buildImageMagickCommand(executable, 'convert', [filePath, '-auto-orient', '-strip', '-quality', '82', `webp:${outputPath}`]);
  try {
    await execFileAsync(command.executable, command.args);
    await fs.rename(outputPath, filePath);
  } catch (error) {
    await fs.rm(outputPath, { force: true });
    throw error;
  }
}
