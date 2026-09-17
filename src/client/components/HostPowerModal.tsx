import React, { useState, useEffect } from "react";
import {
  Power,
  RotateCcw,
  AlertTriangle,
  X,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Radio,
} from "lucide-react";

interface HostPowerModalProps {
  isOpen: boolean;
  actionType: "shutdown" | "restart" | null;
  hostname: string;
  osName: string;
  onClose: () => void;
}

export const HostPowerModal: React.FC<HostPowerModalProps> = ({
  isOpen,
  actionType,
  hostname,
  osName,
  onClose,
}) => {
  const [step, setStep] = useState<"confirm" | "countdown" | "done" | "error">("confirm");
  const [countdown, setCountdown] = useState(5);
  const [delayChoice, setDelayChoice] = useState<number>(5);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("confirm");
      setCountdown(delayChoice);
      setErrorMsg(null);
      setIsProcessing(false);
    }
  }, [isOpen, delayChoice]);

  // Handle countdown tick
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "countdown" && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (step === "countdown" && countdown === 0) {
      setStep("done");
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  if (!isOpen || !actionType) return null;

  const isShutdown = actionType === "shutdown";
  const title = isShutdown ? "Desligar Máquina Host" : "Reiniciar Máquina Host";
  const actionColor = isShutdown ? "red" : "amber";

  const handleConfirmAction = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    const seconds = delayChoice;
    setCountdown(seconds);

    try {
      const endpoint = isShutdown ? "/api/system/shutdown" : "/api/system/restart";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delaySeconds: seconds }),
      });

      const data = await res.json();
      if (data.success) {
        setStep("countdown");
      } else {
        setErrorMsg(data.error || "Não foi possível executar a ação.");
        setStep("error");
      }
    } catch (err: any) {
      setErrorMsg("Falha na comunicação com o servidor: " + err.message);
      setStep("error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelCountdown = async () => {
    try {
      await fetch("/api/system/cancel-shutdown", { method: "POST" });
    } catch (err) {
      console.error("Erro ao cancelar desligamento:", err);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden text-neutral-200">
        {/* Glow effect */}
        <div
          className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${
            isShutdown ? "bg-red-500" : "bg-amber-500"
          }`}
        />

        {/* Close Button (only active if not in final done step) */}
        {step !== "done" && (
          <button
            onClick={step === "countdown" ? handleCancelCountdown : onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* STEP 1: CONFIRM */}
        {step === "confirm" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isShutdown
                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                    : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                }`}
              >
                {isShutdown ? <Power className="w-6 h-6" /> : <RotateCcw className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{title}</h3>
                <p className="text-xs text-neutral-400">Controle de energia do servidor físico</p>
              </div>
            </div>

            <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between text-neutral-400">
                <span>Computador Host:</span>
                <span className="font-mono font-bold text-white">{hostname || "localhost"}</span>
              </div>
              <div className="flex items-center justify-between text-neutral-400">
                <span>Sistema Operacional:</span>
                <span className="font-mono text-neutral-300">{osName || "Host OS"}</span>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border text-xs flex gap-3 ${
                isShutdown
                  ? "bg-red-950/30 border-red-900/60 text-red-200"
                  : "bg-amber-950/30 border-amber-900/60 text-amber-200"
              }`}
            >
              <AlertTriangle className="w-5 h-5 flex-none mt-0.5 text-amber-400" />
              <div className="space-y-1">
                <span className="font-bold block">Atenção aos usuários conectados</span>
                <p className="text-neutral-300">
                  {isShutdown
                    ? "Esta ação desligará o computador por completo. Todos os serviços do OffliNet e transmissões ativas para Smart TVs e celulares serão encerrados. Para religar, será necessário pressionar o botão de ligar físico no computador."
                    : "Esta ação reiniciará o computador host. As reproduções ativas serão interrompidas até que a máquina e o OffliNet iniciem novamente."}
                </p>
              </div>
            </div>

            {/* Delay selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                <span>Tempo de tolerância antes de executar:</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "3 segundos", value: 3 },
                  { label: "5 segundos", value: 5 },
                  { label: "15 segundos", value: 15 },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDelayChoice(item.value)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      delayChoice === item.value
                        ? "bg-neutral-800 border-neutral-600 text-white shadow-sm"
                        : "bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 py-3 px-4 rounded-xl border border-neutral-800 bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isProcessing}
                className={`flex-1 py-3 px-4 rounded-xl text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                  isShutdown
                    ? "bg-red-600 hover:bg-red-700 shadow-red-600/20 disabled:opacity-50"
                    : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 disabled:opacity-50"
                }`}
              >
                {isShutdown ? <Power className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                <span>
                  {isProcessing
                    ? "Enviando comando..."
                    : isShutdown
                    ? "Sim, Desligar Máquina"
                    : "Sim, Reiniciar Máquina"}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: COUNTDOWN */}
        {step === "countdown" && (
          <div className="text-center py-4 space-y-6">
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div
                className={`absolute inset-0 rounded-full animate-ping opacity-25 ${
                  isShutdown ? "bg-red-500" : "bg-amber-500"
                }`}
              />
              <div
                className={`w-20 h-20 rounded-full border-2 flex items-center justify-center font-mono text-3xl font-black ${
                  isShutdown
                    ? "bg-red-950/80 border-red-500 text-red-400"
                    : "bg-amber-950/80 border-amber-500 text-amber-400"
                }`}
              >
                {countdown}
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">
                {isShutdown ? "Desligando a máquina host..." : "Reiniciando a máquina host..."}
              </h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                O comando foi enviado ao sistema operacional ({hostname}). A máquina será encerrada
                em instantes.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCancelCountdown}
                className="px-6 py-2.5 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-colors shadow-lg"
              >
                Cancelar Desligamento Imediatamente
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DONE */}
        {step === "done" && (
          <div className="text-center py-6 space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Comando Executado</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                {isShutdown
                  ? "A máquina host está sendo desligada agora. A conexão com o OffliNet foi encerrada. Você já pode fechar esta aba com segurança."
                  : "A máquina host está reiniciando. Aguarde alguns minutos e recarregue a página quando o computador tiver ligado novamente."}
              </p>
            </div>

            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-xl text-[11px] font-mono text-neutral-500">
              Host: {hostname || "Servidor"} • Status: Encerrando serviços
            </div>
          </div>
        )}

        {/* STEP 4: ERROR */}
        {step === "error" && (
          <div className="text-center py-4 space-y-5">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Falha ao Desligar</h3>
              <p className="text-xs text-red-300 max-w-sm mx-auto bg-red-950/40 p-3 rounded-xl border border-red-900/60">
                {errorMsg}
              </p>
            </div>

            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
