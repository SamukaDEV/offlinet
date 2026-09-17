import os from "os";
import { exec } from "child_process";
import Router from "routerun";
import { fileRepo, storageRepo } from "../db";
import { getLanAddresses } from "../network";
import { isFfmpegAvailable } from "../thumbnail";
import type { SystemInfo } from "../../types";

export const systemRouter = new Router();

let pendingShutdownTimeout: NodeJS.Timeout | null = null;
let pendingAction: "shutdown" | "restart" | null = null;

// GET /api/system/info
systemRouter.get("/info", (_req, res) => {
  const PORT = parseInt(process.env.PORT || "3000", 10);
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
  return res.json({ success: true, info });
});

// Helper function to execute OS power commands
function executeOsPowerCommand(action: "shutdown" | "restart", delaySeconds: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const platform = os.platform();
    let command = "";

    if (platform === "win32") {
      const flag = action === "shutdown" ? "/s" : "/r";
      const comment = action === "shutdown" 
        ? "OffliNet: Desligamento solicitado via painel" 
        : "OffliNet: Reinicializacao solicitada via painel";
      command = `shutdown ${flag} /t ${Math.max(1, delaySeconds)} /c "${comment}"`;
    } else if (platform === "linux") {
      if (action === "shutdown") {
        command = delaySeconds > 0
          ? `(sleep ${delaySeconds} && (systemctl poweroff || shutdown -h now || poweroff)) &`
          : `systemctl poweroff || shutdown -h now || poweroff`;
      } else {
        command = delaySeconds > 0
          ? `(sleep ${delaySeconds} && (systemctl reboot || shutdown -r now || reboot)) &`
          : `systemctl reboot || shutdown -r now || reboot`;
      }
    } else if (platform === "darwin") {
      const appleEvent = action === "shutdown" ? "shut down" : "restart";
      const unixFlag = action === "shutdown" ? "-h" : "-r";
      command = delaySeconds > 0
        ? `(sleep ${delaySeconds} && (osascript -e 'tell app "System Events" to ${appleEvent}' || shutdown ${unixFlag} now)) &`
        : `osascript -e 'tell app "System Events" to ${appleEvent}' || shutdown ${unixFlag} now`;
    } else {
      return reject(new Error(`Plataforma ${platform} não suportada para gerenciamento de energia.`));
    }

    console.log(`[System Power] Executando (${action}) em ${platform}: ${command}`);
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`[System Power] Erro ao executar comando:`, error, stderr);
        return reject(new Error(stderr || error.message));
      }
      resolve(stdout || "Comando enviado com sucesso.");
    });
  });
}

// POST /api/system/shutdown
systemRouter.post("/shutdown", async (req, res) => {
  try {
    let delaySeconds = 3;
    try {
      const body = await req.raw.json();
      if (typeof body?.delaySeconds === "number" && body.delaySeconds >= 0) {
        delaySeconds = body.delaySeconds;
      }
    } catch {
      // JSON body is optional
    }

    if (pendingShutdownTimeout) {
      clearTimeout(pendingShutdownTimeout);
      pendingShutdownTimeout = null;
    }

    pendingAction = "shutdown";

    // Schedule command with small buffer to allow HTTP response to flush back to the client
    setTimeout(() => {
      executeOsPowerCommand("shutdown", delaySeconds).catch((err) => {
        console.error("[System Power] Falha no desligamento agendado:", err);
      });
    }, 500);

    return res.json({
      success: true,
      action: "shutdown",
      delaySeconds,
      message: `Desligamento do host ${os.hostname()} iniciado em ${delaySeconds}s.`,
    });
  } catch (err: any) {
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// POST /api/system/restart
systemRouter.post("/restart", async (req, res) => {
  try {
    let delaySeconds = 3;
    try {
      const body = await req.raw.json();
      if (typeof body?.delaySeconds === "number" && body.delaySeconds >= 0) {
        delaySeconds = body.delaySeconds;
      }
    } catch {
      // JSON body is optional
    }

    if (pendingShutdownTimeout) {
      clearTimeout(pendingShutdownTimeout);
      pendingShutdownTimeout = null;
    }

    pendingAction = "restart";

    setTimeout(() => {
      executeOsPowerCommand("restart", delaySeconds).catch((err) => {
        console.error("[System Power] Falha no reinício agendado:", err);
      });
    }, 500);

    return res.json({
      success: true,
      action: "restart",
      delaySeconds,
      message: `Reinicialização do host ${os.hostname()} iniciada em ${delaySeconds}s.`,
    });
  } catch (err: any) {
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});

// POST /api/system/cancel-shutdown
systemRouter.post("/cancel-shutdown", async (_req, res) => {
  try {
    if (pendingShutdownTimeout) {
      clearTimeout(pendingShutdownTimeout);
      pendingShutdownTimeout = null;
    }

    const platform = os.platform();
    let cancelCmd = "";
    if (platform === "win32") {
      cancelCmd = "shutdown /a";
    } else if (platform === "linux") {
      cancelCmd = "shutdown -c";
    }

    if (cancelCmd) {
      exec(cancelCmd, (error) => {
        if (error) {
          console.warn("[System Power] Aviso ao cancelar comando no SO:", error.message);
        }
      });
    }

    pendingAction = null;
    return res.json({
      success: true,
      message: "Desligamento/reinicialização cancelada com sucesso.",
    });
  } catch (err: any) {
    return res.json({ success: false, error: err.message }, { status: 500 });
  }
});
