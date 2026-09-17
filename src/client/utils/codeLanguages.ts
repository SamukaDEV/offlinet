/**
 * Mapeamento e suporte a linguagens para o Monaco Editor
 */

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // Web
  html: "html",
  htm: "html",
  xhtml: "html",
  css: "css",
  scss: "scss",
  less: "less",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  jsonc: "json",

  // Scripts e Programação
  py: "python",
  pyw: "python",
  rb: "ruby",
  php: "php",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  lua: "lua",
  r: "r",
  dart: "dart",

  // Shell & Configuração
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  bat: "bat",
  cmd: "bat",
  ps1: "powershell",
  psm1: "powershell",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  conf: "ini",
  config: "xml",
  env: "plaintext",
  dockerfile: "dockerfile",

  // Dados e Marcação
  md: "markdown",
  markdown: "markdown",
  xml: "xml",
  svg: "xml",
  sql: "sql",
  csv: "plaintext",
  tsv: "plaintext",
  log: "plaintext",
  txt: "plaintext",
  diff: "diff",
  patch: "diff",
};

// Arquivos que são estritamente binários e não devem ter fallback automático como texto
const NON_TEXT_EXTENSIONS = new Set([
  // Binários executáveis e bibliotecas
  "exe", "dll", "so", "dylib", "bin", "iso", "img", "apk", "ipa",
  // Arquivos compactados
  "zip", "rar", "7z", "tar", "gz", "bz2", "xz",
  // Documentos binários complexos
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  // Mídia (tratada pelos players do OffliNet)
  "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "ts",
  "mp3", "wav", "flac", "ogg", "m4a", "aac", "wma",
  "jpg", "jpeg", "png", "gif", "webp", "bmp", "ico", "tiff"
]);

/**
 * Retorna o identificador de linguagem do Monaco a partir do nome do arquivo.
 * Se a extensão não for mapeada, aplica fallback para 'plaintext'.
 */
export function getMonacoLanguage(fileName: string): string {
  const cleanName = fileName.toLowerCase();
  
  if (cleanName === "dockerfile") return "dockerfile";
  if (cleanName.startsWith(".env")) return "plaintext";
  if (cleanName === "makefile") return "shell";

  const ext = cleanName.includes(".") ? cleanName.split(".").pop() || "" : "";
  return EXTENSION_TO_LANGUAGE[ext] || "plaintext";
}

/**
 * Verifica se um arquivo pode ser aberto no editor de texto.
 * Pastas e arquivos binários estritos (mídia/executável/zip/pdf) retornam false.
 * Qualquer outro arquivo tem fallback como texto (retorna true).
 */
export function canOpenAsText(fileName: string, mediaType?: string, isDirectory?: boolean): boolean {
  if (isDirectory) {
    return false;
  }

  if (mediaType === "video" || mediaType === "image" || mediaType === "audio") {
    // Se for áudio do tipo playlist .m3u ou .m3u8, ainda assim pode ser editado como texto
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".m3u") || lower.endsWith(".m3u8") || lower.endsWith(".svg")) {
      return true;
    }
    return false;
  }

  const ext = fileName.toLowerCase().includes(".")
    ? fileName.toLowerCase().split(".").pop() || ""
    : "";

  if (NON_TEXT_EXTENSIONS.has(ext)) {
    return false;
  }

  // Fallback permissivo: qualquer arquivo desconhecido pode ser aberto como texto
  return true;
}

/**
 * Lista de linguagens disponíveis para o seletor manual no editor
 */
export const POPULAR_LANGUAGES = [
  { id: "plaintext", label: "Texto Puro (Plain Text)" },
  { id: "markdown", label: "Markdown" },
  { id: "json", label: "JSON" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "python", label: "Python" },
  { id: "shell", label: "Shell Script" },
  { id: "sql", label: "SQL" },
  { id: "yaml", label: "YAML" },
  { id: "xml", label: "XML" },
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "csharp", label: "C#" },
  { id: "java", label: "Java" },
  { id: "rust", label: "Rust" },
  { id: "go", label: "Go" },
  { id: "php", label: "PHP" },
  { id: "ini", label: "INI / Config" },
  { id: "dockerfile", label: "Dockerfile" },
];
