import { SocketTesterState } from "./types";

export interface SocketClientOptions {
  transports: ["websocket", "polling"];
  auth?: { token: string };
  query?: { userId: string };
}

export function buildSocketClientOptions(
  state: SocketTesterState
): SocketClientOptions {
  return {
    transports: ["websocket", "polling"],
    auth: state.token ? { token: `Bearer ${state.token}` } : undefined,
    query: state.userId ? { userId: state.userId } : undefined,
  };
}

export function parseSocketPayload(payload: string): unknown {
  const trimmedPayload = payload.trim();
  if (trimmedPayload.length === 0) {
    return {};
  }
  return JSON.parse(trimmedPayload);
}
