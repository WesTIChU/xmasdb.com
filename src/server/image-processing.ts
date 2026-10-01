import fs from 'node:fs/promises';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ImageMagickExecutable = 'magick' | 'convert';
export type ImageMagickProbe = (executable: ImageMagickExecutable) => void;

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
  try {
    await execFileAsync(executable, [filePath, '-auto-orient', '-strip', '-quality', '82', `webp:${outputPath}`]);
    await fs.rename(outputPath, filePath);
  } catch (error) {
    await fs.rm(outputPath, { force: true });
    throw error;
  }
}
