import * as vscode from "vscode";
import * as fs from "fs";
import { EntityTreeDataProvider } from "../views/entity-tree-provider";
import { FlowchartEditorPanel } from "../views/flowchart-editor.view";
import { generateErdDataForEntities } from "../generators/er.generator";
import { FlowchartNode, FlowchartData } from "../types/flowchart-types";
import { EntityData } from "../types/erd-types";

/**
 * Comando para abrir el editor de diagramas de flujo
 * Obtiene las entidades seleccionadas mediante checkboxes y las convierte en nodos
 */
export async function openFlowchartEditorCommand(
  context: vscode.ExtensionContext,
  entityTreeProvider: EntityTreeDataProvider
): Promise<void> {
  const checkedPaths = entityTreeProvider.getCheckedItems();

  // Obtener nombres de entidades de los archivos seleccionados
  const entityNames: string[] = [];

  for (const filePath of checkedPaths) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const match = content.match(/export\s+class\s+(\w+)/);
      if (match) {
        entityNames.push(match[1]);
      }
    } catch (e) {
      console.error(`Error reading entity file: ${filePath}`, e);
    }
  }

  // Obtener datos de las entidades si hay alguna seleccionada
  let initialData: FlowchartData = { nodes: [], edges: [] };

  if (entityNames.length > 0) {
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

    try {
      const erdData = await generateErdDataForEntities(
        rootPath,
        entityNames,
        true // strict mode
      );

      // Convertir entidades ERD a nodos de flowchart
      initialData = convertErdToFlowchart(erdData.entities, entityNames);
    } catch (error) {
      console.error("Error generating ERD data:", error);
      vscode.window.showWarningMessage(
        "No se pudieron cargar las entidades. Se abrirá un diagrama vacío."
      );
    }
  }

  // Abrir el panel del editor
  FlowchartEditorPanel.createOrShow(context.extensionUri, context, initialData);
}

/**
 * Convierte los datos ERD a formato de flowchart
 */
function convertErdToFlowchart(
  entities: Record<string, EntityData>,
  entityNames: string[]
): FlowchartData {
  const nodes: FlowchartNode[] = [];
  const edges: FlowchartData["edges"] = [];

  // Calcular posiciones iniciales en grid
  const columns = Math.ceil(Math.sqrt(entityNames.length));
  const spacing = { x: 280, y: 200 };
  const startOffset = { x: 100, y: 100 };

  entityNames.forEach((name, index) => {
    const entity = entities[name];
    if (!entity) return;

    const col = index % columns;
    const row = Math.floor(index / columns);

    nodes.push({
      id: `entity-${name}`,
      type: "entity",
      label: name,
      x: startOffset.x + col * spacing.x,
      y: startOffset.y + row * spacing.y,
      width: 200,
      height: calculateEntityHeight(entity),
      data: entity,
    });

    // Crear edges para las relaciones entre entidades seleccionadas
    entity.relations.forEach((relation) => {
      if (entityNames.includes(relation.targetEntity)) {
        const edgeId = `edge-${name}-${relation.targetEntity}-${relation.propertyName}`;

        // Evitar duplicados
        const existingEdge = edges.find(
          (e) =>
            (e.source === `entity-${name}` &&
              e.target === `entity-${relation.targetEntity}`) ||
            (e.source === `entity-${relation.targetEntity}` &&
              e.target === `entity-${name}`)
        );

        if (!existingEdge) {
          edges.push({
            id: edgeId,
            source: `entity-${name}`,
            target: `entity-${relation.targetEntity}`,
            cardinality: mapRelationToCardinality(relation.type),
            label: relation.propertyName,
          });
        }
      }
    });
  });

  return { nodes, edges };
}

/**
 * Calcula la altura de un nodo entidad basado en sus campos
 */
function calculateEntityHeight(entity: EntityData): number {
  const headerHeight = 40;
  const fieldHeight = 22;
  const padding = 20;
  const minHeight = 100;

  const calculatedHeight =
    headerHeight + entity.fields.length * fieldHeight + padding;
  return Math.max(minHeight, calculatedHeight);
}

/**
 * Mapea el tipo de relación TypeORM a cardinalidad de flowchart
 */
function mapRelationToCardinality(
  relationType: string
): "1:1" | "1:N" | "N:1" | "N:M" {
  switch (relationType) {
    case "OneToOne":
      return "1:1";
    case "OneToMany":
      return "1:N";
    case "ManyToOne":
      return "N:1";
    case "ManyToMany":
      return "N:M";
    default:
      return "1:N";
  }
}
