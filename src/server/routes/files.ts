import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { fileRepo, storageRepo } from "../db";
import { scanStorageRoot } from "../scanner";
import { getMimeType } from "../streamer";

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
    const cleanParentPath = parentPath === "/" ? "/" : parentPath.replace(/\\/g, "/");
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

  return null;
}
