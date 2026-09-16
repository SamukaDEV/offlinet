import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { fileRepo, storageRepo, db } from "../db";
import { scanStorageRoot, generateFileId } from "../scanner";
import { getMimeType } from "../streamer";
import { getCachedThumbnailPath } from "../thumbnail";

export async function handleFilesRoutes(req: Request, url: URL): Promise<Response | null> {
  const pathname = url.pathname;
  const method = req.method;

  // GET /api/files/browse?storageId=...&path=...
  if (pathname === "/api/files/browse" && method === "GET") {
    const storageId = url.searchParams.get("storageId");
    const parentPath = url.searchParams.get("path") || "/";

    if (!storageId) {
      // If no storage selected, return list of available storage roots as top-level folders
      const roots = storageRepo.getAll();
      return Response.json({
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
      return Response.json({ success: false, error: "Volume de armazenamento não encontrado" }, { status: 404 });
    }

    // List files from database in this folder
    const rawClean = parentPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const cleanParentPath = rawClean === "" ? "/" : rawClean;
    let items = fileRepo.listByFolder(storageId, cleanParentPath);

    // Build breadcrumbs
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

    return Response.json({
      success: true,
      currentPath: cleanParentPath,
      storageId: storage.id,
      storageName: storage.name,
      items,
      breadcrumbs,
    });
  }

  // POST /api/files/upload - Upload file(s) via multipart/form-data
  if (pathname === "/api/files/upload" && method === "POST") {
    try {
      const formData = await req.formData();
      const storageId = formData.get("storageId") as string;
      const targetFolder = (formData.get("targetFolder") as string) || "";
      const file = formData.get("file") as File;

      if (!storageId || !file) {
        return Response.json({ success: false, error: "Volume e arquivo são obrigatórios" }, { status: 400 });
      }

      const storage = storageRepo.getById(storageId);
      if (!storage) {
        return Response.json({ success: false, error: "Volume de armazenamento não encontrado" }, { status: 404 });
      }

      const cleanFolder = targetFolder.replace(/^\/+|\/+$/g, "");
      const destDir = cleanFolder ? path.join(storage.path, cleanFolder) : storage.path;

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const destFilePath = path.join(destDir, file.name);
      
      // Stream file directly to disk to prevent RAM consumption with large multi-gigabyte files
      const writeStream = fs.createWriteStream(destFilePath);
      await pipeline(Readable.fromWeb(file.stream() as any), writeStream);

      // Re-scan this storage root in background to index new file
      scanStorageRoot(storageId).catch(console.error);

      return Response.json({
        success: true,
        filename: file.name,
        size: file.size,
        path: destFilePath,
      });
    } catch (err: any) {
      console.error("[Upload] Erro ao fazer upload:", err);
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // POST /api/files/upload-stream - Stream file binary body directly to disk
  if (pathname === "/api/files/upload-stream" && method === "POST") {
    try {
      const storageId = req.headers.get("x-storage-id");
      const rawTargetFolder = req.headers.get("x-target-folder") || "";
      const rawFileName = req.headers.get("x-file-name") || "";
      const targetFolder = decodeURIComponent(rawTargetFolder);
      const fileName = decodeURIComponent(rawFileName);

      if (!storageId || !fileName) {
        return Response.json({ success: false, error: "Parâmetros x-storage-id e x-file-name são obrigatórios" }, { status: 400 });
      }

      if (!req.body) {
        return Response.json({ success: false, error: "Corpo da requisição vazio" }, { status: 400 });
      }

      const storage = storageRepo.getById(storageId);
      if (!storage) {
        return Response.json({ success: false, error: "Volume de armazenamento não encontrado" }, { status: 404 });
      }

      const cleanFolder = targetFolder.replace(/^\/+|\/+$/g, "");
      const destDir = cleanFolder ? path.join(storage.path, cleanFolder) : storage.path;

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const destFilePath = path.join(destDir, fileName);
      const writeStream = fs.createWriteStream(destFilePath);
      await pipeline(Readable.fromWeb(req.body as any), writeStream);

      const stat = fs.statSync(destFilePath);

      // Re-scan this storage root in background
      scanStorageRoot(storageId).catch(console.error);

      return Response.json({
        success: true,
        filename: fileName,
        size: stat.size,
        path: destFilePath,
      });
    } catch (err: any) {
      console.error("[Upload Stream] Erro no stream de upload:", err);
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // GET /api/files/download/:id - Download file
  if (pathname.startsWith("/api/files/download/") && method === "GET") {
    const id = pathname.replace("/api/files/download/", "");
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
  }

  // POST /api/files/mkdir - Create new directory
  if (pathname === "/api/files/mkdir" && method === "POST") {
    try {
      const body = await req.json();
      const { storageId, parentPath, folderName } = body;

      if (!storageId || !folderName) {
        return Response.json({ success: false, error: "Volume e nome da pasta são obrigatórios" }, { status: 400 });
      }

      const storage = storageRepo.getById(storageId);
      if (!storage) {
        return Response.json({ success: false, error: "Volume não encontrado" }, { status: 404 });
      }

      const cleanParent = (parentPath || "").replace(/^\/+|\/+$/g, "");
      const newDirPath = cleanParent
        ? path.join(storage.path, cleanParent, folderName)
        : path.join(storage.path, folderName);

      if (fs.existsSync(newDirPath)) {
        return Response.json({ success: false, error: "Pasta já existe" }, { status: 400 });
      }

      fs.mkdirSync(newDirPath, { recursive: true });
      await scanStorageRoot(storageId);

      return Response.json({ success: true, folderPath: newDirPath });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // POST /api/files/rename - Rename file or folder
  if (pathname === "/api/files/rename" && method === "POST") {
    try {
      const body = await req.json();
      const { id, newName } = body;

      if (!id || !newName) {
        return Response.json({ success: false, error: "ID e novo nome são obrigatórios" }, { status: 400 });
      }

      const file = fileRepo.getById(id);
      if (!file || !fs.existsSync(file.fullPath)) {
        return Response.json({ success: false, error: "Arquivo ou pasta não encontrado" }, { status: 404 });
      }

      const parentDir = path.dirname(file.fullPath);
      const newFullPath = path.join(parentDir, newName);

      if (fs.existsSync(newFullPath)) {
        return Response.json({ success: false, error: "Já existe um item com esse nome" }, { status: 400 });
      }

      fs.renameSync(file.fullPath, newFullPath);
      await scanStorageRoot(file.storageId);

      return Response.json({ success: true });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // DELETE /api/files/:id - Delete file or folder
  if (pathname.startsWith("/api/files/") && method === "DELETE") {
    const id = pathname.replace("/api/files/", "");
    const file = fileRepo.getById(id);

    if (!file) {
      return Response.json({ success: false, error: "Arquivo não encontrado no catálogo" }, { status: 404 });
    }

    if (fs.existsSync(file.fullPath)) {
      try {
        if (file.isDirectory) {
          fs.rmSync(file.fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(file.fullPath);
        }
      } catch (err: any) {
        return Response.json({ success: false, error: `Falha ao apagar do disco: ${err.message}` }, { status: 500 });
      }
    }

    fileRepo.deleteFile(id);
    return Response.json({ success: true });
  }

  // GET /api/files/folders?storageId=... - List available directories in a storage volume
  if (pathname === "/api/files/folders" && method === "GET") {
    const storageId = url.searchParams.get("storageId");
    if (!storageId) {
      return Response.json({ success: false, error: "storageId é obrigatório" }, { status: 400 });
    }
    const folders = fileRepo.listFolders(storageId);
    return Response.json({ success: true, folders });
  }

  // POST /api/files/move - Move file or folder between directories or disks
  if (pathname === "/api/files/move" && method === "POST") {
    try {
      const body = await req.json();
      const { fileId, targetStorageId, targetParentPath } = body;

      if (!fileId || !targetStorageId) {
        return Response.json({ success: false, error: "fileId e targetStorageId são obrigatórios" }, { status: 400 });
      }

      const file = fileRepo.getById(fileId);
      if (!file || !fs.existsSync(file.fullPath)) {
        return Response.json({ success: false, error: "Arquivo ou pasta de origem não encontrado" }, { status: 404 });
      }

      const targetStorage = storageRepo.getById(targetStorageId);
      if (!targetStorage || !fs.existsSync(targetStorage.path)) {
        return Response.json({ success: false, error: "Volume de destino não encontrado no servidor" }, { status: 404 });
      }

      const cleanTargetFolder = (targetParentPath || "").replace(/^\/+|\/+$/g, "");
      const destDir = cleanTargetFolder ? path.join(targetStorage.path, cleanTargetFolder) : targetStorage.path;

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const destFilePath = path.join(destDir, file.name);

      if (destFilePath.toLowerCase() === file.fullPath.toLowerCase()) {
        return Response.json({ success: true, message: "O arquivo já se encontra neste local" });
      }

      if (fs.existsSync(destFilePath)) {
        return Response.json({ success: false, error: "Já existe um arquivo ou pasta com esse nome no destino" }, { status: 400 });
      }

      // Execute Move (Atomic rename if same drive, or copy + unlink if cross-drive e.g. C: -> D:)
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

      // Calculate new relative path & file ID
      const newRelativePath = cleanTargetFolder ? `${cleanTargetFolder}/${file.name}`.replace(/\\/g, "/") : file.name;
      const newFileId = generateFileId(targetStorage.id, newRelativePath);

      if (newFileId !== file.id) {
        // Transfer cached thumbnail if exists
        const oldThumb = getCachedThumbnailPath(file.id);
        const newThumb = getCachedThumbnailPath(newFileId);
        if (fs.existsSync(oldThumb)) {
          try { fs.renameSync(oldThumb, newThumb); } catch {}
        }

        // Transfer watch history
        try {
          db.run(`UPDATE watch_history SET file_id = ? WHERE file_id = ?`, [newFileId, file.id]);
        } catch {}
      }

      // Re-scan both source and target roots
      await scanStorageRoot(file.storageId);
      if (targetStorage.id !== file.storageId) {
        await scanStorageRoot(targetStorage.id);
      }

      return Response.json({
        success: true,
        newFileId,
        newPath: destFilePath,
      });
    } catch (err: any) {
      console.error("[Move] Erro ao mover item:", err);
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  return null;
}
