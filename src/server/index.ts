import fs from "fs";
import path from "path";
import os from "os";
import { fileRepo, storageRepo, DATA_PATHS } from "./db";
import { getLanAddresses } from "./network";
import { handleRangeStream } from "./streamer";
import { scanAllRoots } from "./scanner";
import {
  findLocalCover,
  getCachedThumbnailPath,
  generateFfmpegThumbnail,
  generateSvgPoster,
  isFfmpegAvailable,
  saveUploadedThumbnail,
} from "./thumbnail";
import { handleStorageRoutes } from "./routes/storage";
import { handleFilesRoutes } from "./routes/files";
import { handleMediaRoutes } from "./routes/media";
import type { SystemInfo } from "../types";

const PORT = parseInt(process.env.PORT || "3000", 10);
const DIST_DIR = path.resolve(process.cwd(), "dist");

// Initialize default storage root if empty
function initializeDefaultStorage() {
  const existing = storageRepo.getAll();
  if (existing.length === 0) {
    const defaultStoragePath = path.resolve(process.cwd(), "storage_default");
    if (!fs.existsSync(defaultStoragePath)) {
      fs.mkdirSync(defaultStoragePath, { recursive: true });
      fs.mkdirSync(path.join(defaultStoragePath, "Filmes"), { recursive: true });
      fs.mkdirSync(path.join(defaultStoragePath, "Series"), { recursive: true });
      fs.mkdirSync(path.join(defaultStoragePath, "Fotos"), { recursive: true });
      fs.mkdirSync(path.join(defaultStoragePath, "Documentos"), { recursive: true });
    }

    storageRepo.add({
      id: "default-storage",
      name: "Armazenamento Principal",
      path: defaultStoragePath,
      isActive: true,
    });
    console.log(`[Storage] Pasta de armazenamento padrão criada: ${defaultStoragePath}`);
  }
}

initializeDefaultStorage();

// Start initial background scan
scanAllRoots().catch(console.error);

const server = Bun.serve({
  port: PORT,
  // Support uploads of large 4K movies/files up to 100GB
  maxRequestBodySize: 1024 * 1024 * 1024 * 100, // 100 GB
  idleTimeout: 255, // Max idle timeout for long LAN transfers
  async fetch(req) {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Range, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Helper to add CORS headers
    function withCors(response: Response): Response {
      const headers = new Headers(response.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    try {
      // 1. Storage API
      if (url.pathname.startsWith("/api/storage")) {
        const res = await handleStorageRoutes(req, url);
        if (res) return withCors(res);
      }

      // 2. Files API
      if (url.pathname.startsWith("/api/files")) {
        const res = await handleFilesRoutes(req, url);
        if (res) return withCors(res);
      }

      // 3. Media API
      if (url.pathname.startsWith("/api/media")) {
        const res = await handleMediaRoutes(req, url);
        if (res) return withCors(res);
      }

      // 4. Video / Audio Streaming endpoint: /api/stream/:fileId
      if (url.pathname.startsWith("/api/stream/")) {
        const fileId = url.pathname.replace("/api/stream/", "");
        const file = fileRepo.getById(fileId);

        if (!file || !fs.existsSync(file.fullPath)) {
          return withCors(new Response("Arquivo de mídia não encontrado", { status: 404 }));
        }

        return handleRangeStream(file.fullPath, req);
      }

      // 5. Thumbnails endpoint: /api/thumbnail/:fileId
      if (url.pathname.startsWith("/api/thumbnail/")) {
        const fileId = url.pathname.replace("/api/thumbnail/", "");

        // Check if file is thumbnail upload
        if (fileId === "upload-frame" && req.method === "POST") {
          const body = await req.json();
          const { fileId: targetId, base64 } = body;
          if (targetId && base64) {
            const data = base64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(data, "base64");
            saveUploadedThumbnail(targetId, buffer);
            return withCors(Response.json({ success: true }));
          }
          return withCors(Response.json({ success: false }, { status: 400 }));
        }

        const file = fileRepo.getById(fileId);
        if (!file || !fs.existsSync(file.fullPath)) {
          // Return default SVG poster
          return withCors(new Response(generateSvgPoster("Mídia"), {
            headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" },
          }));
        }

        // A. If image file, return the image directly
        if (file.mediaType === "image") {
          return withCors(new Response(Bun.file(file.fullPath), {
            headers: { "Content-Type": file.mimeType, "Cache-Control": "public, max-age=86400" },
          }));
        }

        // B. If video, check local poster in directory
        const localCover = findLocalCover(file.fullPath);
        if (localCover) {
          return withCors(new Response(Bun.file(localCover), {
            headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
          }));
        }

        // C. Check cached thumbnail
        const cachedThumb = getCachedThumbnailPath(file.id);
        if (fs.existsSync(cachedThumb)) {
          return withCors(new Response(Bun.file(cachedThumb), {
            headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
          }));
        }

        // D. Try ffmpeg if available
        if (isFfmpegAvailable()) {
          const generated = await generateFfmpegThumbnail(file.fullPath, cachedThumb);
          if (generated && fs.existsSync(cachedThumb)) {
            return withCors(new Response(Bun.file(cachedThumb), {
              headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
            }));
          }
        }

        // E. Fallback: dynamic high-resolution SVG poster
        const svg = generateSvgPoster(file.name, file.duration);
        return withCors(new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }));
      }

      // 6. System Info endpoint: /api/system/info
      if (url.pathname === "/api/system/info") {
        const stats = fileRepo.getStats();
        const info: SystemInfo = {
          lanUrls: getLanAddresses(PORT),
          os: `${os.type()} ${os.release()}`,
          platform: os.platform(),
          hostname: os.hostname(),
          storageRoots: storageRepo.getAll(),
          ffmpegAvailable: isFfmpegAvailable(),
          totalIndexedFiles: stats.totalFiles,
          totalIndexedVideos: stats.totalVideos,
        };
        return withCors(Response.json({ success: true, info }));
      }

      // 7. Production Static Frontend serving
      if (fs.existsSync(DIST_DIR)) {
        let filePath = path.join(DIST_DIR, url.pathname);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(DIST_DIR, "index.html");
        }

        if (fs.existsSync(filePath)) {
          return new Response(Bun.file(filePath));
        }
      }

      // Development fallback if dist does not exist yet
      return withCors(new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>OffliNet Server</title>
            <meta charset="utf-8">
            <style>
              body { background: #0a0a0a; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #171717; padding: 2rem; border-radius: 12px; border: 1px solid #262626; max-width: 500px; text-align: center; }
              h1 { color: #e50914; margin-top: 0; }
              a { color: #3b82f6; text-decoration: none; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>OffliNet Server Rodando!</h1>
              <p>O backend Bun está ativo na porta ${PORT}.</p>
              <p>Inicie o frontend com <code>bun run dev</code> para acessar a interface web na porta 5173, ou execute <code>bun run build</code> para empacotar a versão de produção.</p>
              <p><a href="/api/system/info">Ver Informações do Sistema (API)</a></p>
            </div>
          </body>
        </html>
      `, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }));
    } catch (err: any) {
      console.error("[Server Error]", err);
      return withCors(Response.json({ success: false, error: err.message }, { status: 500 }));
    }
  },
});

const lanAddresses = getLanAddresses(PORT);
console.log("\n=======================================================");
console.log(" 🚀 OFFLINET - Streaming & Nuvem LAN (Bun Server)");
console.log("=======================================================");
console.log(` Servidor local:   http://localhost:${PORT}`);
console.log(" Acesso em outros dispositivos na rede local (LAN):");
for (const addr of lanAddresses) {
  if (!addr.includes("localhost") && !addr.includes("127.0.0.1")) {
    console.log(` 👉 ${addr}`);
  }
}
console.log("=======================================================\n");
