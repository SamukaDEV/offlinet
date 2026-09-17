import fs from "fs";
import path from "path";
import Router, { LoggerMiddleware, RouteViewerMiddleware } from "routerun";
import { fileRepo, storageRepo } from "./db";
import { getLanAddresses } from "./network";
import { handleRangeStream } from "./streamer";
import { scanAllRoots } from "./scanner";
import {
  findLocalCover,
  getCachedThumbnailPath,
  ensureVideoThumbnail,
  generateSvgPoster,
  isFfmpegAvailable,
  saveUploadedThumbnail,
} from "./thumbnail";
import { storageRouter } from "./routes/storage";
import { filesRouter } from "./routes/files";
import { mediaRouter } from "./routes/media";
import { playlistsRouter } from "./routes/playlists";
import { systemRouter } from "./routes/system";
import index from "../client/index.html";

const PORT = parseInt(process.env.PORT || "3000", 10);
// const DIST_DIR = path.resolve(process.cwd(), "dist");

// Initialize default storage root if empty (OffliNet LAN)
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
// scanAllRoots().catch(console.error);

// Create RouteRun Router
const app = new Router();

// 1. CORS & Preflight Middleware
app.use(async (req, res, next) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Range, Authorization, x-storage-id, x-target-folder, x-file-name",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  await next();

  if (res.__response) {
    res.__response.headers.set("Access-Control-Allow-Origin", "*");
    res.__response.headers.set("Access-Control-Allow-Headers", "Content-Type, Range, Authorization, x-storage-id, x-target-folder, x-file-name");
  }
});

// 2. Request Logger Middleware
app.use(
  LoggerMiddleware({
    timestamp: true,
    colors: true,
  })
);

// 3. Mount API sub-routers
app.use("/api/storage", storageRouter);
app.use("/api/files", filesRouter);
app.use("/api/media", mediaRouter);
app.use("/api/playlists", playlistsRouter);
app.use("/api/system", systemRouter);

// 4. Video & Audio Streaming endpoint: /api/stream/:fileId
app.get("/api/stream/:fileId", (req) => {
  const fileId = req.params.fileId;
  const file = fileRepo.getById(fileId);

  if (!file || !fs.existsSync(file.fullPath)) {
    return new Response("Arquivo de mídia não encontrado", {
      status: 404,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  return handleRangeStream(file.fullPath, req.raw);
});

// 5. Thumbnails endpoints
app.post("/api/thumbnail/upload-frame", async (req, res) => {
  try {
    const body = await req.raw.json();
    const { fileId: targetId, base64 } = body;
    if (targetId && base64) {
      const data = base64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(data, "base64");
      saveUploadedThumbnail(targetId, buffer);
      return res.json({ success: true });
    }
    return res.json({ success: false }, { status: 400 });
  } catch (err: any) {
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

app.get("/api/thumbnail/:fileId", async (req) => {
  const fileId = req.params.fileId;
  const file = fileRepo.getById(fileId);
  if (!file || !fs.existsSync(file.fullPath)) {
    return new Response(generateSvgPoster("Mídia"), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // A. If image file, return the image directly
  if (file.mediaType === "image") {
    return new Response(Bun.file(file.fullPath), {
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // B. If video, check local poster in directory
  const localCover = findLocalCover(file.fullPath);
  if (localCover) {
    return new Response(Bun.file(localCover), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // C. Check cached thumbnail
  const cachedThumb = getCachedThumbnailPath(file.id);
  if (fs.existsSync(cachedThumb)) {
    return new Response(Bun.file(cachedThumb), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // D. Extract frame via FFmpeg on demand (JIT)
  if (isFfmpegAvailable()) {
    const generatedPath = await ensureVideoThumbnail(file);
    if (generatedPath && fs.existsSync(generatedPath)) {
      return new Response(Bun.file(generatedPath), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }

  // E. Fallback: dynamic high-resolution SVG poster
  const svg = generateSvgPoster(file.name, file.duration);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});



// 7. Interactive API Explorer & Web Visualizer
app.use(
  RouteViewerMiddleware(app, {
    path: "/_debug/routes",
    title: "OffliNet API Explorer",
  })
);

// 8. Static frontend files & Single-Page Application (SPA) fallback
app.bundle("/*", index);

const serverOptions = {
  port: PORT,
  routes: app.toBunRoutes(),
  maxRequestBodySize: 1024 * 1024 * 1024 * 100, // 100 GB
  idleTimeout: 255,
};

export default serverOptions;

// If global server already exists from previous execution, reload handler
if ((globalThis as any).__offlinet_server) {
  try {
    (globalThis as any).__offlinet_server.reload(serverOptions);
  } catch {}
} else {
  try {
    (globalThis as any).__offlinet_server = Bun.serve(serverOptions);
  } catch {}
}

const lanAddresses = getLanAddresses(PORT);
console.log("\n=======================================================");
console.log(" 🚀 OFFLINET - Streaming & Nuvem LAN (RouteRun + Bun)");
console.log("=======================================================");
console.log(` Servidor local:   http://localhost:${PORT}`);
console.log(` API Explorer:     http://localhost:${PORT}/_debug/routes`);
console.log(" Acesso em outros dispositivos na rede local (LAN):");
for (const addr of lanAddresses) {
  if (!addr.includes("localhost") && !addr.includes("127.0.0.1")) {
    console.log(` 👉 ${addr}`);
  }
}
console.log("=======================================================\n");
