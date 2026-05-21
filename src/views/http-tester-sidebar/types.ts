import { HttpCollection } from "../../../generators/http-tester.generator";
import * as vscode from "vscode";

export interface SocketTesterState {
  url: string;
  token: string;
  userId: string;
  eventName: string;
  payload: string;
}

export type SocketStatus = "Connected" | "Connecting" | "Disconnected";
export type SocketMessageType = "info" | "error" | "event";

export interface WebviewMessage {
  command: string;
  [key: string]: unknown;
}

export type CollectionType = "http" | "socket";
export type SidebarImportType = CollectionType;

export interface WebviewCommandSendRequest {
  command: "sendRequest";
  request: unknown;
}

export interface WebviewCommandOpenInEditor {
  command: "openInEditor";
  collection: HttpCollection;
}

export interface WebviewCommandSaveCollection {
  command: "saveCollection";
  collection: HttpCollection;
}

export interface WebviewCommandExportJson {
  command: "exportJson";
  collections: HttpCollection[];
}

export interface WebviewCommandImportJson {
  command: "importJson";
  type: SidebarImportType;
}

export interface WebviewCommandImportSwagger {
  command: "importSwagger";
  url: string;
}

export interface WebviewCommandDetectSwagger {
  command: "detectSwagger";
}

export interface WebviewCommandCopyToClipboard {
  command: "copyToClipboard";
  text: string;
}

export type HttpTesterSidebarCommand =
  | WebviewCommandSendRequest
  | WebviewCommandOpenInEditor
  | WebviewCommandSaveCollection
  | WebviewCommandExportJson
  | WebviewCommandImportJson
  | WebviewCommandImportSwagger
  | WebviewCommandDetectSwagger
  | WebviewCommandCopyToClipboard
  | WebviewMessage;
