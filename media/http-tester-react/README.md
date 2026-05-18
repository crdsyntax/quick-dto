# Guía de Integración: React + TypeScript + Tailwind en VS Code Webview

¡Felicidades! Hemos estructurado un frontend moderno, rápido y súper premium usando **Vite + React + TypeScript + TailwindCSS** para el panel **API Tester** dentro de tu extensión.

Aquí tienes los pasos exactos para instalar las dependencias, compilar y cargar esta aplicación en el Webview de tu extensión de VS Code.

---

## ⚡ 1. Instalación de Dependencias y Compilación

Entra en la carpeta de la interfaz desde tu terminal e instala los paquetes necesarios:

```bash
cd media/http-tester-react
npm install
```

### Para desarrollo web local (opcional):
Puedes probar la interfaz en tu navegador como si fuera una web estándar ejecutando:
```bash
npm run dev
```
*(Se abrirá un servidor en `http://localhost:5173`. Cuenta con fallbacks automáticos para no fallar si no detecta la API de VS Code).*

### Para producción (compilar para la extensión):
Cuando quieras probar la interfaz directamente dentro de la extensión de VS Code, compila el bundle:
```bash
npm run build
```
Esto generará los siguientes archivos estáticos optimizados en `media/http-tester-react/dist/`:
* `dist/index.html`
* `dist/assets/index.js`
* `dist/assets/index.css`

---

## 🔌 2. Integración en tu Extensión (`extension.ts` o `WebviewProvider.ts`)

En el archivo TypeScript de tu extensión de VS Code, donde creas el `WebviewPanel`, debes indicarle a VS Code que resuelva y cargue los archivos `.js` y `.css` compilados en `dist/` usando la URI local del Webview.

Aquí tienes la implementación recomendada para tu función `getWebviewContent`:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';

export function getWebviewContent(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
  const webview = panel.webview;

  // 1. Obtener URIs locales de los recursos compilados de Vite
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'http-tester-react', 'dist', 'assets', 'index.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'http-tester-react', 'dist', 'assets', 'index.css')
  );

  // 2. Definir una Política de Seguridad de Contenido (CSP) segura que permita scripts locales
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <!-- Content Security Policy -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource}; connect-src *;">
        <title>API Tester</title>
        <link rel="stylesheet" href="${styleUri}">
      </head>
      <body class="bg-[#050505] text-[#d1d1d1] min-h-screen font-mono">
        <div id="root"></div>
        <script src="${scriptUri}"></script>
      </body>
    </html>`;
}
```

---

## 🎨 3. Arquitectura del Código Generado

El código se ha diseñado siguiendo **principios SOLID y Clean Architecture** adaptados a React:

* **`src/types.ts`**: Centraliza todas las interfaces TypeScript para peticiones HTTP, respuestas, colecciones y sockets garantizando type-safety absoluto.
* **`src/hooks/useVSCode.ts`**: Custom hook aislado de React. Si estás probando localmente en la web, provee un fallback seguro para evitar errores en `acquireVsCodeApi()`. Si estás dentro de VS Code, se conecta de forma transparente para persistir el estado y enviar peticiones.
* **`src/components/Sidebar.tsx`**: Administra únicamente la visualización de colecciones, las importaciones/exportaciones JSON y Swagger.
* **`src/components/HttpPanel.tsx`**: Controla el estado local del cliente REST (métodos, cuerpo, parámetros y headers añadidos dinámicamente) y visualiza de forma premium las respuestas.
* **`src/components/SocketPanel.tsx`**: Contiene la lógica del cliente WebSocket / Socket.IO (conexiones, emisores de payloads y listeners en tiempo real).
* **`src/App.tsx`**: Es el orquestador principal. Escucha los eventos globales `postMessage` de tu extensión VS Code y distribuye el flujo reactivo.
