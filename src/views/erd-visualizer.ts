import * as vscode from "vscode";
import {
  generateErdData,
  generateErdDataForEntities,
} from "../generators/er.generator";
import { SavedPositions } from "../types/erd-types";

export class EntityVisualizer {
  public static currentPanel: EntityVisualizer | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];
  private _entityName: string = "";
  private _rootPath: string = "";

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "savePositions":
            this._savePositions(message.positions);
            break;
          case "error":
            vscode.window.showErrorMessage(message.message);
            break;
          case "copyToClipboard":
            vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage(
              "Diagrama copiado al portapapeles (formato Markdown/Mermaid).",
            );
            break;
        }
      },
      null,
      this._disposables,
    );
  }

  public static async createOrShow(
    extensionUri: vscode.Uri,
    entityName: string,
    rootPath: string,
    context: vscode.ExtensionContext,
    entityList?: string[],
    strict: boolean = false,
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Generate ERD data
    let erdData;
    try {
      if (entityList && entityList.length > 0) {
        erdData = await generateErdDataForEntities(rootPath, entityList, strict);
      } else {
        erdData = await generateErdData(rootPath, entityName);
      }
    } catch (err) {
      console.error("ERD generation error:", err);
      vscode.window.showErrorMessage(
        "No se pudo generar el diagrama. Verifica que la carpeta del proyecto tenga tsconfig.json y archivos .entity.ts en src/.",
      );
      return;
    }

    const entityCount =
      erdData?.entities && Object.keys(erdData.entities).length;
    if (!entityCount) {
      vscode.window.showWarningMessage(
        "No se encontraron entidades para mostrar. Revisa la carpeta seleccionada en Entity View.",
      );
      return;
    }

    if (EntityVisualizer.currentPanel) {
      EntityVisualizer.currentPanel._panel.reveal(column);
      EntityVisualizer.currentPanel._update(erdData, entityName, rootPath);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "entityVisualizer",
      `ERD: ${entityName}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      },
    );

    EntityVisualizer.currentPanel = new EntityVisualizer(
      panel,
      extensionUri,
      context,
    );
    EntityVisualizer.currentPanel._update(erdData, entityName, rootPath);
  }

  public dispose() {
    EntityVisualizer.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update(erdData: any, entityName: string, rootPath: string) {
    this._entityName = entityName;
    this._rootPath = rootPath;
    this._panel.title = `ERD: ${entityName}`;

    // Load saved positions
    const savedPositions = this._loadPositions();

    this._panel.webview.html = this._getHtmlForWebview(erdData, savedPositions);
  }

  private _savePositions(positions: SavedPositions) {
    const key = `erd.positions.${this._entityName}`;
    this._context.globalState.update(key, positions);
  }

  private _loadPositions(): SavedPositions {
    const key = `erd.positions.${this._entityName}`;
    return this._context.globalState.get(key, {});
  }

  private _getHtmlForWebview(erdData: any, savedPositions: SavedPositions) {
    const erdDataJson = JSON.stringify(erdData);
    const savedPositionsJson = JSON.stringify(savedPositions);

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ER Diagram</title>
            <script src="https://d3js.org/d3.v7.min.js"></script>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                    overflow: hidden;
                    width: 100vw;
                    height: 100vh;
                }
                
                #controls {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    z-index: 1000;
                    display: flex;
                    gap: 8px;
                }
                
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: 1px solid var(--vscode-button-border, transparent);
                    padding: 6px 12px;
                    cursor: pointer;
                    border-radius: 2px;
                    font-size: 13px;
                    font-family: var(--vscode-font-family);
                }
                
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                #diagram {
                    width: 100%;
                    height: 100%;
                }
                
                .entity-node {
                    cursor: move;
                }
                
                .entity-box {
                    fill: var(--vscode-editor-background);
                    stroke: var(--vscode-panel-border);
                    stroke-width: 2;
                    rx: 4;
                }
                
                .entity-box:hover {
                    stroke: var(--vscode-focusBorder);
                    stroke-width: 2.5;
                }
                
                .entity-title {
                    fill: var(--vscode-editor-foreground);
                    font-weight: bold;
                    font-size: 14px;
                }
                
                .entity-field {
                    fill: var(--vscode-editor-foreground);
                    font-size: 12px;
                    font-family: var(--vscode-editor-font-family);
                }
                
                .field-primary {
                    fill: var(--vscode-terminal-ansiYellow);
                    font-weight: bold;
                }

                .field-enum {
                    fill: var(--vscode-terminal-ansiCyan);
                    font-style: italic;
                }

                .field-relation {
                    fill: var(--vscode-terminal-ansiBlue);
                    cursor: pointer;
                    text-decoration: underline dotted;
                }
                
                .field-relation:hover {
                    fill: var(--vscode-focusBorder);
                }
                
                .relation-path {
                    fill: none;
                    stroke: var(--vscode-terminal-ansiCyan);
                    stroke-width: 2;
                    marker-end: url(#arrowhead);
                }
                
                .relation-label {
                    fill: var(--vscode-descriptionForeground);
                    font-size: 11px;
                    text-anchor: middle;
                }

                .delete-btn {
                    fill: var(--vscode-errorForeground);
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 16px; 
                    opacity: 0.7;
                }
                
                .delete-btn:hover {
                    opacity: 1;
                }
            </style>
        </head>
        <body>
            <div id="controls">
                <button id="resetBtn">Reset Layout</button>
                <button id="exportBtn">Export SVG</button>
                <button id="copyBtn">Copy Markdown</button>
            </div>
            <svg id="diagram"></svg>
            
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    const erdData = ${erdDataJson};
                    const savedPositions = ${savedPositionsJson};
                    
                    // Configuration
                    const config = {
                        nodeWidth: 250,
                        nodeHeaderHeight: 35,
                        fieldHeight: 20,
                        fieldPadding: 8,
                        nodeSpacing: 100,
                    };
                    
                    // Setup SVG - fallback dimensions when webview not yet laid out
                    const svg = d3.select("#diagram");
                    let width = Math.max(window.innerWidth || 0, 800);
                    let height = Math.max(window.innerHeight || 0, 600);
                    
                    svg.attr("width", width).attr("height", height);
                    
                    function updateSize() {
                        width = Math.max(window.innerWidth || 0, 800);
                        height = Math.max(window.innerHeight || 0, 600);
                        svg.attr("width", width).attr("height", height);
                    }
                    window.addEventListener("resize", updateSize);
                    
                    // Create arrow marker
                    svg.append("defs").append("marker")
                        .attr("id", "arrowhead")
                        .attr("viewBox", "0 -5 10 10")
                        .attr("refX", 8)
                        .attr("refY", 0)
                        .attr("markerWidth", 6)
                        .attr("markerHeight", 6)
                        .attr("orient", "auto")
                        .append("path")
                        .attr("d", "M0,-5L10,0L0,5")
                        .attr("fill", "var(--vscode-terminal-ansiCyan)");
                    
                    // Create container for zoom/pan
                    const container = svg.append("g");
                    
                    // Setup zoom
                    const zoom = d3.zoom()
                        .scaleExtent([0.1, 4])
                        .on("zoom", function(event) {
                            container.attr("transform", event.transform);
                        });
                    
                    svg.call(zoom);

                    const linkGroup = container.append("g").attr("class", "links");
                    const nodeGroup = container.append("g").attr("class", "nodes");
                    
                    // Guard: ensure entities exists
                    const entities = erdData && erdData.entities ? erdData.entities : {};
                    
                    // Prepare initial data
                    let nodes = Object.entries(entities).map(function(entry) {
                        const name = entry[0];
                        const data = entry[1];
                        const fieldCount = data.fields.length || 1;
                        const nodeHeight = config.nodeHeaderHeight + (fieldCount * config.fieldHeight) + config.fieldPadding;
                        
                        return {
                            id: name,
                            data: data,
                            width: config.nodeWidth,
                            height: nodeHeight,
                            x: savedPositions[name] ? savedPositions[name].x : Math.random() * (width - 400) + 200,
                            y: savedPositions[name] ? savedPositions[name].y : Math.random() * (height - 400) + 200,
                        };
                    });
                    
                    // Prepare link data
                    let links = [];
                    Object.entries(entities).forEach(function(entry) {
                        const sourceName = entry[0];
                        const sourceData = entry[1];
                        (sourceData.relations || []).forEach(function(rel) {
                            if (entities[rel.targetEntity]) {
                                links.push({
                                    source: sourceName,
                                    target: rel.targetEntity,
                                    type: rel.type,
                                });
                            }
                        });
                    });

                    function deleteNode(nodeId) {
                        nodes = nodes.filter(function(n) { return n.id !== nodeId; });
                        links = links.filter(function(l) { return l.source !== nodeId && l.target !== nodeId; });
                        render();
                    }

                    function focusNode(nodeId) {
                        const targetNode = nodes.find(n => n.id === nodeId);
                        if (!targetNode) return;

                        const scale = 1.2;
                        const x = -targetNode.x * scale + width / 2 - (targetNode.width / 2) * scale;
                        const y = -targetNode.y * scale + height / 2 - (targetNode.height / 2) * scale;
                        
                        svg.transition()
                            .duration(750)
                            .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(scale));
                    }

                    function render() {
                        // --- LINKS ---
                        const linkSelection = linkGroup.selectAll("g")
                            .data(links, function(d) { return d.source + "-" + d.target; });

                        linkSelection.exit().remove();

                        const linkEnter = linkSelection.enter()
                            .append("g");
                        
                        linkEnter.append("path")
                            .attr("class", "relation-path");
                        
                        linkEnter.append("text")
                            .attr("class", "relation-label");
                        
                        const allLinks = linkEnter.merge(linkSelection);

                        // --- NODES ---
                        const nodeSelection = nodeGroup.selectAll(".entity-node")
                             .data(nodes, function(d) { return d.id; });
                        
                        nodeSelection.exit().remove();

                        const nodeEnter = nodeSelection.enter()
                             .append("g")
                             .attr("class", "entity-node")
                             .call(d3.drag()
                                .on("start", dragStarted)
                                .on("drag", dragged)
                                .on("end", dragEnded)
                             );
                        
                        // Draw entity boxes
                        nodeEnter.append("rect")
                            .attr("class", "entity-box")
                            .attr("width", function(d) { return d.width; })
                            .attr("height", function(d) { return d.height; });
                        
                        // Draw entity title background
                        nodeEnter.append("rect")
                            .attr("width", function(d) { return d.width; })
                            .attr("height", config.nodeHeaderHeight)
                            .attr("fill", "var(--vscode-titleBar-activeBackground)")
                            .attr("opacity", 0.3);
                        
                        // Draw entity title
                        nodeEnter.append("text")
                            .attr("class", "entity-title")
                            .attr("x", config.nodeWidth / 2)
                            .attr("y", config.nodeHeaderHeight / 2)
                            .attr("text-anchor", "middle")
                            .attr("dominant-baseline", "middle")
                            .text(function(d) { return d.id; });

                        // Draw delete button
                        nodeEnter.append("text")
                            .attr("class", "delete-btn")
                            .text("×")
                            .attr("x", config.nodeWidth - 15)
                            .attr("y", 22)
                            .attr("text-anchor", "middle")
                            .on("mousedown", function(e) { e.stopPropagation(); }) // Prevent drag start
                            .on("click", function(e, d) {
                                e.stopPropagation();
                                deleteNode(d.id);
                            });
                        
                        // Draw fields
                        nodeEnter.each(function(d) {
                            const node = d3.select(this);
                            const fields = d.data.fields;
                            
                            if (fields.length === 0) {
                                node.append("text")
                                    .attr("class", "entity-field")
                                    .attr("x", 10)
                                    .attr("y", config.nodeHeaderHeight + 15)
                                    .text("(no fields)");
                            } else {
                                fields.forEach(function(field, i) {
                                    const y = config.nodeHeaderHeight + (i * config.fieldHeight) + 15;
                                    let icon = "  ";
                                    let className = "entity-field";
                                    let typeDisplay = field.type;

                                    if (field.isPrimary) {
                                        icon = "🔑 ";
                                        className = "field-primary";
                                    } else if (field.isRelation) {
                                        icon = "🔗 ";
                                        className = "field-relation";
                                    } else if (field.isEnum) {
                                        icon = "E ";
                                        className = "field-enum";
                                    }

                                    const nullable = field.isNullable ? "?" : "";
                                    
                                    if (field.isEnum) {
                                        typeDisplay = "ENUM " + field.type;
                                    }

                                    const text = icon + field.name + nullable + ": " + typeDisplay;
                                    
                                    const fieldText = node.append("text")
                                        .attr("class", className)
                                        .attr("x", 10)
                                        .attr("y", y)
                                        .text(text);

                                    if (field.isRelation) {
                                        const relation = d.data.relations.find(r => r.propertyName === field.name);
                                        if (relation) {
                                            fieldText.on("click", function(e) {
                                                e.stopPropagation();
                                                focusNode(relation.targetEntity);
                                            });
                                            fieldText.append("title").text("Click to focus " + relation.targetEntity);
                                        }
                                    }
                                });
                            }
                        });


                        // Update positions
                         nodeEnter.merge(nodeSelection)
                            .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

                         updateLinks(allLinks, nodeEnter.merge(nodeSelection));
                    }
                    
                    
                    function updateLinks(linksSelection, nodesSelection) {
                        linksSelection.each(function(d) {
                            const sourceNode = nodes.find(function(n) { return n.id === d.source; });
                            const targetNode = nodes.find(function(n) { return n.id === d.target; });
                            
                            if (!sourceNode || !targetNode) return;
                            
                            const sx = sourceNode.x + sourceNode.width / 2;
                            const sy = sourceNode.y + sourceNode.height / 2;
                            const tx = targetNode.x + targetNode.width / 2;
                            const ty = targetNode.y + targetNode.height / 2;
                            
                            const midX = (sx + tx) / 2;
                            const path = "M " + sx + "," + sy + " L " + midX + "," + sy + " L " + midX + "," + ty + " L " + tx + "," + ty;
                            
                            d3.select(this).select("path")
                                .attr("d", path);
                            
                            d3.select(this).select("text")
                                .attr("x", midX)
                                .attr("y", (sy + ty) / 2 - 5)
                                .text(d.type);
                        });
                    }
                    
                    // Drag functions
                    function dragStarted(event, d) {
                        d3.select(this).raise();
                    }
                    
                    function dragged(event, d) {
                        d.x = event.x;
                        d.y = event.y;
                        d3.select(this).attr("transform", "translate(" + d.x + "," + d.y + ")");
                        const allLinks = linkGroup.selectAll("g");
                        const allNodes = nodeGroup.selectAll(".entity-node");
                        updateLinks(allLinks, allNodes);
                    }
                    
                    function dragEnded(event, d) {
                        const positions = {};
                        nodes.forEach(function(node) {
                            positions[node.id] = { x: node.x, y: node.y };
                        });
                        vscode.postMessage({
                            type: 'savePositions',
                            positions: positions
                        });
                    }
                    
                    // Reset button
                    document.getElementById("resetBtn").addEventListener("click", function() {
                        nodes.forEach(function(node, i) {
                            const angle = (i / nodes.length) * 2 * Math.PI;
                            const radius = Math.min(width, height) / 3;
                            node.x = width / 2 + radius * Math.cos(angle) - node.width / 2;
                            node.y = height / 2 + radius * Math.sin(angle) - node.height / 2;
                        });
                        
                        render();
                        
                        const positions = {};
                        nodes.forEach(function(node) {
                            positions[node.id] = { x: node.x, y: node.y };
                        });
                        vscode.postMessage({
                            type: 'savePositions',
                            positions: positions
                        });
                    });
                    
                    // Export button
                    document.getElementById("exportBtn").addEventListener("click", function() {
                        const svgEl = document.getElementById("diagram");
                        const clone = svgEl.cloneNode(true);
                        
                        const style = getComputedStyle(document.body);
                        const bgColor = style.getPropertyValue('--vscode-editor-background') || '#1e1e1e';
                        const fgColor = style.getPropertyValue('--vscode-editor-foreground') || '#cccccc';
                        const borderColor = style.getPropertyValue('--vscode-panel-border') || '#444';
                        const cyanColor = style.getPropertyValue('--vscode-terminal-ansiCyan') || '#4ec9b0';
                        const yellowColor = style.getPropertyValue('--vscode-terminal-ansiYellow') || '#dcdcaa';
                        const blueColor = style.getPropertyValue('--vscode-terminal-ansiBlue') || '#569cd6';
                        
                        const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
                        styleEl.textContent = \`
                            .entity-box { fill: \${bgColor}; stroke: \${borderColor}; stroke-width: 2px; rx: 4px; }
                            .entity-title { fill: \${fgColor}; font-weight: bold; font-family: sans-serif; font-size: 14px; text-anchor: middle; dominant-baseline: middle; }
                            .entity-field { fill: \${fgColor}; font-family: sans-serif; font-size: 12px; }
                            .field-primary { fill: \${yellowColor}; font-weight: bold; font-family: sans-serif; font-size: 12px; }
                            .field-relation { fill: \${blueColor}; text-decoration: underline; font-family: sans-serif; font-size: 12px; }
                            .field-enum { fill: \${cyanColor}; font-style: italic; font-family: sans-serif; font-size: 12px; }
                            .relation-path { fill: none; stroke: \${cyanColor}; stroke-width: 2px; }
                            .relation-label { fill: \${fgColor}; font-size: 11px; font-family: sans-serif; text-anchor: middle; }
                            text { font-family: Segoe UI, sans-serif; }
                        \`;
                        
                        clone.insertBefore(styleEl, clone.firstChild);
                        
                        const svgData = new XMLSerializer().serializeToString(clone);
                        const blob = new Blob([svgData], { type: "image/svg+xml" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "erd-diagram-" + new Date().toISOString().slice(0,10) + ".svg";
                        a.click();
                        URL.revokeObjectURL(url);
                    });

                    // Generate Mermaid
                    function generateMermaid(data) {
                        let mermaid = "erDiagram\\n";
                        
                        Object.entries(data.entities).forEach(function(entry) { 
                            const name = entry[0];
                            const entity = entry[1];
                            mermaid += "    " + name + " {\\n";
                            if (entity.fields) {
                                entity.fields.forEach(function(f) {
                                    let type = (f.type || 'string').replace(/[^a-zA-Z0-9_\\[\\]]/g, ''); 
                                    let fname = (f.name || '').replace(/[^a-zA-Z0-9_]/g, '');
                                    mermaid += "        " + type + " " + fname + "\\n";
                                });
                            }
                            mermaid += "    }\\n";
                        });

                        const relMap = {
                            'ManyToOne': '}o--||',
                            'OneToMany': '||--o{',
                            'OneToOne': '||--||',
                            'ManyToMany': '}o--o{'
                        };

                        Object.entries(data.entities).forEach(function(entry) {
                            const name = entry[0];
                            const entity = entry[1];
                            if (entity.relations) {
                                entity.relations.forEach(function(rel) {
                                    if (data.entities[rel.targetEntity]) {
                                        const symbol = relMap[rel.type] || '}o--o{';
                                        mermaid += "    " + name + " " + symbol + " " + rel.targetEntity + " : \\\"" + (rel.propertyName || '') + "\\\"\\n";
                                    }
                                });
                            }
                        });
                        
                        return mermaid;
                    }

                    document.getElementById("copyBtn").addEventListener("click", function() {
                        const code = generateMermaid(erdData);
                        const backticks = String.fromCharCode(96).repeat(3);
                        const markdown = backticks + "mermaid\\n" + code + backticks;
                        vscode.postMessage({
                            type: 'copyToClipboard',
                            text: markdown
                        });
                    });

                    // Initial render - delay one frame so webview has layout dimensions
                    requestAnimationFrame(function() {
                        updateSize();
                        render();
                    });
                })();
            </script>
        </body>
        </html>`;
  }
}
