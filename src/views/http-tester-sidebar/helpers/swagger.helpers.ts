import * as fs from "fs";
import * as vscode from "vscode";

export async function detectSwaggerUrls(
  workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined
): Promise<string[]> {
  if (!workspaceFolders) {
    return [];
  }

  const urls: string[] = [];

  for (const folder of workspaceFolders) {
    const envFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, "**/.env")
    );

    let port = "3000";
    for (const envFile of envFiles) {
      try {
        const content = fs.readFileSync(envFile.fsPath, "utf8");
        const portMatch = content.match(/^PORT=(\d+)/m);
        if (portMatch) {
          port = portMatch[1];
          break;
        }
      } catch (error) {
        // ignore invalid env files
      }
    }

    const swaggerFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, "**/src/**/*.ts")
    );

    let swaggerPath = "api/doc";
    for (const swaggerFile of swaggerFiles) {
      try {
        const content = fs.readFileSync(swaggerFile.fsPath, "utf8");
        const setupMatch = content.match(/SwaggerModule\.setup\(\s*["']([^"']+)["']/);
        if (setupMatch) {
          swaggerPath = setupMatch[1];
          break;
        }
      } catch (error) {
        // ignore parsing failures
      }
    }

    urls.push(`http://localhost:${port}/${swaggerPath}-json`);
    urls.push(`http://localhost:${port}/api-json`);
    urls.push(`http://localhost:${port}/swagger-json`);

    const localSwaggerFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(
        folder,
        "**/{swagger,openapi,api-docs}*.{json,yaml,yml}"
      )
    );

    for (const file of localSwaggerFiles) {
      urls.push(file.fsPath);
    }
  }

  return Array.from(new Set(urls));
}

export async function loadOpenApiJson(urlOrPath: string): Promise<unknown> {
  if (urlOrPath.startsWith("http")) {
    const axios = require("axios");
    const response = await axios.get(urlOrPath);
    return response.data;
  }

  const content = fs.readFileSync(urlOrPath, "utf8");
  if (urlOrPath.endsWith(".yaml") || urlOrPath.endsWith(".yml")) {
    const yaml = require("js-yaml");
    return yaml.load(content);
  }

  return JSON.parse(content);
}

export function resolveOpenApiBaseUrl(urlOrPath: string): string {
  if (urlOrPath.startsWith("http")) {
    return new URL(urlOrPath).origin;
  }

  return "http://localhost:3000";
}
