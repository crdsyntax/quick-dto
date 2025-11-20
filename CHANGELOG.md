# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2025-11-19
### Added
- Generador `controllerByFunction` para crear endpoints a partir de funciones seleccionadas.
- Búsqueda de la raíz del módulo al crear controllers: ahora los controllers se generan en la carpeta del módulo (`*.module.ts`) cuando existe.
- Mensajes de help y errores más claros para el autocompletado que requiere `typescript`.
- `README.md` con instrucciones, troubleshooting y ejemplos.

### Fixed
- Corrección de nombres de archivo generados: ahora se usan nombres con minúscula inicial (camelCase) para archivos generados (`*.controller.ts`, `*.service.ts`, `dto/<entity>/...`).
- Manejo de `typescript` en tiempo de ejecución: validación y mensaje amigable si falta la dependencia.
- Validaciones adicionales en el generador de controllers para evitar errores como "Cannot read properties of null".

### Changed
- Incremento de versión y actualización de `package.json` con `activationEvents` por defecto para facilitar pruebas.

## [1.7.0] - (previous)
- Primera versión pública con generadores de DTO, Repository, Service y Controller y autocompletado básico.


> For more details, see commits history.
