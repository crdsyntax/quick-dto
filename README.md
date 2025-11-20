# NestJS tools Generator (Nest Helper Files)

Generador de archivos para proyectos NestJS: DTOs con Swagger, Repositories, Services, Controllers y CRUD completo a partir de entidades TypeORM. Incluye una herramienta de autocompletado que intenta inferir el tipo de retorno de métodos async y un generador que crea endpoints de controller a partir de funciones seleccionadas.

## Qué hace

- Genera `create`/`update` DTOs (con `@ApiProperty`) para una entidad.
- Genera archivos de Repository, Service y Controller a partir de entidades y servicios.
- Generador de Controller por función: crea endpoints en controllers existentes o genera el controller en la raíz del módulo cuando no existe (busca el `*.module.ts` más cercano).
- Autocompletado inteligente (`Complete Return Type`) que infiere y añade `: Promise<T>` en funciones `async` basándose en el cuerpo de la función.
- Acciones disponibles desde el menú contextual del explorador (right-click) y atajos de teclado para funciones de editor.

## Instalación (local / desarrollo)

1. Clona el repositorio y entra en la carpeta del proyecto:

```bash
git clone https://github.com/crdsyntax/quick-dto.git
cd quick-dto
```

2. Instala dependencias y compila:

```bash
npm install
npm run compile
```

3. Ejecuta en modo desarrollo (F5) desde VS Code para probar en una ventana de Extension Host.

## Empaquetado e instalación (.vsix)

1. Asegúrate de compilar antes de empaquetar:

```bash
npm run compile
npx vsce package
```

2. Instala el `.vsix` en VS Code (Extensions → ••• → Install from VSIX...).

## Comandos disponibles

- nest-dto-generator.generateDto — Genera `create-<entity>` y `update-<entity>` DTOs.
- nest-dto-generator.generateRepository — Genera repository desde una entidad.
- nest-dto-generator.generateService — Genera service desde una entidad.
- nest-dto-generator.generateController — Genera controller a partir de un service o entidad.
- nest-dto-generator.generateCrud — Ejecuta genérico completo (DTO + Repo + Service + Controller).
- nest-tools.completeReturnType — Infiera y añade `: Promise<T>` en una función `async` (editor).
- nest-tools.triggerReturnType — Dispara la acción `completeReturnType` programáticamente.
- nest-tools.controllerByFunction — Genera endpoints en controller a partir de código seleccionado.

Los comandos aparecen en el Command Palette y en menús contextuales según el tipo de archivo.

## Uso típico

- Generar DTOs: click derecho sobre `user.entity.ts` → "Generate DTOs".
- Generar Controller: click derecho sobre `user.service.ts` (o `user.entity.ts`) → "Generate Controller from Service".
- Autocompletar tipo de retorno: coloca el cursor en la línea de la firma `async` y presiona `Ctrl+Shift+T`.

## Estructura y convenciones

- Los archivos generados usan nombres de fichero con primera letra en minúscula (camelCase) para `*.service.ts`, `*.controller.ts` y carpetas `dto/<camelEntity>/...`.
- El generador de controller ahora crea el archivo bajo la raíz del módulo (directorio que contiene `*.module.ts`) cuando existe; si no, crea el controller en la carpeta del service.

## Troubleshooting — problemas comunes

1. "La extensión funciona en Debug pero no se activa instalada":
   - Verifica `engines.vscode` en `package.json`. Si tu versión de VS Code es anterior a la requerida, VS Code puede desactivar la extensión.
   - Comprueba que el paquete `.vsix` incluya `out/extension.js` y los archivos compilados (`out/commands/*`, `out/autocomplete/*`).
   - Revisa los logs del Extension Host: `Help -> Toggle Developer Tools` (Console) y `Developer: Show Running Extensions`.

2. Error "Cannot find module 'typescript'" en producción:
   - `completeReturnType` usa la API de `typescript` en tiempo de ejecución. Asegúrate de que `typescript` esté disponible al instalar la extensión (incluido en `dependencies` o usa bundling).
   - Alternativa: la extensión incluye una verificación en runtime y mostrará un mensaje amigable si `typescript` no está disponible (asegúrate de compilar después de cambios).

3. Error en generación de controller: "Cannot read properties of null (reading 'createSourceFile')":
   - Ocurre cuando el editor o documento activo no están disponibles. Asegúrate de invocar el comando desde el editor con el archivo abierto o desde el explorador sobre un archivo válido.
   - El generador ahora valida la presencia de `typescript` y muestra mensajes claros si falta.

4. Nombres de archivos con mayúsculas en la primera letra:
   - Los generadores han sido corregidos para generar nombres de archivo en camelCase (minúscula inicial). Si ya creaste ficheros con PascalCase, renómbralos manualmente y ajusta imports.

## Desarrollo y contribución

- Ejecuta `npm run watch` para compilar automáticamente mientras desarrollas.
- Añade tests para generators y parsers en `src/test` si agregas funcionalidad compleja.
- Si cambias la forma de empaquetar (webpack/esbuild), preferible usar bundling para incluir `typescript` y reducir dependencias en tiempo de instalación.

## Buenas prácticas

- Prueba los comandos en una copia del proyecto o en un branch, ya que los generadores crean/reescriben archivos.
- Revisa los imports y adapta los paths si tu proyecto utiliza convenciones diferentes (monorepos, paths custom en tsconfig).

## Ejemplos rápidos

Generar controller desde un service abierto:

1. Abre `src/users/services/user.service.ts`.
2. Ejecuta `Command Palette` → "Generate Controller from Service".
3. Se generará `src/users/controllers/user.controller.ts` (o en la raíz del módulo si existe `users.module.ts`).

Autocompletar tipo de retorno:

1. Coloca el cursor en la firma `async` de un método en un service.
2. Presiona `Ctrl+Shift+T`.
3. Si `typescript` está disponible, la extensión reemplazará la firma por `: Promise<T>` inferido.

## Licencia

MIT — úsalo y modifícalo libremente.

## Copyright

Copyright (c) 2025 @crdsyntax

Este proyecto se distribuye bajo la licencia MIT (ver `LICENSE`).
