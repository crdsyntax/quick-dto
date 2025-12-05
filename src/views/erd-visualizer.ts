import * as vscode from "vscode";
import { generateErdData } from "../generators/er.generator";
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
    context: vscode.ExtensionContext
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
        }
      },
      null,
      this._disposables
    );
  }

  public static async createOrShow(
    extensionUri: vscode.Uri,
    entityName: string,
    rootPath: string,
    context: vscode.ExtensionContext
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // Generate ERD data
    const erdData = await generateErdData(rootPath, entityName);

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
      }
    );

    EntityVisualizer.currentPanel = new EntityVisualizer(
      panel,
      extensionUri,
      context
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
            </style>
        </head>
        <body>
            <div id="controls">
                <button id="resetBtn">Reset Layout</button>
                <button id="exportBtn">Export SVG</button>
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
                    
                    // Setup SVG
                    const svg = d3.select("#diagram");
                    const width = window.innerWidth;
                    const height = window.innerHeight;
                    
                    svg.attr("width", width).attr("height", height);
                    
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
                    
                    // Prepare node data
                    const nodes = Object.entries(erdData.entities).map(function(entry) {
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
                    const links = [];
                    Object.entries(erdData.entities).forEach(function(entry) {
                        const sourceName = entry[0];
                        const sourceData = entry[1];
                        sourceData.relations.forEach(function(rel) {
                            if (erdData.entities[rel.targetEntity]) {
                                links.push({
                                    source: sourceName,
                                    target: rel.targetEntity,
                                    type: rel.type,
                                });
                            }
                        });
                    });
                    
                    // Draw links
                    const linkGroup = container.append("g").attr("class", "links");
                    
                    function updateLinks() {
                        const linkElements = linkGroup.selectAll(".relation-path")
                            .data(links, function(d) { return d.source + "-" + d.target; });
                        
                        linkElements.exit().remove();
                        
                        const linkEnter = linkElements.enter()
                            .append("g");
                        
                        linkEnter.append("path")
                            .attr("class", "relation-path");
                        
                        linkEnter.append("text")
                            .attr("class", "relation-label");
                        
                        linkGroup.selectAll("g").each(function(d) {
                            const sourceNode = nodes.find(function(n) { return n.id === d.source; });
                            const targetNode = nodes.find(function(n) { return n.id === d.target; });
                            
                            if (!sourceNode || !targetNode) return;
                            
                            // Calculate connection points
                            const sx = sourceNode.x + sourceNode.width / 2;
                            const sy = sourceNode.y + sourceNode.height / 2;
                            const tx = targetNode.x + targetNode.width / 2;
                            const ty = targetNode.y + targetNode.height / 2;
                            
                            // Create orthogonal path (with corners)
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
                    
                    // Draw nodes
                    const nodeGroup = container.append("g").attr("class", "nodes");
                    
                    const nodeElements = nodeGroup.selectAll(".entity-node")
                        .data(nodes, function(d) { return d.id; })
                        .enter()
                        .append("g")
                        .attr("class", "entity-node")
                        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
                        .call(d3.drag()
                            .on("start", dragStarted)
                            .on("drag", dragged)
                            .on("end", dragEnded)
                        );
                    
                    // Draw entity boxes
                    nodeElements.append("rect")
                        .attr("class", "entity-box")
                        .attr("width", function(d) { return d.width; })
                        .attr("height", function(d) { return d.height; });
                    
                    // Draw entity title background
                    nodeElements.append("rect")
                        .attr("width", function(d) { return d.width; })
                        .attr("height", config.nodeHeaderHeight)
                        .attr("fill", "var(--vscode-titleBar-activeBackground)")
                        .attr("opacity", 0.3);
                    
                    // Draw entity title
                    nodeElements.append("text")
                        .attr("class", "entity-title")
                        .attr("x", config.nodeWidth / 2)
                        .attr("y", config.nodeHeaderHeight / 2)
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .text(function(d) { return d.id; });
                    
                    // Draw fields
                    nodeElements.each(function(d) {
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
                                const icon = field.isPrimary ? "🔑 " : "  ";
                                const nullable = field.isNullable ? "?" : "";
                                const text = icon + field.name + nullable + ": " + field.type;
                                
                                node.append("text")
                                    .attr("class", field.isPrimary ? "field-primary" : "entity-field")
                                    .attr("x", 10)
                                    .attr("y", y)
                                    .text(text);
                            });
                        }
                    });
                    
                    updateLinks();
                    
                    // Drag functions
                    function dragStarted(event, d) {
                        d3.select(this).raise();
                    }
                    
                    function dragged(event, d) {
                        d.x = event.x;
                        d.y = event.y;
                        d3.select(this).attr("transform", "translate(" + d.x + "," + d.y + ")");
                        updateLinks();
                    }
                    
                    function dragEnded(event, d) {
                        // Save positions
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
                        
                        nodeElements.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
                        updateLinks();
                        
                        // Save new positions
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
                        const svgData = new XMLSerializer().serializeToString(document.getElementById("diagram"));
                        const blob = new Blob([svgData], { type: "image/svg+xml" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "erd-diagram.svg";
                        a.click();
                        URL.revokeObjectURL(url);
                    });
                })();
            </script>
        </body>
        </html>`;
  }
}
