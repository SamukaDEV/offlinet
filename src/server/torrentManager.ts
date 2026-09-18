import WebTorrent from "webtorrent";
import fs from "fs";
import path from "path";
import { DATA_PATHS, storageRepo, torrentRepo } from "./db";
import { scanStorageRoot } from "./scanner";
import type { TorrentItem, TorrentFileItem, TorrentStatus } from "../types";

class TorrentManager {
  private client: WebTorrent.Instance | null = null;
  private isInitialized = false;
  private lastProgressSave = 0;

  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      this.client = new WebTorrent({
        dht: true,
      });

      this.client.on("error", (err: any) => {
        console.error("[WebTorrent Engine Error]:", err?.message || err);
      });

      console.log("[TorrentManager] Cliente WebTorrent inicializado com sucesso.");

      // Resume existing active downloads from DB
      this.restorePersistedTorrents();

      // Periodic state checkpoint (every 5 seconds) to keep DB stats updated
      setInterval(() => {
        this.persistRunningStats();
      }, 5000);
    } catch (err: any) {
      console.error("[TorrentManager] Falha ao inicializar WebTorrent:", err);
    }
  }

  private restorePersistedTorrents() {
    try {
      const persisted = torrentRepo.getAll();
      for (const item of persisted) {
        // Only resume if marked as downloading or seeding
        if (item.status === "downloading" || item.status === "seeding") {
          const torrentSource = item.torrentFilePath && fs.existsSync(item.torrentFilePath)
            ? fs.readFileSync(item.torrentFilePath)
            : item.magnetUri;

          if (torrentSource && fs.existsSync(item.downloadDir)) {
            console.log(`[TorrentManager] Retomando torrent: ${item.name || item.infoHash}`);
            this.startTorrentDownload(torrentSource, {
              infoHash: item.infoHash,
              name: item.name,
              storageId: item.storageId,
              downloadDir: item.downloadDir,
              targetFolder: item.targetFolder,
              initialStatus: item.status,
            });
          }
        }
      }
    } catch (err) {
      console.error("[TorrentManager] Erro ao restaurar torrents do banco:", err);
    }
  }

  public async addTorrent(params: {
    magnetUri?: string;
    torrentBuffer?: Buffer;
    torrentFileName?: string;
    storageId?: string;
    targetFolder?: string;
  }): Promise<TorrentItem> {
    if (!this.client) {
      throw new Error("Cliente de torrents ainda não inicializado");
    }

    if (!params.magnetUri && !params.torrentBuffer) {
      throw new Error("É necessário fornecer um magnet link ou um arquivo .torrent");
    }

    // Determine target storage root
    const roots = storageRepo.getAll().filter((r) => r.isActive);
    if (roots.length === 0) {
      throw new Error("Nenhum volume de armazenamento ativo encontrado no OffliNet");
    }

    const selectedStorage = params.storageId
      ? roots.find((r) => r.id === params.storageId) || roots[0]
      : roots[0];

    // Determine target directory
    const cleanFolder = (params.targetFolder || "Filmes").replace(/^[\\\/]+|[\\\/]+$/g, "");
    const destDir = cleanFolder ? path.join(selectedStorage.path, cleanFolder) : selectedStorage.path;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    let torrentSource: string | Buffer;
    let savedTorrentPath: string | undefined;

    // Extract display name from magnet if available
    let initialName = params.torrentFileName?.replace(/\.torrent$/i, "") || "";
    if (!initialName && params.magnetUri) {
      try {
        const dnMatch = params.magnetUri.match(/[?&]dn=([^&]+)/);
        if (dnMatch) {
          initialName = decodeURIComponent(dnMatch[1].replace(/\+/g, " "));
        }
      } catch {}
    }
    if (!initialName) initialName = "Download Torrent";

    if (params.torrentBuffer) {
      torrentSource = params.torrentBuffer;
    } else if (params.magnetUri) {
      torrentSource = params.magnetUri.trim();
    } else {
      throw new Error("Fonte de torrent inválida");
    }

    // Extract infoHash candidate from magnet if available
    let candidateHash = "";
    if (params.magnetUri) {
      const match = params.magnetUri.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
      if (match) candidateHash = match[1].toLowerCase();
    }

    // If torrent is already active in client, return it
    if (candidateHash) {
      const existing = this.getActiveTorrent(candidateHash);
      if (existing) {
        return this.mapTorrentToItem(
          existing,
          selectedStorage.id,
          selectedStorage.name,
          destDir,
          cleanFolder,
          candidateHash,
          initialName
        );
      }
    }

    let torrent: WebTorrent.Torrent;
    try {
      torrent = this.client.add(torrentSource, { path: destDir });
    } catch (err: any) {
      if (err?.message?.includes("duplicate torrent")) {
        const hashMatch = err.message.match(/duplicate torrent ([a-f0-9]+)/i);
        const dupHash = (hashMatch ? hashMatch[1] : candidateHash).toLowerCase();
        const t = this.getActiveTorrent(dupHash);
        if (t) {
          return this.mapTorrentToItem(
            t,
            selectedStorage.id,
            selectedStorage.name,
            destDir,
            cleanFolder,
            dupHash,
            initialName
          );
        }
      }
      throw err;
    }
    let infoHash = (typeof torrent.infoHash === "string" ? torrent.infoHash.toLowerCase() : "") || candidateHash || ("pending_" + Date.now());

    // If torrent buffer was uploaded, save .torrent file
    if (params.torrentBuffer && infoHash && !infoHash.startsWith("pending_")) {
      const fileName = `${infoHash}.torrent`;
      savedTorrentPath = path.join(DATA_PATHS.torrentsDir, fileName);
      try {
        fs.writeFileSync(savedTorrentPath, params.torrentBuffer);
      } catch (e) {
        console.warn("[TorrentManager] Não foi possível salvar arquivo .torrent:", e);
      }
    }

    // Save to DB immediately
    torrentRepo.upsert({
      infoHash,
      name: torrent.name || initialName,
      magnetUri: params.magnetUri,
      torrentFilePath: savedTorrentPath,
      storageId: selectedStorage.id,
      downloadDir: destDir,
      targetFolder: cleanFolder,
      status: torrent.ready ? "downloading" : "metadata",
      addedAt: Date.now(),
      totalSize: torrent.length || 0,
      downloadedBytes: torrent.downloaded || 0,
      uploadedBytes: torrent.uploaded || 0,
    });

    this.attachTorrentEvents(torrent, selectedStorage.id, infoHash);

    return this.mapTorrentToItem(
      torrent,
      selectedStorage.id,
      selectedStorage.name,
      destDir,
      cleanFolder,
      infoHash,
      initialName
    );
  }

  private startTorrentDownload(
    source: string | Buffer,
    meta: {
      infoHash: string;
      name: string;
      storageId: string;
      downloadDir: string;
      targetFolder?: string;
      initialStatus?: TorrentStatus;
    }
  ) {
    if (!this.client) return;

    try {
      // Check if already in client
      const existing = this.getActiveTorrent(meta.infoHash);
      if (existing) return;

      this.client.add(
        source,
        { path: meta.downloadDir },
        (torrent) => {
          this.attachTorrentEvents(torrent, meta.storageId, meta.infoHash);
        }
      );
    } catch (err) {
      console.error(`[TorrentManager] Erro ao retomar ${meta.infoHash}:`, err);
    }
  }

  private attachTorrentEvents(torrent: WebTorrent.Torrent, storageId: string, fallbackHash?: string) {
    const getHash = () => (torrent.infoHash || fallbackHash || "").toLowerCase();

    torrent.on("ready", () => {
      const infoHash = getHash();
      console.log(`[TorrentManager] Metadados prontos para: "${torrent.name}" (${infoHash})`);
      const existing = torrentRepo.getByInfoHash(infoHash);
      if (existing) {
        torrentRepo.upsert({
          ...existing,
          name: torrent.name || existing.name,
          totalSize: torrent.length || existing.totalSize,
          status: torrent.done ? "completed" : "downloading",
        });
      }
    });

    torrent.on("done", () => {
      const infoHash = getHash();
      console.log(`[TorrentManager] 🎉 Download concluído: "${torrent.name}"!`);
      torrentRepo.updateStatus(infoHash, "completed", undefined, Date.now());
      torrentRepo.updateProgress(infoHash, torrent.downloaded, torrent.uploaded, torrent.length);

      // Auto-scan storage root so the new movie/series/audio appears in the catalog immediately!
      setTimeout(() => {
        console.log(`[TorrentManager] Disparando escaneamento automático no volume: ${storageId}`);
        scanStorageRoot(storageId).catch((err) => {
          console.error("[TorrentManager] Erro ao auto-escanear pasta após torrent:", err);
        });
      }, 1000);
    });

    torrent.on("error", (err: any) => {
      const infoHash = getHash();
      console.error(`[TorrentManager] Erro no download (${torrent.name}):`, err);
      torrentRepo.updateStatus(infoHash, "error", err?.message || String(err));
    });
  }

  public getActiveTorrent(infoHash: string): WebTorrent.Torrent | undefined {
    if (!this.client) return undefined;
    const lower = infoHash.toLowerCase();
    return this.client.torrents.find((t) => {
      if (t.infoHash && t.infoHash.toLowerCase() === lower) return true;
      if (t.magnetURI && t.magnetURI.toLowerCase().includes(lower)) return true;
      return false;
    });
  }

  public async pauseTorrent(infoHash: string): Promise<boolean> {
    const hash = infoHash.toLowerCase();
    const torrent = this.getActiveTorrent(hash) || (await this.client?.get(hash).catch(() => undefined));

    if (torrent && typeof torrent.pause === "function") {
      try {
        torrent.pause();
      } catch (e) {
        console.warn("[TorrentManager] Erro ao pausar torrent:", e);
      }
    }

    torrentRepo.updateStatus(hash, "paused");
    return true;
  }

  public async resumeTorrent(infoHash: string): Promise<boolean> {
    const hash = infoHash.toLowerCase();
    const torrent = this.getActiveTorrent(hash) || (await this.client?.get(hash).catch(() => undefined));

    if (torrent && typeof torrent.resume === "function") {
      try {
        torrent.resume();
        torrentRepo.updateStatus(hash, "downloading");
        return true;
      } catch (e) {
        console.warn("[TorrentManager] Erro ao retomar torrent ativo:", e);
      }
    }

    // If not in client, re-add from DB
    const dbItem = torrentRepo.getByInfoHash(hash);
    if (!dbItem) return false;

    const torrentSource = dbItem.torrentFilePath && fs.existsSync(dbItem.torrentFilePath)
      ? fs.readFileSync(dbItem.torrentFilePath)
      : dbItem.magnetUri;

    if (torrentSource) {
      this.startTorrentDownload(torrentSource, {
        infoHash: dbItem.infoHash,
        name: dbItem.name,
        storageId: dbItem.storageId,
        downloadDir: dbItem.downloadDir,
        targetFolder: dbItem.targetFolder,
      });
      torrentRepo.updateStatus(hash, "downloading");
      return true;
    }

    return false;
  }

  public async removeTorrent(infoHash: string, deleteFiles = false): Promise<boolean> {
    const hash = infoHash.toLowerCase();
    const dbItem = torrentRepo.getByInfoHash(hash);
    const torrent = this.getActiveTorrent(hash) || (await this.client?.get(hash).catch(() => undefined));

    if (torrent) {
      await new Promise<void>((r) => {
        try {
          this.client?.remove(torrent, { destroyStore: deleteFiles }, () => r());
        } catch {
          r();
        }
      });
    }

    // If files deleted and torrent wasn't running, delete from disk
    if (deleteFiles && dbItem?.downloadDir && dbItem?.name) {
      try {
        const targetPath = path.join(dbItem.downloadDir, dbItem.name);
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }
      } catch (e) {
        console.error("[TorrentManager] Erro ao deletar arquivos do disco:", e);
      }
    }

    // Delete stored .torrent file if exists
    if (dbItem?.torrentFilePath && fs.existsSync(dbItem.torrentFilePath)) {
      try {
        fs.unlinkSync(dbItem.torrentFilePath);
      } catch {}
    }

    // Delete from DB
    torrentRepo.delete(hash);

    // If files deleted, re-scan storage root to clean up catalog
    if (deleteFiles && dbItem?.storageId) {
      scanStorageRoot(dbItem.storageId).catch(console.error);
    }

    return true;
  }

  public listTorrents(): TorrentItem[] {
    const persisted = torrentRepo.getAll();
    const result: TorrentItem[] = [];

    const activeMap = new Map<string, WebTorrent.Torrent>();
    if (this.client) {
      for (const t of this.client.torrents) {
        if (t.infoHash) {
          activeMap.set(t.infoHash.toLowerCase(), t);
        }
      }
    }

    for (const item of persisted) {
      const hash = item.infoHash.toLowerCase();
      const active = activeMap.get(hash);

      if (active) {
        result.push(
          this.mapTorrentToItem(
            active,
            item.storageId,
            item.storageName,
            item.downloadDir,
            item.targetFolder,
            item.infoHash,
            item.name
          )
        );
      } else {
        result.push(item);
      }
    }

    return result;
  }

  public getTorrent(infoHash: string): TorrentItem | null {
    const hash = infoHash.toLowerCase();
    const active = this.getActiveTorrent(hash);
    const dbItem = torrentRepo.getByInfoHash(hash);

    if (!dbItem && !active) return null;

    if (active) {
      return this.mapTorrentToItem(
        active,
        dbItem?.storageId || "",
        dbItem?.storageName,
        dbItem?.downloadDir || active.path,
        dbItem?.targetFolder,
        dbItem?.infoHash,
        dbItem?.name
      );
    }

    return dbItem;
  }

  private mapTorrentToItem(
    t: WebTorrent.Torrent,
    storageId: string,
    storageName?: string,
    downloadDir?: string,
    targetFolder?: string,
    fallbackHash?: string,
    fallbackName?: string
  ): TorrentItem {
    const files: TorrentFileItem[] = (t.files || []).map((f) => ({
      name: f.name,
      path: f.path,
      length: f.length,
      downloaded: f.downloaded,
      progress: f.progress,
    }));

    let status: TorrentStatus = "downloading";
    if (t.done) {
      status = "completed";
    } else if (t.paused) {
      status = "paused";
    } else if (!t.ready) {
      status = "metadata";
    }

    let hash = (t.infoHash || fallbackHash || "").toLowerCase();
    if (!hash && t.magnetURI) {
      const match = t.magnetURI.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
      if (match) hash = match[1].toLowerCase();
    }

    return {
      infoHash: hash || "pending",
      name: t.name || fallbackName || "Identificando torrent...",
      magnetUri: t.magnetURI,
      storageId,
      storageName,
      downloadDir: downloadDir || t.path,
      targetFolder,
      status,
      addedAt: Date.now(),
      totalSize: t.length || 0,
      downloadedBytes: t.downloaded || 0,
      uploadedBytes: t.uploaded || 0,
      downloadSpeed: t.downloadSpeed || 0,
      uploadSpeed: t.uploadSpeed || 0,
      progress: t.progress || 0,
      numPeers: t.numPeers || 0,
      timeRemaining: t.timeRemaining || 0,
      files,
    };
  }

  private persistRunningStats() {
    if (!this.client) return;
    const now = Date.now();
    if (now - this.lastProgressSave < 4000) return;
    this.lastProgressSave = now;

    for (const t of this.client.torrents) {
      if (t.infoHash && t.ready) {
        torrentRepo.updateProgress(t.infoHash, t.downloaded, t.uploaded, t.length);
      }
    }
  }

  public destroy() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.isInitialized = false;
    }
  }
}

export const torrentManager = new TorrentManager();
