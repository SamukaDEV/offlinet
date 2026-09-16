import fs from "fs";
import path from "path";

const MIME_MAP: Record<string, string> = {
  // Video
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".wmv": "video/x-ms-wmv",
  ".m4v": "video/mp4",
  ".flv": "video/x-flv",
  ".ts": "video/mp2t",

  // Audio
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".m3u": "audio/x-mpegurl",
  ".m3u8": "application/x-mpegurl",

  // Images
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",

  // Subtitles
  ".vtt": "text/vtt; charset=utf-8",
  ".srt": "text/plain; charset=utf-8",

  // Docs
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

export function handleRangeStream(filePath: string, request: Request): Response {
  if (!fs.existsSync(filePath)) {
    return new Response("Arquivo não encontrado", { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const totalSize = stat.size;
  const mimeType = getMimeType(filePath);
  const rangeHeader = request.headers.get("range");

  // If no range request, return standard file response with Accept-Ranges
  if (!rangeHeader) {
    const file = Bun.file(filePath);
    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": totalSize.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Parse Range header: bytes=start-end
  const parts = rangeHeader.replace(/bytes=/, "").split("-");
  let start = parseInt(parts[0], 10);
  let end = parts[1] ? parseInt(parts[1], 10) : NaN;

  if (isNaN(start)) {
    // Suffix byte range: bytes=-500 (last 500 bytes)
    start = totalSize - (isNaN(end) ? 0 : end);
    end = totalSize - 1;
  }

  // Default chunk size (5MB chunk if end not specified for smooth streaming)
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  if (isNaN(end)) {
    end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
  } else {
    end = Math.min(end, totalSize - 1);
  }

  if (start >= totalSize || start < 0) {
    return new Response("Requested range not satisfiable", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${totalSize}`,
      },
    });
  }

  const contentLength = end - start + 1;
  const slice = Bun.file(filePath).slice(start, end + 1);

  return new Response(slice, {
    status: 206,
    headers: {
      "Content-Range": `bytes ${start}-${end}/${totalSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": contentLength.toString(),
      "Content-Type": mimeType,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
