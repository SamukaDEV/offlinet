import fs from "fs";
import path from "path";
import Router from "routerun";
import { playlistRepo, fileRepo, storageRepo } from "../db";
import { getMimeType } from "../streamer";
import { generateFileId } from "../scanner";
import type { FileItem } from "../../types";

export const playlistsRouter = new Router();

// GET /api/playlists - List all playlists
playlistsRouter.get("/", (_req, res) => {
  const playlists = playlistRepo.getAll();
  return res.json({ success: true, playlists });
});

// POST /api/playlists - Create new playlist
playlistsRouter.post("/", async (req, res) => {
  try {
    const body = await req.raw.json();
    const { name } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.json({ success: false, error: "Nome da playlist é obrigatório" }, { status: 400 });
    }

    const playlist = playlistRepo.create(name.trim());
    return res.json({ success: true, playlist });
  } catch (err: any) {
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// GET /api/playlists/parse-m3u/:fileId - Parse .m3u / .m3u8 playlist file
playlistsRouter.get("/parse-m3u/:fileId", (req, res) => {
  const fileId = req.params.fileId;
  const file = fileRepo.getById(fileId);
  if (!file || !fs.existsSync(file.fullPath)) {
    return res.json({ success: false, error: "Arquivo de playlist não encontrado" }, { status: 404 });
  }

  const result = parseM3uFile(file);
  return res.json({ success: true, ...result });
});

// POST /api/playlists/:id/items - Add track to playlist
playlistsRouter.post("/:id/items", async (req, res) => {
  const playlistId = req.params.id;
  try {
    const body = await req.raw.json();
    const { fileId } = body;
    if (!fileId) {
      return res.json({ success: false, error: "ID do arquivo é obrigatório" }, { status: 400 });
    }

    playlistRepo.addItem(playlistId, fileId);
    const updated = playlistRepo.getById(playlistId);
    return res.json({ success: true, playlist: updated });
  } catch (err: any) {
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// DELETE /api/playlists/:id/items/:fileId - Remove track from playlist
playlistsRouter.delete("/:id/items/:fileId", (req, res) => {
  const playlistId = req.params.id;
  const fileId = req.params.fileId;

  if (playlistId && fileId) {
    playlistRepo.removeItem(playlistId, fileId);
    const updated = playlistRepo.getById(playlistId);
    return res.json({ success: true, playlist: updated });
  }
  return res.json({ success: false, error: "Parâmetros inválidos" }, { status: 400 });
});

// GET /api/playlists/:id - Get playlist details with track list
playlistsRouter.get("/:id", (req, res) => {
  const id = req.params.id;
  const playlist = playlistRepo.getById(id);
  if (!playlist) {
    return res.json({ success: false, error: "Playlist não encontrada" }, { status: 404 });
  }
  return res.json({ success: true, playlist });
});

// DELETE /api/playlists/:id - Delete playlist
playlistsRouter.delete("/:id", (req, res) => {
  const id = req.params.id;
  playlistRepo.delete(id);
  return res.json({ success: true });
});

function parseM3uFile(file: FileItem): {
  name: string;
  tracks: FileItem[];
  totalEntries: number;
  totalFound: number;
} {
  const content = fs.readFileSync(file.fullPath, "utf-8");
  const baseDir = path.dirname(file.fullPath);
  const lines = content.split(/\r?\n/);

  const playlistName = path.basename(file.name, path.extname(file.name));
  const tracks: FileItem[] = [];
  let totalEntries = 0;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    totalEntries++;

    // Try candidate path
    let candidatePath = line;
    if (!path.isAbsolute(candidatePath)) {
      candidatePath = path.resolve(baseDir, candidatePath);
    }

    candidatePath = path.normalize(candidatePath);

    // If not found, try matching filename directly in the same directory as m3u
    if (!fs.existsSync(candidatePath)) {
      const alt = path.join(baseDir, path.basename(line));
      if (fs.existsSync(alt)) {
        candidatePath = alt;
      }
    }

    if (fs.existsSync(candidatePath)) {
      let item = fileRepo.getByFullPath(candidatePath);
      if (!item) {
        const altSlash = candidatePath.replace(/\\/g, "/");
        item = fileRepo.getByFullPath(altSlash);
      }

      if (!item) {
        const fileName = path.basename(candidatePath);
        const roots = storageRepo.getAll();
        const root = roots.find((r) => candidatePath.toLowerCase().startsWith(r.path.toLowerCase()));
        if (root) {
          const rel = path.relative(root.path, candidatePath).replace(/\\/g, "/");
          const parent = path.dirname(rel).replace(/\\/g, "/");
          const ext = path.extname(fileName).toLowerCase();
          const stat = fs.statSync(candidatePath);
          const genId = generateFileId(root.id, rel);
          fileRepo.upsert({
            id: genId,
            storageId: root.id,
            relativePath: rel,
            fullPath: candidatePath,
            name: fileName,
            extension: ext,
            size: stat.size,
            isDirectory: false,
            mediaType: "audio",
            mimeType: getMimeType(candidatePath),
            parentPath: parent === "." ? "/" : parent,
            updatedAt: stat.mtimeMs,
          });
          item = fileRepo.getById(genId);
        }
      }

      if (item && !tracks.some((t) => t.id === item!.id)) {
        tracks.push(item);
      }
    }
  }

  return {
    name: playlistName,
    tracks,
    totalEntries,
    totalFound: tracks.length,
  };
}
