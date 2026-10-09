import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export const nativeFileService = {
  saveTextFile(name: string, contents: string) {
    if (!contents.trim()) throw new Error("The export is empty.");
    const file = new File(Paths.cache, name.replace(/[^a-zA-Z0-9._-]/g, "-"));
    file.write(contents);
    return file;
  },
  async shareFile(file: File) {
    if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
    await Sharing.shareAsync(file.uri, { mimeType: "text/csv", dialogTitle: "Share Hisaab report" });
  },
  cleanupTemporaryFile(file: File) { try { file.delete(); } catch { /* cache cleanup is best effort */ } },
};
