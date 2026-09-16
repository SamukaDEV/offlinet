import fs from "fs";
import crypto from "crypto";
import { storageRepo } from "../db";
import { scanStorageRoot, scanAllRoots } from "../scanner";

export async function handleStorageRoutes(req: Request, url: URL): Promise<Response | null> {
  const path = url.pathname;
  const method = req.method;

  // GET /api/storage - list all storage roots
  if (path === "/api/storage" && method === "GET") {
    const roots = storageRepo.getAll();
    return Response.json({ success: true, roots });
  }

  // POST /api/storage - add new root
  if (path === "/api/storage" && method === "POST") {
    try {
      const body = await req.json();
      const { name, path: dirPath } = body;

      if (!name || !dirPath) {
        return Response.json({ success: false, error: "Nome e caminho são obrigatórios" }, { status: 400 });
      }

      // Verify directory exists
      if (!fs.existsSync(dirPath)) {
        return Response.json({ success: false, error: `Caminho "${dirPath}" não existe no servidor` }, { status: 400 });
      }

      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        return Response.json({ success: false, error: `O caminho "${dirPath}" não é uma pasta` }, { status: 400 });
      }

      const id = crypto.randomUUID();
      const newRoot = storageRepo.add({ id, name, path: dirPath, isActive: true });

      // Trigger asynchronous scan for this new root
      scanStorageRoot(newRoot.id).catch(console.error);

      return Response.json({ success: true, root: newRoot });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // PATCH /api/storage/:id - update root
  if (path.startsWith("/api/storage/") && method === "PATCH") {
    const id = path.replace("/api/storage/", "");
    try {
      const body = await req.json();
      const updated = storageRepo.update(id, body);
      return Response.json({ success: updated });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // DELETE /api/storage/:id - delete root
  if (path.startsWith("/api/storage/") && method === "DELETE") {
    const id = path.replace("/api/storage/", "");
    const deleted = storageRepo.delete(id);
    return Response.json({ success: deleted });
  }

  // POST /api/storage/scan - trigger re-index
  if (path === "/api/storage/scan" && method === "POST") {
    // Run async in background and respond immediately
    scanAllRoots().catch(console.error);
    return Response.json({ success: true, message: "Varredura iniciada em segundo plano" });
  }

  return null;
}
