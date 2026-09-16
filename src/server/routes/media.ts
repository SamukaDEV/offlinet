import fs from "fs";
import path from "path";
import { fileRepo, storageRepo, watchRepo } from "../db";
import type { CatalogCategory, CatalogData, FileItem } from "../../types";

export async function handleMediaRoutes(req: Request, url: URL): Promise<Response | null> {
  const pathname = url.pathname;
  const method = req.method;

  // GET /api/media/catalog - Netflix style catalog
  if (pathname === "/api/media/catalog" && method === "GET") {
    const allVideos = fileRepo.listMediaVideos(200);
    const continueWatching = fileRepo.listContinueWatching(15);
    const roots = storageRepo.getAll().filter(r => r.isActive);

    // Group by storage roots
    const storageCategories: CatalogCategory[] = roots.map((root) => {
      const items = allVideos.filter((v) => v.storageId === root.id).slice(0, 20);
      return {
        id: `storage-${root.id}`,
        title: `Em ${root.name}`,
        items,
      };
    }).filter((cat) => cat.items.length > 0);

    const categories: CatalogCategory[] = [];

    // Recent items row
    if (allVideos.length > 0) {
      categories.push({
        id: "recent",
        title: "Adicionados Recentemente",
        items: allVideos.slice(0, 20),
      });
    }

    // Add per-storage categories
    categories.push(...storageCategories);

    // If there are many videos, also provide a "Biblioteca Completa" row
    if (allVideos.length > 20) {
      categories.push({
        id: "all-videos",
        title: "Todos os Vídeos da Biblioteca",
        items: allVideos,
      });
    }

    // Featured video: pick top continue watching or first recent video
    const featured: FileItem | null = continueWatching[0] || allVideos[0] || null;

    const catalog: CatalogData = {
      featured,
      continueWatching,
      categories,
      totalMovies: allVideos.length,
    };

    return Response.json({ success: true, catalog });
  }

  // GET /api/media/detail/:id
  if (pathname.startsWith("/api/media/detail/") && method === "GET") {
    const id = pathname.replace("/api/media/detail/", "");
    const item = fileRepo.getById(id);

    if (!item) {
      return Response.json({ success: false, error: "Vídeo não encontrado" }, { status: 404 });
    }

    // Get sibling files in the same folder (e.g. next episodes in a series!)
    const siblings = fileRepo.listByFolder(item.storageId, item.parentPath)
      .filter((f) => f.mediaType === "video" && f.id !== item.id);

    // Check for subtitle
    const hasSubtitle = checkSubtitleExists(item.fullPath);

    return Response.json({
      success: true,
      item,
      siblings,
      hasSubtitle,
      subtitleUrl: hasSubtitle ? `/api/media/subtitles/${item.id}` : null,
    });
  }

  // POST /api/media/progress - Save playback position
  if (pathname === "/api/media/progress" && method === "POST") {
    try {
      const body = await req.json();
      const { fileId, progressSeconds, durationSeconds } = body;

      if (!fileId || typeof progressSeconds !== "number") {
        return Response.json({ success: false, error: "Dados de progresso inválidos" }, { status: 400 });
      }

      watchRepo.saveProgress(fileId, progressSeconds, durationSeconds || 0);
      return Response.json({ success: true });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // DELETE /api/media/progress/:id - Reset watch progress
  if (pathname.startsWith("/api/media/progress/") && method === "DELETE") {
    const id = pathname.replace("/api/media/progress/", "");
    watchRepo.clearProgress(id);
    return Response.json({ success: true });
  }

  // GET /api/media/subtitles/:id - Return WebVTT subtitle
  if (pathname.startsWith("/api/media/subtitles/") && method === "GET") {
    const id = pathname.replace("/api/media/subtitles/", "");
    const item = fileRepo.getById(id);

    if (!item || !fs.existsSync(item.fullPath)) {
      return new Response("Arquivo não encontrado", { status: 404 });
    }

    const subPath = findSubtitlePath(item.fullPath);
    if (!subPath) {
      return new Response("Legenda não encontrada", { status: 404 });
    }

    let content = fs.readFileSync(subPath, "utf-8");

    // If SRT, convert to WebVTT format
    if (subPath.endsWith(".srt")) {
      content = convertSrtToVtt(content);
    }

    return new Response(content, {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return null;
}

function findSubtitlePath(videoPath: string): string | null {
  const dir = path.dirname(videoPath);
  const ext = path.extname(videoPath);
  const baseName = path.basename(videoPath, ext);

  const candidates = [
    path.join(dir, `${baseName}.vtt`),
    path.join(dir, `${baseName}.srt`),
    path.join(dir, `${baseName}.pt.srt`),
    path.join(dir, `${baseName}.pt-br.srt`),
    path.join(dir, `${baseName}.pob.srt`),
    path.join(dir, `${baseName}.en.srt`),
    path.join(dir, "subtitles.vtt"),
    path.join(dir, "subtitles.srt"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function checkSubtitleExists(videoPath: string): boolean {
  return findSubtitlePath(videoPath) !== null;
}

function convertSrtToVtt(srtContent: string): string {
  // Convert SRT comma millisecond separators to period, e.g. 00:01:20,000 -> 00:01:20.000
  const normalized = srtContent
    .replace(/\r\n/g, "\n")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");

  return `WEBVTT - OffliNet Subtitles\n\n${normalized}`;
}
