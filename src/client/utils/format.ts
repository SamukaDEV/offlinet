export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSeconds(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const formatDuration = formatSeconds;

export function formatSpeed(bytesPerSecond?: number): string {
  if (!bytesPerSecond || bytesPerSecond <= 0 || !isFinite(bytesPerSecond)) return "0 B/s";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatEta(seconds?: number): string {
  if (seconds === undefined || seconds === null || !isFinite(seconds) || seconds < 0) return "Calculando...";
  if (seconds === 0) return "Concluindo...";
  if (seconds < 60) return `~${seconds}s restantes`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `~${m}m ${s > 0 ? `${s}s ` : ""}restantes`;
  const h = Math.floor(m / 60);
  const remainingM = m % 60;
  return `~${h}h ${remainingM > 0 ? `${remainingM}m ` : ""}restantes`;
}

export function formatHumanDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function getResolutionBadge(width?: number, height?: number): string | null {
  if (!width && !height) return null;
  const w = width || 0;
  const h = height || 0;
  if (w >= 3800 || h >= 2100) return "4K";
  if (w >= 1900 || h >= 1000) return "1080p";
  if (w >= 1200 || h >= 700) return "720p";
  if (w > 0 || h > 0) return "SD";
  return null;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
