import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Converts an image to genuine WebP bytes in place using ImageMagick. */
export async function convertImageToWebp(filePath: string): Promise<void> {
  const outputPath = `${filePath}.converted.webp`;
  try {
    await execFileAsync('magick', [filePath, '-auto-orient', '-strip', '-quality', '82', `webp:${outputPath}`]);
    await fs.rename(outputPath, filePath);
  } catch (error) {
    await fs.rm(outputPath, { force: true });
    throw error;
  }
}
