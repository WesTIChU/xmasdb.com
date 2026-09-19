import fs from 'node:fs/promises';
import path from 'node:path';

/** Writes a local generated file by replacing it only after the complete file is ready. */
export async function writeFileAtomically(filePath: string, contents: string): Promise<void> {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`);
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(temporaryPath, contents, 'utf8');
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}
