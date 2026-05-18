# NestJS & Database Tools Generator

Herramienta integral para desarrolladores de NestJS y backend. Genera DTOs con Swagger, Repositories, Services, Controllers y CRUD completo a partir de entidades TypeORM o modelos de Prisma. Incluye un potente **Visualizador de Diagramas ER** interactivo basado en React y autocompletado inteligente.

## Características Principales

### 📊 Visualizador de Diagramas ER (ERD) - *¡NUEVO!*
Visualiza la arquitectura de tu base de datos de forma interactiva y moderna.
- **Soporte Multi-ORM**: Compatible con entidades **TypeORM** (`.entity.ts`) y modelos de **Prisma** (`schema.prisma`).
- **Interfaz Interactiva**:
    - **Redimensionamiento**: Ajusta el tamaño de las entidades para ver campos largos o compactar la vista.
    - **Drag & Drop**: Organiza tus tablas libremente con persistencia de posición y tamaño.
    - **Zoom y Pan**: Navega fácilmente por diagramas complejos.
    - **Editor de Relaciones**: Doble clic en las etiquetas de relación para personalizarlas.
    - **Navegación Rápida**: Haz clic en campos de relación (🔗) para centrar la entidad relacionada.
- **Exportación**:
    - Genera diagramas en formato **SVG**.
    - Copia el código **Mermaid** directamente al portapapeles para documentación.
- **Barra Lateral**: Nueva vista de "Entities" que organiza tus entidades por carpetas y modelos de Prisma para un acceso rápido.

### 🏗️ Generador de Archivos NestJS
- **Full CRUD**: Genera DTOs, Repository, Service y Controller en un solo clic.
- **DTOs Inteligentes**: Crea DTOs de `create` y `update` con decoradores de `@ApiProperty` (Swagger).
- **Controller por función**: Crea endpoints en controllers existentes a partir de funciones seleccionadas en tus servicios.

### 🧠 Inteligencia en el Editor
- **Autocompletado de Retorno**: Infiere y añade automáticamente `: Promise<T>` en funciones `async` analizando el cuerpo del método (`Ctrl+Shift+T`).
- **Migración de ORM**: Herramientas para ayudar en la conversión entre TypeORM y Mongoose.

## Comandos Destacados

- `nest-tools.viewEntityErd` — Abre el visualizador interactivo para la entidad/modelo seleccionado.
- `nest-tools.generateErd` — Genera una imagen estática (PNG) del diagrama usando Mermaid CLI.
- `nest-dto-generator.generateCrud` — Genera todo el boilerplate necesario para un recurso.
- `nest-tools.completeReturnType` — Completa el tipo de retorno de una función async (`Ctrl+Shift+T`).

## Instalación y Desarrollo

### Requisitos
- VS Code 1.80.0 o superior.

### Instalación desde código
1. Clona el repo: `git clone https://github.com/crdsyntax/quick-dto.git`
2. Instala dependencias: `npm install`
3. Compila el proyecto (incluyendo los componentes de React):
```bash
npm run compile
```
4. F5 para iniciar la depuración.

## Estructura del Proyecto
- `src/`: Lógica principal de la extensión VS Code.
- `media/erd-visualizer-react/`: Aplicación React moderna para el visualizador interactivo.
- `src/generators/parser/`: Parsers especializados para TypeORM y Prisma.

## Troubleshooting — Solución de problemas

- **El ERD no muestra mi esquema de Prisma**: Asegúrate de tener un archivo `schema.prisma` en la raíz del proyecto o dentro de una carpeta `prisma/`.
- **La información de las entidades se ve cortada**: Puedes arrastrar el manejador en la esquina inferior derecha de cada entidad para ensancharla. El texto se truncará con `...` si el espacio es insuficiente, pero puedes ver el valor completo pasando el ratón por encima.

## Licencia
MIT — úsalo y modifícalo libremente.

Copyright (c) 2026 @crdsyntax
