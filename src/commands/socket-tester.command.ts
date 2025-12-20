import * as vscode from "vscode";
import { io, Socket } from "socket.io-client";

export async function registerSocketTesterCommand(context: vscode.ExtensionContext) {
  const channel = vscode.window.createOutputChannel("Socket Tester");
  channel.show(true);

  // --- Configuración inicial ---
  const SOCKET_URL = await vscode.window.showInputBox({
    prompt: "Ingresa la URL del Socket.IO",
    value: "http://localhost:3000",
  });
  if (!SOCKET_URL) return vscode.window.showErrorMessage("No se proporcionó URL de socket");

  const TOKEN = await vscode.window.showInputBox({ prompt: "Ingresa el token (opcional)" });
  const USER_ID = await vscode.window.showInputBox({ prompt: "Ingresa userId para room (opcional)" });

  const socket: Socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    auth: TOKEN ? { token: `Bearer ${TOKEN}` } : undefined,
  });

  socket.on("connect", () => {
    channel.appendLine(`[Socket] Conectado: ${socket.id}`);
    vscode.window.showInformationMessage(`[Socket] Conectado: ${socket.id}`);
    if (USER_ID) {
      socket.emit("join", USER_ID);
      channel.appendLine(`[Socket] Se unió al room ${USER_ID}`);
    }
    mainMenu();
  });

  socket.on("disconnect", (reason) => channel.appendLine(`[Socket] Desconectado: ${reason}`));
  socket.onAny((event, ...args) => {
    channel.appendLine(`[Evento recibido] ${event}: ${JSON.stringify(args)}`);
  });

  // --- Menú principal usando QuickPick ---
  async function mainMenu() {
    const option = await vscode.window.showQuickPick(
      [
        { label: "📤 Emitir evento", action: "emit" },
        { label: "❌ Salir y desconectar", action: "exit" },
      ],
      { placeHolder: "Selecciona acción" }
    );

    if (!option) return;

    if (option.action === "exit") {
      socket.disconnect();
      channel.appendLine("[Socket] Desconectado manualmente");
      return;
    }

    if (option.action === "emit") {
      await emitEventMenu();
      mainMenu(); // regresar al menú principal
    }
  }

  // --- Selección de eventos para emitir ---
  async function emitEventMenu() {
    const predefinedEvents = [
      { label: "return:notification", description: "Pedir notificaciones de usuario" },
      { label: "read:notificacion", description: "Marcar notificación como leída" },
      { label: "read:notification:all", description: "Marcar todas como leídas" },
      { label: "Otro evento...", description: "Escribe un evento personalizado" },
    ];

    const selectedEvent = await vscode.window.showQuickPick(predefinedEvents, {
      placeHolder: "Selecciona evento a emitir",
    });

    if (!selectedEvent) return;

    let eventName = selectedEvent.label;
    if (selectedEvent.label === "Otro evento...") {
      const custom = await vscode.window.showInputBox({ prompt: "Nombre del evento" });
      if (!custom) return;
      eventName = custom;
    }

    // --- Payload dinámico ---
    const payloadInput = await vscode.window.showInputBox({
      prompt: "Ingresa payload en JSON (o dejar vacío para {})",
    });

    let payload = {};
    if (payloadInput) {
      try {
        payload = JSON.parse(payloadInput);
      } catch (err: any) {
        vscode.window.showErrorMessage("Error parseando JSON: " + err.message);
        return;
      }
    }

    socket.emit(eventName, payload);
    channel.appendLine(`[Emitido] ${eventName}: ${JSON.stringify(payload)}`);
  }
}
