import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import Router from "routerun";
import { fileRepo, storageRepo, db } from "../db";
import { scanStorageRoot, generateFileId } from "../scanner";
import { getMimeType } from "../streamer";
import { getCachedThumbnailPath } from "../thumbnail";

export const filesRouter = new Router();

// GET /api/files/browse?storageId=...&path=...
filesRouter.get("/browse", (req, res) => {
  const url = new URL(req.url);
  const storageId = url.searchParams.get("storageId");
  const parentPath = url.searchParams.get("path") || "/";

  if (!storageId) {
    const roots = storageRepo.getAll();
    return res.json({
      success: true,
      currentPath: "/",
      storageId: null,
      storageName: null,
      items: roots.map((r) => ({
        id: `root-${r.id}`,
        storageId: r.id,
        storageName: r.name,
        relativePath: "",
        fullPath: r.path,
        name: r.name,
        extension: "",
        size: 0,
        isDirectory: true,
        mediaType: "other",
        mimeType: "directory",
        parentPath: "/",
        updatedAt: r.createdAt,
        fileCount: r.fileCount,
      })),
      breadcrumbs: [{ name: "Todos os Discos", path: "/", storageId: null }],
    });
  }

  const storage = storageRepo.getById(storageId);
  if (!storage) {
    return res.json({ success: false, error: "Volume de armazenamento não encontrado" }, { status: 404 });
  }

  const rawClean = parentPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const cleanParentPath = rawClean === "" ? "/" : rawClean;
  let items = fileRepo.listByFolder(storageId, cleanParentPath);

  const breadcrumbs: { name: string; path: string; storageId: string | null }[] = [
    { name: "Todos os Discos", path: "/", storageId: null },
    { name: storage.name, path: "/", storageId: storage.id },
  ];

  if (cleanParentPath !== "/") {
    const parts = cleanParentPath.split("/").filter(Boolean);
    let accumulated = "";
    for (const part of parts) {
      accumulated += (accumulated ? "/" : "") + part;
      breadcrumbs.push({
        name: part,
        path: accumulated,
        storageId: storage.id,
      });
    }
  }

  return res.json({
    success: true,
    currentPath: cleanParentPath,
    storageId: storage.id,
    storageName: storage.name,
    items,
    breadcrumbs,
  });
});

// GET /api/files/folders?storageId=...
filesRouter.get("/folders", (req, res) => {
  const url = new URL(req.url);
  const storageId = url.searchParams.get("storageId");
  if (!storageId) {
    return res.json({ success: false, error: "storageId é obrigatório" }, { status: 400 });
  }
  const folders = fileRepo.listFolders(storageId);
  return res.json({ success: true, folders });
});

// GET /api/files/download/:id
filesRouter.get("/download/:id", (req) => {
  const id = req.params.id;
  const item = fileRepo.getById(id);

  if (!item || !fs.existsSync(item.fullPath)) {
    return new Response("Arquivo não encontrado", { status: 404 });
  }

  const bunFile = Bun.file(item.fullPath);
  const encodedName = encodeURIComponent(item.name);

  return new Response(bunFile, {
    headers: {
      "Content-Type": item.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Content-Length": item.size.toString(),
    },
  });
});

// POST /api/files/upload
filesRouter.post("/upload", async (req, res) => {
  try {
    const formData = await req.raw.formData();
    const storageId = formData.get("storageId") as string;
    const targetFolder = (formData.get("targetFolder") as string) || "";
    const file = formData.get("file") as File;

    if (!storageId || !file) {
      return res.json({ success: false, error: "Volume e arquivo são obrigatórios" }, { status: 400 });
    }

    const storage = storageRepo.getById(storageId);
    if (!storage) {
      return res.json({ success: false, error: "Volume de armazenamento não encontrado" }, { status: 404 });
    }

    const cleanFolder = targetFolder.replace(/^\/+|\/+$/g, "");
    const destDir = cleanFolder ? path.join(storage.path, cleanFolder) : storage.path;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destFilePath = path.join(destDir, file.name);
    const writeStream = fs.createWriteStream(destFilePath);
    await pipeline(Readable.fromWeb(file.stream() as any), writeStream);

    scanStorageRoot(storageId).catch(console.error);

    return res.json({
      success: true,
      filename: file.name,
      size: file.size,
      path: destFilePath,
    });
  } catch (err: any) {
    console.error("[Upload] Erro ao fazer upload:", err);
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// POST /api/files/upload-stream
filesRouter.post("/upload-stream", async (req, res) => {
  try {
    const storageId = req.raw.headers.get("x-storage-id");
    const rawTargetFolder = req.raw.headers.get("x-target-folder") || "";
    const rawFileName = req.raw.headers.get("x-file-name") || "";
    const targetFolder = decodeURIComponent(rawTargetFolder);
    const fileName = decodeURIComponent(rawFileName);

    if (!storageId || !fileName) {
      return res.json({ success: false, error: "Parâmetros x-storage-id e x-file-name são obrigatórios" }, { status: 400 });
    }

    if (!req.raw.body) {
      return res.json({ success: false, error: "Corpo da requisição vazio" }, { status: 400 });
    }

    const storage = storageRepo.getById(storageId);
    if (!storage) {
      return res.json({ success: false, error: "Volume de armazenamento não encontrado" }, { status: 404 });
    }

    const cleanFolder = targetFolder.replace(/^\/+|\/+$/g, "");
    const destDir = cleanFolder ? path.join(storage.path, cleanFolder) : storage.path;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destFilePath = path.join(destDir, fileName);
    const writeStream = fs.createWriteStream(destFilePath);
    await pipeline(Readable.fromWeb(req.raw.body as any), writeStream);

    const stat = fs.statSync(destFilePath);
    scanStorageRoot(storageId).catch(console.error);

    return res.json({
      success: true,
      filename: fileName,
      size: stat.size,
      path: destFilePath,
    });
  } catch (err: any) {
    console.error("[Upload Stream] Erro no stream de upload:", err);
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// POST /api/files/mkdir
filesRouter.post("/mkdir", async (req, res) => {
  try {
    const body = await req.raw.json();
    const { storageId, parentPath, folderName } = body;

    if (!storageId || !folderName) {
      return res.json({ success: false, error: "Volume e nome da pasta são obrigatórios" }, { status: 400 });
    }

    const storage = storageRepo.getById(storageId);
    if (!storage) {
      return res.json({ success: false, error: "Volume não encontrado" }, { status: 404 });
    }

    const cleanParent = (parentPath || "").replace(/^\/+|\/+$/g, "");
    const newDirPath = cleanParent
      ? path.join(storage.path, cleanParent, folderName)
      : path.join(storage.path, folderName);

    if (fs.existsSync(newDirPath)) {
      return res.json({ success: false, error: "Pasta já existe" }, { status: 400 });
    }

    fs.mkdirSync(newDirPath, { recursive: true });
    await scanStorageRoot(storageId);

    return res.json({ success: true, folderPath: newDirPath });
  } catch (err: any) {
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// POST /api/files/rename
filesRouter.post("/rename", async (req, res) => {
  try {
    const body = await req.raw.json();
    const { id, newName } = body;

    if (!id || !newName) {
      return res.json({ success: false, error: "ID e novo nome são obrigatórios" }, { status: 400 });
    }

    const file = fileRepo.getById(id);
    if (!file || !fs.existsSync(file.fullPath)) {
      return res.json({ success: false, error: "Arquivo ou pasta não encontrado" }, { status: 404 });
    }

    const parentDir = path.dirname(file.fullPath);
    const newFullPath = path.join(parentDir, newName);

    if (fs.existsSync(newFullPath)) {
      return res.json({ success: false, error: "Já existe um item com esse nome" }, { status: 400 });
    }

    fs.renameSync(file.fullPath, newFullPath);
    await scanStorageRoot(file.storageId);

    return res.json({ success: true });
  } catch (err: any) {
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// POST /api/files/move
filesRouter.post("/move", async (req, res) => {
  try {
    const body = await req.raw.json();
    const { fileId, targetStorageId, targetParentPath } = body;

    if (!fileId || !targetStorageId) {
      return res.json({ success: false, error: "fileId e targetStorageId são obrigatórios" }, { status: 400 });
    }

    const file = fileRepo.getById(fileId);
    if (!file || !fs.existsSync(file.fullPath)) {
      return res.json({ success: false, error: "Arquivo ou pasta de origem não encontrado" }, { status: 404 });
    }

    const targetStorage = storageRepo.getById(targetStorageId);
    if (!targetStorage || !fs.existsSync(targetStorage.path)) {
      return res.json({ success: false, error: "Volume de destino não encontrado no servidor" }, { status: 404 });
    }

    const cleanTargetFolder = (targetParentPath || "").replace(/^\/+|\/+$/g, "");
    const destDir = cleanTargetFolder ? path.join(targetStorage.path, cleanTargetFolder) : targetStorage.path;

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destFilePath = path.join(destDir, file.name);

    if (destFilePath.toLowerCase() === file.fullPath.toLowerCase()) {
      return res.json({ success: true, message: "O arquivo já se encontra neste local" });
    }

    if (fs.existsSync(destFilePath)) {
      return res.json({ success: false, error: "Já existe um arquivo ou pasta com esse nome no destino" }, { status: 400 });
    }

    try {
      fs.renameSync(file.fullPath, destFilePath);
    } catch (err: any) {
      if (err.code === "EXDEV" || err.message?.includes("cross-device")) {
        if (file.isDirectory) {
          fs.cpSync(file.fullPath, destFilePath, { recursive: true });
          fs.rmSync(file.fullPath, { recursive: true, force: true });
        } else {
          fs.copyFileSync(file.fullPath, destFilePath);
          fs.unlinkSync(file.fullPath);
        }
      } else {
        throw err;
      }
    }

    const newRelativePath = cleanTargetFolder ? `${cleanTargetFolder}/${file.name}`.replace(/\\/g, "/") : file.name;
    const newFileId = generateFileId(targetStorage.id, newRelativePath);

    if (newFileId !== file.id) {
      const oldThumb = getCachedThumbnailPath(file.id);
      const newThumb = getCachedThumbnailPath(newFileId);
      if (fs.existsSync(oldThumb)) {
        try { fs.renameSync(oldThumb, newThumb); } catch {}
      }

      try {
        db.run(`UPDATE watch_history SET file_id = ? WHERE file_id = ?`, [newFileId, file.id]);
      } catch {}
    }

    await scanStorageRoot(file.storageId);
    if (targetStorage.id !== file.storageId) {
      await scanStorageRoot(targetStorage.id);
    }

    return res.json({
      success: true,
      newFileId,
      newPath: destFilePath,
    });
  } catch (err: any) {
    console.error("[Move] Erro ao mover item:", err);
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// POST /api/files/metadata
filesRouter.post("/metadata", async (req, res) => {
  try {
    const body = await req.raw.json();
    const { id, duration, width, height } = body;
    if (!id) {
      return res.json({ success: false, error: "Parâmetro id é obrigatório" }, { status: 400 });
    }

    fileRepo.updateMetadata(id, {
      duration: typeof duration === "number" && duration > 0 ? duration : undefined,
      width: typeof width === "number" && width > 0 ? width : undefined,
      height: typeof height === "number" && height > 0 ? height : undefined,
    });

    return res.json({ success: true });
  } catch (err: any) {
    console.error("[Files] Erro ao atualizar metadados:", err);
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// DELETE /api/files/:id
filesRouter.delete("/:id", (req, res) => {
  const id = req.params.id;
  const file = fileRepo.getById(id);

  if (!file) {
    return res.json({ success: false, error: "Arquivo não encontrado no catálogo" }, { status: 404 });
  }

  if (fs.existsSync(file.fullPath)) {
    try {
      if (file.isDirectory) {
        fs.rmSync(file.fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(file.fullPath);
      }
    } catch (err: any) {
      return res.json({ success: false, error: `Falha ao apagar do disco: ${err.message}` }, { status: 500 });
    }
  }

  fileRepo.deleteFile(id);
  return res.json({ success: true });
});
