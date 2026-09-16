import fs from "fs";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import { DATA_PATHS, fileRepo } from "./db";
import type { FileItem } from "../types";

// Detect ffmpeg executable
let ffmpegCmd: string | null = null;
if (ffmpegPath && fs.existsSync(ffmpegPath)) {
  ffmpegCmd = ffmpegPath;
} else {
  try {
    const check = Bun.spawnSync(["ffmpeg", "-version"]);
    if (check.exitCode === 0) ffmpegCmd = "ffmpeg";
  } catch {
    ffmpegCmd = null;
  }
}

export function isFfmpegAvailable(): boolean {
  return ffmpegCmd !== null;
}

export function getCachedThumbnailPath(fileId: string): string {
  return path.join(DATA_PATHS.thumbDir, `${fileId}.jpg`);
}

export function findLocalCover(videoFilePath: string): string | null {
  const dir = path.dirname(videoFilePath);
  const ext = path.extname(videoFilePath);
  const baseName = path.basename(videoFilePath, ext);

  const candidates = [
    path.join(dir, `${baseName}.jpg`),
    path.join(dir, `${baseName}.jpeg`),
    path.join(dir, `${baseName}.png`),
    path.join(dir, `${baseName}.webp`),
    path.join(dir, "poster.jpg"),
    path.join(dir, "poster.png"),
    path.join(dir, "cover.jpg"),
    path.join(dir, "cover.png"),
    path.join(dir, "folder.jpg"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

/**
 * Probes video duration and dimensions via ffmpeg
 */
export function probeVideo(videoPath: string): VideoMetadata {
  if (!ffmpegCmd) return { duration: 0, width: 0, height: 0 };

  try {
    const proc = Bun.spawnSync([ffmpegCmd, "-i", videoPath], {
      stdout: "ignore",
      stderr: "pipe",
    });

    const output = proc.stderr.toString();
    let duration = 0;
    let width = 0;
    let height = 0;

    // Match Duration: 01:23:45.67
    const durMatch = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}\.?\d*)/);
    if (durMatch) {
      const h = parseFloat(durMatch[1]);
      const m = parseFloat(durMatch[2]);
      const s = parseFloat(durMatch[3]);
      duration = Math.round(h * 3600 + m * 60 + s);
    }

    // Match Stream ... Video: ... 1920x1080
    const dimMatch = output.match(/Stream.*Video:.*,\s*(\d{3,5})x(\d{3,5})/);
    if (dimMatch) {
      width = parseInt(dimMatch[1], 10);
      height = parseInt(dimMatch[2], 10);
    }

    return { duration, width, height };
  } catch (err) {
    console.error("[Thumbnail] Erro ao obter metadados do vídeo:", err);
    return { duration: 0, width: 0, height: 0 };
  }
}

/**
 * Extracts a high quality frame thumbnail from the video file
 */
export async function generateFfmpegThumbnail(videoPath: string, destPath: string): Promise<boolean> {
  if (!ffmpegCmd) return false;

  try {
    // 1. First probe metadata to select the best frame position
    const { duration } = probeVideo(videoPath);

    // Pick timestamp (avoiding black intros at 00:00:00)
    let seekTime = "00:00:15";
    if (duration > 180) {
      // For movies longer than 3 minutes, pick around 5-10% of duration (e.g. 1m to 2m in)
      const targetSec = Math.min(Math.floor(duration * 0.08), 120);
      const m = Math.floor(targetSec / 60).toString().padStart(2, "0");
      const s = Math.floor(targetSec % 60).toString().padStart(2, "0");
      seekTime = `00:${m}:${s}`;
    } else if (duration > 5 && duration <= 15) {
      seekTime = "00:00:02";
    } else if (duration > 0 && duration <= 5) {
      seekTime = "00:00:00.500";
    }

    // Fast keyframe seek before -i for instant seeking without decoding whole video
    const proc = Bun.spawn([
      ffmpegCmd,
      "-ss", seekTime,
      "-i", videoPath,
      "-vframes", "1",
      "-q:v", "2",
      "-vf", "scale=640:-1",
      "-y",
      destPath,
    ], {
      stdout: "ignore",
      stderr: "ignore",
    });

    await proc.exited;

    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 100) {
      return true;
    }

    // Fallback: seek to beginning (00:00:01) if chosen timestamp failed
    const procFallback = Bun.spawn([
      ffmpegCmd,
      "-ss", "00:00:01",
      "-i", videoPath,
      "-vframes", "1",
      "-q:v", "2",
      "-vf", "scale=640:-1",
      "-y",
      destPath,
    ], {
      stdout: "ignore",
      stderr: "ignore",
    });

    await procFallback.exited;
    return fs.existsSync(destPath) && fs.statSync(destPath).size > 100;
  } catch (err) {
    console.error("[Thumbnail] Erro ao extrair frame via ffmpeg:", err);
    return false;
  }
}

/**
 * Ensures a video has a thumbnail on disk and updates duration/dimensions in DB
 */
export async function ensureVideoThumbnail(file: FileItem): Promise<string | null> {
  const cachedThumb = getCachedThumbnailPath(file.id);

  // If metadata is missing in DB, probe it
  if (!file.duration || !file.width) {
    const meta = probeVideo(file.fullPath);
    if (meta.duration > 0 || meta.width > 0) {
      fileRepo.updateMetadata(file.id, meta);
    }
  }

  // If already in cache
  if (fs.existsSync(cachedThumb)) {
    return cachedThumb;
  }

  // Check local poster in directory
  const localCover = findLocalCover(file.fullPath);
  if (localCover) {
    return localCover;
  }

  if (isFfmpegAvailable()) {
    const success = await generateFfmpegThumbnail(file.fullPath, cachedThumb);
    if (success) {
      return cachedThumb;
    }
  }

  return null;
}

// Background Thumbnail Extraction Queue
const thumbnailQueue: FileItem[] = [];
let isProcessingQueue = false;

export function enqueueVideoThumbnail(file: FileItem) {
  if (file.mediaType !== "video" || file.isDirectory) return;
  const cached = getCachedThumbnailPath(file.id);
  if (fs.existsSync(cached)) return;

  // Avoid duplicates
  if (!thumbnailQueue.some((f) => f.id === file.id)) {
    thumbnailQueue.push(file);
  }

  processQueue();
}

async function processQueue() {
  if (isProcessingQueue || thumbnailQueue.length === 0) return;
  isProcessingQueue = true;

  try {
    while (thumbnailQueue.length > 0) {
      const file = thumbnailQueue.shift();
      if (!file) break;

      try {
        await ensureVideoThumbnail(file);
      } catch (err) {
        console.error(`[Thumbnail] Falha ao processar miniatura de ${file.name}:`, err);
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

export function generateSvgPoster(title: string, duration?: number): string {
  const cleanTitle = escapeXml(title.length > 35 ? title.substring(0, 32) + "..." : title);
  const durText = duration && duration > 0 ? formatDuration(duration) : "VÍDEO";

  // Deterministic gradient colors from title string
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  const hues = [
    ["#e50914", "#831843"], // red to pink
    ["#2563eb", "#1e1b4b"], // blue to dark
    ["#7c3aed", "#312e81"], // purple
    ["#059669", "#064e3b"], // emerald
    ["#ea580c", "#7c2d12"], // orange
  ];
  const [colorA, colorB] = hues[Math.abs(hash) % hues.length];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colorA}" stop-opacity="0.9" />
        <stop offset="100%" stop-color="${colorB}" stop-opacity="0.95" />
      </linearGradient>
      <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.2" />
        <stop offset="60%" stop-color="#000000" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.9" />
      </linearGradient>
    </defs>
    <rect width="640" height="360" fill="url(#bg)"/>
    <rect width="640" height="360" fill="url(#overlay)"/>
    
    <!-- Play Icon Circle -->
    <circle cx="320" cy="150" r="38" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.6)" stroke-width="2"/>
    <polygon points="314,136 334,150 314,164" fill="#ffffff"/>

    <!-- Duration Badge -->
    <rect x="520" y="20" width="100" height="26" rx="4" fill="rgba(0,0,0,0.7)"/>
    <text x="570" y="38" fill="#ffffff" font-size="12" font-weight="bold" font-family="sans-serif" text-anchor="middle">${durText}</text>

    <!-- Title Label -->
    <text x="32" y="300" fill="#ffffff" font-size="20" font-weight="bold" font-family="sans-serif">${cleanTitle}</text>
    <text x="32" y="326" fill="#a3a3a3" font-size="13" font-family="sans-serif">OffliNet Media Stream</text>
  </svg>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function saveUploadedThumbnail(fileId: string, buffer: Buffer): string {
  const destPath = getCachedThumbnailPath(fileId);
  fs.writeFileSync(destPath, buffer);
  return destPath;
}
