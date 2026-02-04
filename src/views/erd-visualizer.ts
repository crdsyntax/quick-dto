import * as vscode from "vscode";
import {
  generateErdData,
  generateErdDataForEntities,
} from "../generators/er.generator";
import { SavedDiagramState, SavedPositions } from "../types/erd-types";

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
          case "saveState":
            this._saveState(message.state);
            break;
          case "error":
            vscode.window.showErrorMessage(message.message);
            break;
          case "copyToClipboard":
            vscode.env.clipboard.writeText(message.text);
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

    // Generate ERD data with progress indicator
    let erdData;
    try {
      erdData = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating ERD",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Analyzing entities..." });
          if (entityList && entityList.length > 0) {
            return await generateErdDataForEntities(
              rootPath,
              entityList,
              strict,
            );
          } else {
            return await generateErdData(rootPath, entityName);
          }
        },
      );
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

    // Load saved state
    const savedState = this._loadState();

    this._panel.webview.html = this._getHtmlForWebview(erdData, savedState);
  }

  private _saveState(state: SavedDiagramState) {
    const key = `erd.state.${this._entityName}`;
    this._context.globalState.update(key, state);
  }

  private _loadState(): SavedDiagramState {
    const key = `erd.state.${this._entityName}`;
    return this._context.globalState.get(key, { positions: {}, relations: {} });
  }

  private _getHtmlForWebview(erdData: any, savedState: SavedDiagramState) {
    const erdDataJson = JSON.stringify(erdData);
    const savedStateJson = JSON.stringify(savedState);

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
                }
                
                .relation-label {
                    fill: var(--vscode-descriptionForeground);
                    font-size: 11px;
                    text-anchor: middle;
                    cursor: move;
                    user-select: none;
                }

                .relation-label:hover {
                    fill: var(--vscode-focusBorder);
                    font-weight: bold;
                }

                #edit-overlay {
                    position: absolute;
                    display: none;
                    z-index: 2000;
                }

                #edit-input {
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    padding: 2px 4px;
                    font-size: 11px;
                    outline: none;
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

                .anchor-point {
                    fill: var(--vscode-terminal-ansiCyan);
                    stroke: var(--vscode-editor-background);
                    stroke-width: 1;
                    cursor: move;
                }

                .anchor-point:hover {
                    fill: var(--vscode-focusBorder);
                    stroke-width: 2;
                }

                #loading-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: var(--vscode-editor-background);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 5000;
                    transition: opacity 0.3s ease;
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid var(--vscode-progressBar-background);
                    border-top: 4px solid transparent;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 16px;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .loading-text {
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                }
            </style>
        </head>
        <body>
            <div id="loading-overlay">
                <div class="spinner"></div>
                <div class="loading-text">Processing ERD...</div>
            </div>
            <div id="controls">
                <button id="resetBtn">Reset Layout</button>
                <button id="exportBtn">Export SVG</button>
                <button id="copyBtn">Copy Markdown</button>
            </div>
            <div id="edit-overlay">
                <input type="text" id="edit-input">
            </div>
            <svg id="diagram"></svg>
            
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    const erdData = ${erdDataJson};
                    const savedState = ${savedStateJson} || { positions: {}, relations: {} };
                    const savedPositions = savedState.positions || {};
                    const savedRelations = savedState.relations || {};
                    
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
                    
                    // Create markers
                    const defs = svg.append("defs");
                    
                    function createMarker(id, path, refX, color) {
                        defs.append("marker")
                            .attr("id", id)
                            .attr("viewBox", "0 -10 12 20")
                            .attr("refX", refX)
                            .attr("refY", 0)
                            .attr("markerWidth", 10)
                            .attr("markerHeight", 10)
                            .attr("orient", "auto")
                            .append("path")
                            .attr("d", path)
                            .attr("fill", "none")
                            .attr("stroke", color || "var(--vscode-terminal-ansiCyan)")
                            .attr("stroke-width", 1.5);
                    }

                    // Crow's foot markers
                    // Target side (end) - Node is at the right (larger X)
                    createMarker("marker-one-end", "M 4,-6 L 4,6 M 8,-6 L 8,6", 10);
                    // Many: fork opening towards the node. Anchor at 10 (edge), Mouth at 10, Tip at 2.
                    createMarker("marker-many-end", "M 2,0 L 10,-6 M 2,0 L 10,6", 10);
                    // Optional Many: circle and fork. Tip at 6, Mouth at 10, Circle at 2-5.
                    createMarker("marker-opt-many-end", "M 6,0 L 10,-6 M 6,0 L 10,6 M 2,0 C 2,-3 5,-3 5,0 C 5,3 2,3 2,0", 10);
                    
                    // Source side (start) - Node is at the left (smaller X)
                    createMarker("marker-one-start", "M 4,-6 L 4,6 M 8,-6 L 8,6", 2);
                    // Many: fork opening towards the node. Anchor at 2 (edge), Mouth at 2, Tip at 10.
                    createMarker("marker-many-start", "M 10,0 L 2,-6 M 10,0 L 2,6", 2);
                    // Optional Many: circle and fork. Tip at 6, Mouth at 2, Circle at 7-10.
                    createMarker("marker-opt-many-start", "M 6,0 L 2,-6 M 6,0 L 2,6 M 10,0 C 10,-3 7,-3 7,0 C 7,3 10,3 10,0", 2);
                    
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
                    const anchorGroup = container.append("g").attr("class", "anchors");
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
                    const linkPairCounts = {};
                    
                    Object.entries(entities).forEach(function(entry) {
                        const sourceName = entry[0];
                        const sourceData = entry[1];
                        (sourceData.relations || []).forEach(function(rel) {
                            if (entities[rel.targetEntity]) {
                                const pairKey = [sourceName, rel.targetEntity].sort().join('-');
                                const index = linkPairCounts[pairKey] || 0;
                                linkPairCounts[pairKey] = index + 1;
                                
                                const relKey = sourceName + "->" + rel.targetEntity + ":" + rel.propertyName;
                                const customData = savedRelations[relKey] || {};
                                
                                links.push({
                                    id: relKey,
                                    source: sourceName,
                                    target: rel.targetEntity,
                                    type: rel.type,
                                    propertyName: rel.propertyName,
                                    pairKey: pairKey,
                                    linkIndex: index,
                                    customLabel: customData.customLabel,
                                    anchorPoints: customData.anchorPoints || (customData.bendPoint ? [customData.bendPoint] : [])
                                });
                            }
                        });
                    });
                    
                    links.forEach(l => {
                        l.totalInPair = linkPairCounts[l.pairKey];
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
                            .attr("class", "relation-label")
                            .on("dblclick", function(e, d) {
                                e.stopPropagation();
                                showLabelEditor(e, d);
                            })
                            .call(d3.drag()
                                .on("start", function(e) { e.sourceEvent.stopPropagation(); })
                                .on("drag", function(e, d) {
                                    const transform = d3.zoomTransform(svg.node());
                                    const point = transform.invert([e.sourceEvent.clientX, e.sourceEvent.clientY]);
                                    d.bendPoint = { x: point[0], y: point[1] };
                                    render();
                                })
                                .on("end", saveState)
                            );

                        linkEnter.on("click", function(e, d) {
                            if (e.defaultPrevented) return;
                            const transform = d3.zoomTransform(svg.node());
                            const point = transform.invert([e.clientX, e.clientY]);
                            if (!d.anchorPoints) d.anchorPoints = [];
                            d.anchorPoints.push({ x: point[0], y: point[1] });
                            render();
                            saveState();
                        });
                        
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
                         updateAnchors(allLinks);

                         // Hide loading overlay
                         const loadingOverlay = document.getElementById("loading-overlay");
                         if (loadingOverlay) {
                             loadingOverlay.style.opacity = "0";
                             setTimeout(() => {
                                 loadingOverlay.style.display = "none";
                             }, 300);
                         }
                    }
                    
                    function updateAnchors(linksSelection) {
                        const allAnchorsData = [];
                        linksSelection.each(function(link) {
                            (link.anchorPoints || []).forEach((p, i) => {
                                allAnchorsData.push({
                                    link: link,
                                    point: p,
                                    index: i
                                });
                            });
                        });

                        const anchorSelection = anchorGroup.selectAll(".anchor-point")
                            .data(allAnchorsData, d => d.link.id + "-" + d.index);

                        anchorSelection.exit().remove();

                        const anchorEnter = anchorSelection.enter()
                            .append("circle")
                            .attr("class", "anchor-point")
                            .attr("r", 5)
                            .on("contextmenu", function(e, d) {
                                e.preventDefault();
                                e.stopPropagation();
                                d.link.anchorPoints.splice(d.index, 1);
                                render();
                                saveState();
                            })
                            .call(d3.drag()
                                .on("start", function(e) { e.sourceEvent.stopPropagation(); })
                                .on("drag", function(e, d) {
                                    const transform = d3.zoomTransform(svg.node());
                                    const point = transform.invert([e.sourceEvent.clientX, e.sourceEvent.clientY]);
                                    d.point.x = point[0];
                                    d.point.y = point[1];
                                    render();
                                })
                                .on("end", saveState)
                            );

                        anchorEnter.merge(anchorSelection)
                            .attr("cx", d => d.point.x)
                            .attr("cy", d => d.point.y);
                    }
                    
                    
                    function updateLinks(linksSelection, nodesSelection) {
                        const markerMap = {
                            'ManyToOne': { start: 'marker-opt-many-start', end: 'marker-one-end' },
                            'OneToMany': { start: 'marker-one-start', end: 'marker-opt-many-end' },
                            'OneToOne': { start: 'marker-one-start', end: 'marker-one-end' },
                            'ManyToMany': { start: 'marker-opt-many-start', end: 'marker-opt-many-end' }
                        };

                        linksSelection.each(function(d) {
                            const sourceNode = nodes.find(function(n) { return n.id === d.source; });
                            const targetNode = nodes.find(function(n) { return n.id === d.target; });
                            
                            if (!sourceNode || !targetNode) return;
                            
                            // Base centers
                            let csx = sourceNode.x + sourceNode.width / 2;
                            let csy = sourceNode.y + sourceNode.height / 2;
                            let ctx = targetNode.x + targetNode.width / 2;
                            let cty = targetNode.y + targetNode.height / 2;

                            // Offset for multiple links between same nodes
                            const offsetStep = 25;
                            const offset = (d.linkIndex - (d.totalInPair - 1) / 2) * offsetStep;
                            
                            const dx = Math.abs(csx - ctx);
                            const dy = Math.abs(csy - cty);
                            
                            let sx, sy, tx, ty, path, labelX, labelY;

                            // Clip to edges logic
                            const getEdgePoint = (node, otherX, otherY, xOffset, yOffset) => {
                                const nx = node.x + node.width / 2 + (xOffset || 0);
                                const ny = node.y + node.height / 2 + (yOffset || 0);
                                
                                const dx = otherX - nx;
                                const dy = otherY - ny;
                                
                                if (Math.abs(dx) / node.width > Math.abs(dy) / node.height) {
                                    return [nx + (dx > 0 ? node.width / 2 : -node.width / 2), ny];
                                } else {
                                    return [nx, ny + (dy > 0 ? node.height / 2 : -node.height / 2)];
                                }
                            };

                            if (d.anchorPoints && d.anchorPoints.length > 0) {
                                // Use anchor points
                                let points = [];
                                
                                // Source connection
                                const pStart = getEdgePoint(sourceNode, d.anchorPoints[0].x, d.anchorPoints[0].y);
                                points.push({ x: pStart[0], y: pStart[1] });
                                
                                // Intermediate points
                                d.anchorPoints.forEach(p => points.push(p));
                                
                                // Target connection
                                const lastAnchor = d.anchorPoints[d.anchorPoints.length - 1];
                                const pEnd = getEdgePoint(targetNode, lastAnchor.x, lastAnchor.y);
                                points.push({ x: pEnd[0], y: pEnd[1] });
                                
                                path = "M " + points[0].x + "," + points[0].y;
                                for (let i = 1; i < points.length; i++) {
                                    path += " L " + points[i].x + "," + points[i].y;
                                }
                                
                                // Position label at the first segment midpoint
                                labelX = (points[0].x + points[1].x) / 2;
                                labelY = (points[0].y + points[1].y) / 2 - 10;
                            } else {
                                // Default orthogonal-ish path
                                if (dx > dy) {
                                    sy = csy + offset;
                                    ty = cty + offset;
                                    const midX = (csx + ctx) / 2;
                                    sx = csx + (ctx > csx ? sourceNode.width / 2 : -sourceNode.width / 2);
                                    tx = ctx + (csx > ctx ? targetNode.width / 2 : -targetNode.width / 2);
                                    path = "M " + sx + "," + sy + " L " + midX + "," + sy + " L " + midX + "," + ty + " L " + tx + "," + ty;
                                    labelX = midX;
                                    labelY = (sy + ty) / 2 - 10;
                                } else {
                                    sx = csx + offset;
                                    tx = ctx + offset;
                                    const midY = (csy + cty) / 2;
                                    sy = csy + (cty > csy ? sourceNode.height / 2 : -sourceNode.height / 2);
                                    ty = cty + (csy > cty ? targetNode.height / 2 : -targetNode.height / 2);
                                    path = "M " + sx + "," + sy + " L " + sx + "," + midY + " L " + tx + "," + midY + " L " + tx + "," + ty;
                                    labelX = (sx + tx) / 2 + 10;
                                    labelY = midY - 5;
                                }
                            }
                            
                            const markers = markerMap[d.type] || { start: '', end: '' };
                            
                            d3.select(this).select("path")
                                .attr("d", path)
                                .style("marker-start", markers.start ? "url(#" + markers.start + ")" : "")
                                .style("marker-end", markers.end ? "url(#" + markers.end + ")" : "");
                            
                            const label = d.customLabel || d.propertyName || d.type;
                            
                            d3.select(this).select("text")
                                .attr("x", labelX)
                                .attr("y", labelY)
                                .text(label);
                        });
                    }

                    // Label editing logic
                    let currentEditingLink = null;
                    const editOverlay = document.getElementById("edit-overlay");
                    const editInput = document.getElementById("edit-input");

                    function showLabelEditor(event, d) {
                        currentEditingLink = d;
                        editOverlay.style.display = "block";
                        editOverlay.style.left = event.clientX + "px";
                        editOverlay.style.top = event.clientY + "px";
                        editInput.value = d.customLabel || d.propertyName || d.type;
                        editInput.focus();
                        editInput.select();
                    }

                    editInput.addEventListener("keydown", function(e) {
                        if (e.key === "Enter") {
                            finishEditing();
                        } else if (e.key === "Escape") {
                            cancelEditing();
                        }
                    });

                    editInput.addEventListener("blur", finishEditing);

                    function finishEditing() {
                        if (currentEditingLink) {
                            currentEditingLink.customLabel = editInput.value;
                            editOverlay.style.display = "none";
                            currentEditingLink = null;
                            render();
                            saveState();
                        }
                    }

                    function cancelEditing() {
                        editOverlay.style.display = "none";
                        currentEditingLink = null;
                    }

                    function saveState() {
                        const positions = {};
                        nodes.forEach(function(node) {
                            positions[node.id] = { x: node.x, y: node.y };
                        });

                        const relations = {};
                         links.forEach(function(link) {
                            if (link.customLabel || (link.anchorPoints && link.anchorPoints.length > 0)) {
                                relations[link.id] = {
                                    customLabel: link.customLabel,
                                    anchorPoints: link.anchorPoints
                                };
                            }
                        });

                        vscode.postMessage({
                            type: 'saveState',
                            state: {
                                positions: positions,
                                relations: relations
                            }
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
                        saveState();
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
                        saveState();
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
