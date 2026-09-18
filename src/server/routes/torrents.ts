import Router from "routerun";
import { torrentManager } from "../torrentManager";

export const torrentsRouter = new Router();

// GET /api/torrents - List all torrents
torrentsRouter.get("/", (_req, res) => {
  try {
    const list = torrentManager.listTorrents();
    return res.json({ success: true, torrents: list });
  } catch (err: any) {
    return res.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
});

// GET /api/torrents/:infoHash - Get single torrent details
torrentsRouter.get("/:infoHash", (req, res) => {
  try {
    const infoHash = req.params.infoHash;
    const item = torrentManager.getTorrent(infoHash);
    if (!item) {
      return res.json({ success: false, error: "Torrent não encontrado" }, { status: 404 });
    }
    return res.json({ success: true, torrent: item });
  } catch (err: any) {
    return res.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
});

// POST /api/torrents/add - Add new torrent via magnet link or .torrent file
torrentsRouter.post("/add", async (req, res) => {
  try {
    const contentType = req.raw.headers.get("content-type") || "";

    let magnetUri: string | undefined;
    let storageId: string | undefined;
    let targetFolder: string | undefined;
    let torrentBuffer: Buffer | undefined;
    let torrentFileName: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.raw.formData();
      magnetUri = (formData.get("magnetUri") as string) || undefined;
      storageId = (formData.get("storageId") as string) || undefined;
      targetFolder = (formData.get("targetFolder") as string) || undefined;

      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        torrentFileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        torrentBuffer = Buffer.from(arrayBuffer);
      }
    } else {
      const body = await req.raw.json();
      magnetUri = body.magnetUri;
      storageId = body.storageId;
      targetFolder = body.targetFolder;
    }

    if (!magnetUri && !torrentBuffer) {
      return res.json(
        { success: false, error: "Por favor, forneça um link magnet ou envie um arquivo .torrent" },
        { status: 400 }
      );
    }

    const item = await torrentManager.addTorrent({
      magnetUri,
      torrentBuffer,
      torrentFileName,
      storageId,
      targetFolder,
    });

    return res.json({ success: true, torrent: item });
  } catch (err: any) {
    console.error("[Torrents Route] Erro ao adicionar torrent:", err);
    return res.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
});

// POST /api/torrents/:infoHash/pause - Pause torrent
torrentsRouter.post("/:infoHash/pause", async (req, res) => {
  try {
    const infoHash = req.params.infoHash;
    const ok = await torrentManager.pauseTorrent(infoHash);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
});

// POST /api/torrents/:infoHash/resume - Resume torrent
torrentsRouter.post("/:infoHash/resume", async (req, res) => {
  try {
    const infoHash = req.params.infoHash;
    const ok = await torrentManager.resumeTorrent(infoHash);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
});

// DELETE /api/torrents/:infoHash - Remove torrent
torrentsRouter.delete("/:infoHash", async (req, res) => {
  try {
    const infoHash = req.params.infoHash;
    const url = new URL(req.url);
    const deleteFiles = url.searchParams.get("deleteFiles") === "true";

    const ok = await torrentManager.removeTorrent(infoHash, deleteFiles);
    return res.json({ success: ok });
  } catch (err: any) {
    return res.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
});
