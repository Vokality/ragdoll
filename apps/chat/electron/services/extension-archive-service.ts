import { mkdir, open } from "node:fs/promises";
import { extract } from "tar";

export class ExtensionArchiveService {
  private static readonly maxArchiveBytes = 50 * 1024 * 1024;
  constructor(private readonly request: typeof fetch = fetch) {}

  async downloadAndExtract(
    downloadUrl: string,
    archivePath: string,
    destinationPath: string,
  ): Promise<void> {
    const response = await this.request(downloadUrl, {
      headers: { "User-Agent": "Lumen-Extension-Installer" },
    });
    if (!response.ok || !response.body) {
      throw new Error(`Extension download failed with ${response.status}`);
    }
    await mkdir(destinationPath, { recursive: true });
    const archive = await open(archivePath, "w", 0o600);
    const reader = response.body.getReader();
    let receivedBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
        if (receivedBytes > ExtensionArchiveService.maxArchiveBytes) {
          throw new Error("Extension archive exceeds the 50 MB limit");
        }
        await archive.write(value);
      }
    } finally {
      await archive.close();
    }
    await extract({
      cwd: destinationPath,
      file: archivePath,
      gzip: true,
      preservePaths: false,
      strict: true,
      strip: 1,
    });
  }
}
