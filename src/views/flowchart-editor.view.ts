import * as vscode from "vscode";
import {
  FlowchartData,
  FlowchartNode,
  FlowchartEdge,
  NODE_CONFIGS,
  CARDINALITY_SYMBOLS,
} from "../types/flowchart-types";

export class FlowchartEditorPanel {
  public static currentPanel: FlowchartEditorPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];
  private _currentData: FlowchartData;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    initialData: FlowchartData
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;
    this._currentData = initialData;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    initialData: FlowchartData
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (FlowchartEditorPanel.currentPanel) {
      FlowchartEditorPanel.currentPanel._panel.reveal(column);
      FlowchartEditorPanel.currentPanel._update(initialData);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "flowchartEditor",
      "Flowchart Editor",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );

    FlowchartEditorPanel.currentPanel = new FlowchartEditorPanel(
      panel,
      extensionUri,
      context,
      initialData
    );
    FlowchartEditorPanel.currentPanel._update(initialData);
  }

  public dispose() {
    FlowchartEditorPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private _handleMessage(message: any) {
    switch (message.type) {
      case "save":
        this._saveData(message.data);
        break;
      case "export":
        this._exportDiagram(message.format, message.content);
        break;
      case "error":
        vscode.window.showErrorMessage(message.message);
        break;
      case "info":
        vscode.window.showInformationMessage(message.message);
        break;
    }
  }

  private _saveData(data: FlowchartData) {
    this._currentData = data;
    const workspaceName =
      vscode.workspace.workspaceFolders?.[0]?.name || "default";
    const key = `flowchart.data.${workspaceName}`;
    this._context.globalState.update(key, data);
  }

  private async _exportDiagram(format: string, content: string) {
    if (format === "svg" || format === "json") {
      const uri = await vscode.window.showSaveDialog({
        filters:
          format === "svg"
            ? { "SVG Image": ["svg"] }
            : { "JSON File": ["json"] },
        defaultUri: vscode.Uri.file(
          `flowchart-${new Date().toISOString().slice(0, 10)}.${format}`
        ),
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(content, "utf-8")
        );
        vscode.window.showInformationMessage(`Diagrama exportado: ${uri.fsPath}`);
      }
    }
  }

  private _update(data: FlowchartData) {
    this._currentData = data;
    this._panel.webview.html = this._getHtmlForWebview(data);
  }

  private _loadSavedData(): FlowchartData | null {
    const workspaceName =
      vscode.workspace.workspaceFolders?.[0]?.name || "default";
    const key = `flowchart.data.${workspaceName}`;
    return this._context.globalState.get(key, null);
  }

  private _getHtmlForWebview(data: FlowchartData): string {
    const dataJson = JSON.stringify(data);
    const nodeConfigsJson = JSON.stringify(NODE_CONFIGS);
    const cardinalitySymbolsJson = JSON.stringify(CARDINALITY_SYMBOLS);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flowchart Editor</title>
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
            display: flex;
        }
        
        /* Toolbar */
        #toolbar {
            width: 60px;
            background: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-panel-border);
            padding: 10px 5px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 100;
        }
        
        .toolbar-btn {
            width: 50px;
            height: 50px;
            background: var(--vscode-button-secondaryBackground);
            border: 1px solid var(--vscode-button-border, transparent);
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--vscode-button-secondaryForeground);
            font-size: 20px;
            transition: all 0.2s;
        }
        
        .toolbar-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
            border-color: var(--vscode-focusBorder);
        }
        
        .toolbar-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .toolbar-btn svg {
            width: 24px;
            height: 24px;
            fill: currentColor;
        }
        
        .toolbar-divider {
            height: 1px;
            background: var(--vscode-panel-border);
            margin: 5px 0;
        }
        
        /* Canvas area */
        #canvas-container {
            flex: 1;
            position: relative;
            overflow: hidden;
        }
        
        #canvas {
            width: 100%;
            height: 100%;
            cursor: default;
        }
        
        #canvas.mode-connect {
            cursor: crosshair;
        }
        
        /* Properties panel */
        #properties {
            width: 250px;
            background: var(--vscode-sideBar-background);
            border-left: 1px solid var(--vscode-panel-border);
            padding: 15px;
            overflow-y: auto;
            display: none;
        }
        
        #properties.visible {
            display: block;
        }
        
        #properties h3 {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--vscode-sideBarTitle-foreground);
            text-transform: uppercase;
        }
        
        .prop-group {
            margin-bottom: 15px;
        }
        
        .prop-group label {
            display: block;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 5px;
        }
        
        .prop-group input,
        .prop-group select {
            width: 100%;
            padding: 6px 8px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            border-radius: 2px;
            font-size: 13px;
        }
        
        .prop-group input:focus,
        .prop-group select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        /* Top controls */
        #top-controls {
            position: absolute;
            top: 10px;
            right: 10px;
            display: flex;
            gap: 8px;
            z-index: 50;
        }
        
        .control-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 2px;
            font-size: 12px;
        }
        
        .control-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        /* Node styles */
        .node {
            cursor: move;
        }
        
        .node.selected .node-shape {
            stroke: var(--vscode-focusBorder) !important;
            stroke-width: 3px !important;
        }
        
        .node-shape {
            fill: var(--vscode-editor-background);
            stroke: var(--vscode-panel-border);
            stroke-width: 2px;
        }
        
        .node-shape.entity {
            fill: var(--vscode-editor-background);
        }
        
        .node-shape.process {
            fill: var(--vscode-editor-inactiveSelectionBackground);
        }
        
        .node-shape.decision {
            fill: var(--vscode-editorWarning-foreground);
            opacity: 0.2;
        }
        
        .node-shape.start, .node-shape.end {
            fill: var(--vscode-terminal-ansiGreen);
            opacity: 0.3;
        }
        
        .node-label {
            fill: var(--vscode-editor-foreground);
            font-size: 13px;
            text-anchor: middle;
            dominant-baseline: middle;
            pointer-events: none;
        }
        
        .entity-header {
            fill: var(--vscode-titleBar-activeBackground);
            opacity: 0.4;
        }
        
        .entity-title {
            fill: var(--vscode-editor-foreground);
            font-size: 14px;
            font-weight: bold;
            text-anchor: middle;
        }
        
        .entity-field {
            fill: var(--vscode-editor-foreground);
            font-size: 11px;
            font-family: var(--vscode-editor-font-family);
        }
        
        .field-primary {
            fill: var(--vscode-terminal-ansiYellow);
        }
        
        .field-relation {
            fill: var(--vscode-terminal-ansiBlue);
        }
        
        /* Edge styles */
        .edge {
            cursor: pointer;
        }
        
        .edge.selected .edge-path {
            stroke: var(--vscode-focusBorder) !important;
            stroke-width: 3px !important;
        }
        
        .edge-path {
            fill: none;
            stroke: var(--vscode-terminal-ansiCyan);
            stroke-width: 2px;
        }
        
        .edge-label {
            fill: var(--vscode-descriptionForeground);
            font-size: 11px;
        }
        
        .cardinality-label {
            fill: var(--vscode-terminal-ansiMagenta);
            font-size: 12px;
            font-weight: bold;
        }
        
        /* Connection handles */
        .connection-handle {
            fill: var(--vscode-button-background);
            stroke: var(--vscode-editor-background);
            stroke-width: 2px;
            cursor: crosshair;
            opacity: 0;
            transition: opacity 0.2s;
        }
        
        .node:hover .connection-handle {
            opacity: 1;
        }
        
        /* Delete button */
        .delete-btn {
            fill: var(--vscode-errorForeground);
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
        }
        
        .node:hover .delete-btn,
        .edge:hover .delete-btn {
            opacity: 0.7;
        }
        
        .delete-btn:hover {
            opacity: 1 !important;
        }
        
        /* Temp connection line */
        .temp-connection {
            stroke: var(--vscode-terminal-ansiCyan);
            stroke-width: 2px;
            stroke-dasharray: 5,5;
            fill: none;
            pointer-events: none;
        }

        /* Zoom info */
        #zoom-info {
            position: absolute;
            bottom: 10px;
            left: 70px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <div id="toolbar">
        <button class="toolbar-btn" id="btn-select" title="Seleccionar (V)">
            <svg viewBox="0 0 24 24"><path d="M13.64 21.97C13.14 22.21 12.54 22 12.31 21.5L10.13 16.76L7.62 18.78C7.45 18.92 7.24 19 7 19C6.45 19 6 18.55 6 18V3C6 2.45 6.45 2 7 2C7.24 2 7.47 2.09 7.64 2.23L19.14 11.42C19.64 11.78 19.77 12.47 19.42 12.97C19.24 13.23 18.97 13.39 18.67 13.44L14.74 14.03L16.96 18.76C17.19 19.26 16.97 19.87 16.5 20.1L13.64 21.97Z"/></svg>
        </button>
        <button class="toolbar-btn" id="btn-connect" title="Conectar (C)">
            <svg viewBox="0 0 24 24"><path d="M4 15V9H2V15H4M7 15H5V9H7V15M22 15V9H20V15H22M19 15H17V9H19V15M14 10V14H10V10H14M16 8H8V16H16V8Z"/></svg>
        </button>
        <div class="toolbar-divider"></div>
        <button class="toolbar-btn" id="btn-rect" title="Rectángulo - Proceso">
            <svg viewBox="0 0 24 24"><path d="M4 6V18H20V6H4M18 16H6V8H18V16Z"/></svg>
        </button>
        <button class="toolbar-btn" id="btn-diamond" title="Diamante - Decisión">
            <svg viewBox="0 0 24 24"><path d="M12 2L2 12L12 22L22 12L12 2M12 4.83L19.17 12L12 19.17L4.83 12L12 4.83Z"/></svg>
        </button>
        <button class="toolbar-btn" id="btn-ellipse" title="Óvalo - Inicio/Fin">
            <svg viewBox="0 0 24 24"><path d="M12 6C16.41 6 20 8.69 20 12S16.41 18 12 18 4 15.31 4 12 7.59 6 12 6M12 4C6.5 4 2 7.58 2 12S6.5 20 12 20 22 16.42 22 12 17.5 4 12 4Z"/></svg>
        </button>
        <div class="toolbar-divider"></div>
        <button class="toolbar-btn" id="btn-delete" title="Eliminar (Del)">
            <svg viewBox="0 0 24 24"><path d="M19 4H15.5L14.5 3H9.5L8.5 4H5V6H19M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19Z"/></svg>
        </button>
    </div>
    
    <div id="canvas-container">
        <svg id="canvas"></svg>
        <div id="top-controls">
            <button class="control-btn" id="btn-reset">Reset Layout</button>
            <button class="control-btn" id="btn-export-svg">Export SVG</button>
            <button class="control-btn" id="btn-export-json">Export JSON</button>
            <button class="control-btn" id="btn-save">Guardar</button>
        </div>
        <div id="zoom-info">100%</div>
    </div>
    
    <div id="properties">
        <h3>Propiedades</h3>
        <div id="node-props" style="display:none;">
            <div class="prop-group">
                <label>Etiqueta</label>
                <input type="text" id="prop-label">
            </div>
            <div class="prop-group">
                <label>Tipo</label>
                <select id="prop-type">
                    <option value="entity">Entidad</option>
                    <option value="process">Proceso</option>
                    <option value="decision">Decisión</option>
                    <option value="start">Inicio</option>
                    <option value="end">Fin</option>
                </select>
            </div>
        </div>
        <div id="edge-props" style="display:none;">
            <div class="prop-group">
                <label>Etiqueta</label>
                <input type="text" id="prop-edge-label">
            </div>
            <div class="prop-group">
                <label>Cardinalidad</label>
                <select id="prop-cardinality">
                    <option value="none">Ninguna</option>
                    <option value="1:1">1:1</option>
                    <option value="1:N">1:N</option>
                    <option value="N:1">N:1</option>
                    <option value="N:M">N:M</option>
                </select>
            </div>
            <div class="prop-group">
                <label>Estilo</label>
                <select id="prop-edge-style">
                    <option value="solid">Sólido</option>
                    <option value="dashed">Discontinuo</option>
                    <option value="dotted">Punteado</option>
                </select>
            </div>
        </div>
    </div>
    
    <script>
    (function() {
        const vscode = acquireVsCodeApi();
        const initialData = ${dataJson};
        const NODE_CONFIGS = ${nodeConfigsJson};
        const CARDINALITY_SYMBOLS = ${cardinalitySymbolsJson};
        
        // State
        let nodes = initialData.nodes || [];
        let edges = initialData.edges || [];
        let selectedNode = null;
        let selectedEdge = null;
        let mode = 'select'; // 'select', 'connect', 'addRect', 'addDiamond', 'addEllipse'
        let connectingFrom = null;
        let tempLine = null;
        let nodeIdCounter = nodes.length + 1;
        let edgeIdCounter = edges.length + 1;
        
        // Setup SVG - explicit dimensions with fallback (webview can report 0 on first load)
        const svg = d3.select("#canvas");
        let width = Math.max((window.innerWidth || 0) - 310, 800);
        let height = Math.max(window.innerHeight || 0, 600);
        
        svg.attr("width", width).attr("height", height);
        
        function updateSvgSize() {
            width = Math.max((window.innerWidth || 0) - 310, 800);
            height = Math.max(window.innerHeight || 0, 600);
            svg.attr("width", width).attr("height", height);
        }
        window.addEventListener("resize", updateSvgSize);
        
        // Defs for arrows
        const defs = svg.append("defs");
        defs.append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 10)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "var(--vscode-terminal-ansiCyan)");
        
        // Container with zoom
        const container = svg.append("g");
        
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", function(event) {
                container.attr("transform", event.transform);
                document.getElementById("zoom-info").textContent = Math.round(event.transform.k * 100) + "%";
            });
        
        svg.call(zoom);
        
        // Groups
        const edgeGroup = container.append("g").attr("class", "edges");
        const nodeGroup = container.append("g").attr("class", "nodes");
        const tempGroup = container.append("g").attr("class", "temp");
        
        // Mode switching
        function setMode(newMode) {
            mode = newMode;
            document.querySelectorAll('.toolbar-btn').forEach(btn => btn.classList.remove('active'));
            
            const modeMap = {
                'select': 'btn-select',
                'connect': 'btn-connect',
                'addRect': 'btn-rect',
                'addDiamond': 'btn-diamond',
                'addEllipse': 'btn-ellipse'
            };
            
            if (modeMap[newMode]) {
                document.getElementById(modeMap[newMode]).classList.add('active');
            }
            
            svg.classed('mode-connect', newMode === 'connect');
        }
        
        // Toolbar events
        document.getElementById('btn-select').onclick = () => setMode('select');
        document.getElementById('btn-connect').onclick = () => setMode('connect');
        document.getElementById('btn-rect').onclick = () => setMode('addRect');
        document.getElementById('btn-diamond').onclick = () => setMode('addDiamond');
        document.getElementById('btn-ellipse').onclick = () => setMode('addEllipse');
        document.getElementById('btn-delete').onclick = deleteSelected;
        
        // Control buttons
        document.getElementById('btn-reset').onclick = resetLayout;
        document.getElementById('btn-export-svg').onclick = exportSVG;
        document.getElementById('btn-export-json').onclick = exportJSON;
        document.getElementById('btn-save').onclick = saveData;
        
        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT') return;
            
            switch(e.key.toLowerCase()) {
                case 'v': setMode('select'); break;
                case 'c': setMode('connect'); break;
                case 'delete':
                case 'backspace': deleteSelected(); break;
                case 'escape': 
                    cancelConnection();
                    deselectAll();
                    break;
            }
        });
        
        // Canvas click for adding shapes
        svg.on("click", function(event) {
            if (mode.startsWith('add')) {
                const [x, y] = d3.pointer(event, container.node());
                addNode(mode, x, y);
                setMode('select');
            } else if (mode === 'select') {
                deselectAll();
            }
        });
        
        // Add node function
        function addNode(modeType, x, y) {
            const typeMap = {
                'addRect': 'process',
                'addDiamond': 'decision',
                'addEllipse': 'start'
            };
            const nodeType = typeMap[modeType] || 'process';
            const config = NODE_CONFIGS[nodeType];
            
            const newNode = {
                id: 'node-' + (nodeIdCounter++),
                type: nodeType,
                label: nodeType.charAt(0).toUpperCase() + nodeType.slice(1),
                x: x - config.defaultWidth / 2,
                y: y - config.defaultHeight / 2,
                width: config.defaultWidth,
                height: config.defaultHeight
            };
            
            nodes.push(newNode);
            render();
            selectNode(newNode);
        }
        
        // Delete selected
        function deleteSelected() {
            if (selectedNode) {
                nodes = nodes.filter(n => n.id !== selectedNode.id);
                edges = edges.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id);
                selectedNode = null;
            }
            if (selectedEdge) {
                edges = edges.filter(e => e.id !== selectedEdge.id);
                selectedEdge = null;
            }
            render();
            hideProperties();
        }
        
        // Selection
        function selectNode(node) {
            deselectAll();
            selectedNode = node;
            nodeGroup.selectAll('.node').classed('selected', d => d.id === node.id);
            showNodeProperties(node);
        }
        
        function selectEdge(edge) {
            deselectAll();
            selectedEdge = edge;
            edgeGroup.selectAll('.edge').classed('selected', d => d.id === edge.id);
            showEdgeProperties(edge);
        }
        
        function deselectAll() {
            selectedNode = null;
            selectedEdge = null;
            nodeGroup.selectAll('.node').classed('selected', false);
            edgeGroup.selectAll('.edge').classed('selected', false);
            hideProperties();
        }
        
        // Properties panel
        function showNodeProperties(node) {
            document.getElementById('properties').classList.add('visible');
            document.getElementById('node-props').style.display = 'block';
            document.getElementById('edge-props').style.display = 'none';
            
            document.getElementById('prop-label').value = node.label;
            document.getElementById('prop-type').value = node.type;
            
            // Disable type change for entities
            document.getElementById('prop-type').disabled = node.type === 'entity';
        }
        
        function showEdgeProperties(edge) {
            document.getElementById('properties').classList.add('visible');
            document.getElementById('node-props').style.display = 'none';
            document.getElementById('edge-props').style.display = 'block';
            
            document.getElementById('prop-edge-label').value = edge.label || '';
            document.getElementById('prop-cardinality').value = edge.cardinality || 'none';
            document.getElementById('prop-edge-style').value = edge.style || 'solid';
        }
        
        function hideProperties() {
            document.getElementById('properties').classList.remove('visible');
        }
        
        // Property change handlers
        document.getElementById('prop-label').onchange = function() {
            if (selectedNode) {
                selectedNode.label = this.value;
                render();
            }
        };
        
        document.getElementById('prop-type').onchange = function() {
            if (selectedNode && selectedNode.type !== 'entity') {
                const config = NODE_CONFIGS[this.value];
                selectedNode.type = this.value;
                selectedNode.width = config.defaultWidth;
                selectedNode.height = config.defaultHeight;
                render();
            }
        };
        
        document.getElementById('prop-edge-label').onchange = function() {
            if (selectedEdge) {
                selectedEdge.label = this.value;
                render();
            }
        };
        
        document.getElementById('prop-cardinality').onchange = function() {
            if (selectedEdge) {
                selectedEdge.cardinality = this.value;
                render();
            }
        };
        
        document.getElementById('prop-edge-style').onchange = function() {
            if (selectedEdge) {
                selectedEdge.style = this.value;
                render();
            }
        };
        
        // Connection handling
        function startConnection(node, event) {
            if (mode !== 'connect') return;
            
            connectingFrom = node;
            const [x, y] = d3.pointer(event, container.node());
            
            tempLine = tempGroup.append("line")
                .attr("class", "temp-connection")
                .attr("x1", node.x + node.width / 2)
                .attr("y1", node.y + node.height / 2)
                .attr("x2", x)
                .attr("y2", y);
            
            svg.on("mousemove.connect", function(e) {
                const [mx, my] = d3.pointer(e, container.node());
                tempLine.attr("x2", mx).attr("y2", my);
            });
        }
        
        function endConnection(targetNode) {
            if (!connectingFrom || !targetNode || connectingFrom.id === targetNode.id) {
                cancelConnection();
                return;
            }
            
            // Check if edge already exists
            const exists = edges.some(e => 
                (e.source === connectingFrom.id && e.target === targetNode.id) ||
                (e.source === targetNode.id && e.target === connectingFrom.id)
            );
            
            if (!exists) {
                edges.push({
                    id: 'edge-' + (edgeIdCounter++),
                    source: connectingFrom.id,
                    target: targetNode.id,
                    cardinality: 'none',
                    label: '',
                    style: 'solid'
                });
                render();
            }
            
            cancelConnection();
        }
        
        function cancelConnection() {
            connectingFrom = null;
            if (tempLine) {
                tempLine.remove();
                tempLine = null;
            }
            svg.on("mousemove.connect", null);
        }
        
        // Reset layout
        function resetLayout() {
            const cols = Math.ceil(Math.sqrt(nodes.length));
            const spacing = { x: 250, y: 180 };
            
            nodes.forEach((node, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                node.x = 100 + col * spacing.x;
                node.y = 100 + row * spacing.y;
            });
            
            render();
        }
        
        // Export functions
        function exportSVG() {
            const svgEl = document.getElementById("canvas");
            const clone = svgEl.cloneNode(true);
            
            // Add styles
            const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
            style.textContent = document.querySelector('style').textContent;
            clone.insertBefore(style, clone.firstChild);
            
            const svgData = new XMLSerializer().serializeToString(clone);
            vscode.postMessage({
                type: 'export',
                format: 'svg',
                content: svgData
            });
        }
        
        function exportJSON() {
            const data = { nodes, edges };
            vscode.postMessage({
                type: 'export',
                format: 'json',
                content: JSON.stringify(data, null, 2)
            });
        }
        
        function saveData() {
            vscode.postMessage({
                type: 'save',
                data: { nodes, edges }
            });
            vscode.postMessage({
                type: 'info',
                message: 'Diagrama guardado correctamente'
            });
        }
        
        // Main render function
        function render() {
            // --- EDGES ---
            const edgeSelection = edgeGroup.selectAll(".edge")
                .data(edges, d => d.id);
            
            edgeSelection.exit().remove();
            
            const edgeEnter = edgeSelection.enter()
                .append("g")
                .attr("class", "edge")
                .on("click", function(event, d) {
                    event.stopPropagation();
                    selectEdge(d);
                });
            
            edgeEnter.append("path")
                .attr("class", "edge-path")
                .attr("marker-end", "url(#arrowhead)");
            
            edgeEnter.append("text")
                .attr("class", "edge-label");
            
            edgeEnter.append("text")
                .attr("class", "cardinality-label cardinality-source");
            
            edgeEnter.append("text")
                .attr("class", "cardinality-label cardinality-target");
            
            const allEdges = edgeEnter.merge(edgeSelection);
            
            // Update edge paths
            allEdges.each(function(d) {
                const sourceNode = nodes.find(n => n.id === d.source);
                const targetNode = nodes.find(n => n.id === d.target);
                
                if (!sourceNode || !targetNode) return;
                
                const sx = sourceNode.x + sourceNode.width / 2;
                const sy = sourceNode.y + sourceNode.height / 2;
                const tx = targetNode.x + targetNode.width / 2;
                const ty = targetNode.y + targetNode.height / 2;
                
                const midX = (sx + tx) / 2;
                const midY = (sy + ty) / 2;
                
                // Calculate edge connection points
                const path = \`M \${sx},\${sy} Q \${midX},\${sy} \${midX},\${midY} Q \${midX},\${ty} \${tx},\${ty}\`;
                
                const g = d3.select(this);
                
                g.select(".edge-path")
                    .attr("d", path)
                    .attr("stroke-dasharray", d.style === 'dashed' ? '8,4' : d.style === 'dotted' ? '2,2' : 'none');
                
                g.select(".edge-label")
                    .attr("x", midX)
                    .attr("y", midY - 10)
                    .attr("text-anchor", "middle")
                    .text(d.label || '');
                
                // Cardinality labels
                if (d.cardinality && d.cardinality !== 'none') {
                    const symbols = CARDINALITY_SYMBOLS[d.cardinality];
                    
                    g.select(".cardinality-source")
                        .attr("x", sx + (midX - sx) * 0.15)
                        .attr("y", sy - 5)
                        .text(symbols.source);
                    
                    g.select(".cardinality-target")
                        .attr("x", tx - (tx - midX) * 0.15)
                        .attr("y", ty - 5)
                        .text(symbols.target);
                } else {
                    g.select(".cardinality-source").text('');
                    g.select(".cardinality-target").text('');
                }
            });
            
            // --- NODES ---
            const nodeSelection = nodeGroup.selectAll(".node")
                .data(nodes, d => d.id);
            
            nodeSelection.exit().remove();
            
            const nodeEnter = nodeSelection.enter()
                .append("g")
                .attr("class", "node")
                .call(d3.drag()
                    .on("start", function(event, d) {
                        if (mode === 'connect') {
                            startConnection(d, event);
                        } else {
                            d3.select(this).raise();
                        }
                    })
                    .on("drag", function(event, d) {
                        if (mode !== 'connect') {
                            d.x = event.x;
                            d.y = event.y;
                            d3.select(this).attr("transform", \`translate(\${d.x},\${d.y})\`);
                            render(); // Update edges
                        }
                    })
                    .on("end", function(event, d) {
                        if (mode === 'connect') {
                            // Find target node
                            const [x, y] = d3.pointer(event, container.node());
                            const target = nodes.find(n => 
                                x >= n.x && x <= n.x + n.width &&
                                y >= n.y && y <= n.y + n.height &&
                                n.id !== connectingFrom?.id
                            );
                            if (target) {
                                endConnection(target);
                            } else {
                                cancelConnection();
                            }
                        }
                    })
                )
                .on("click", function(event, d) {
                    event.stopPropagation();
                    if (mode === 'select') {
                        selectNode(d);
                    }
                });
            
            // Draw different shapes based on type
            nodeEnter.each(function(d) {
                const g = d3.select(this);
                
                if (d.type === 'entity') {
                    drawEntityNode(g, d);
                } else if (d.type === 'decision') {
                    drawDiamondNode(g, d);
                } else if (d.type === 'start' || d.type === 'end') {
                    drawEllipseNode(g, d);
                } else {
                    drawRectNode(g, d);
                }
                
                // Delete button
                g.append("text")
                    .attr("class", "delete-btn")
                    .attr("x", d.width - 10)
                    .attr("y", 15)
                    .text("×")
                    .on("click", function(event) {
                        event.stopPropagation();
                        selectNode(d);
                        deleteSelected();
                    });
            });
            
            // Update positions
            nodeEnter.merge(nodeSelection)
                .attr("transform", d => \`translate(\${d.x},\${d.y})\`);
        }
        
        function drawEntityNode(g, d) {
            const headerHeight = 35;
            
            // Main box
            g.append("rect")
                .attr("class", "node-shape entity")
                .attr("width", d.width)
                .attr("height", d.height)
                .attr("rx", 4);
            
            // Header
            g.append("rect")
                .attr("class", "entity-header")
                .attr("width", d.width)
                .attr("height", headerHeight)
                .attr("rx", 4);
            
            // Title
            g.append("text")
                .attr("class", "entity-title")
                .attr("x", d.width / 2)
                .attr("y", headerHeight / 2)
                .attr("dominant-baseline", "middle")
                .text(d.label);
            
            // Fields
            if (d.data && d.data.fields) {
                d.data.fields.slice(0, 8).forEach((field, i) => {
                    const y = headerHeight + 15 + i * 18;
                    let className = "entity-field";
                    let prefix = "  ";
                    
                    if (field.isPrimary) {
                        className = "entity-field field-primary";
                        prefix = "🔑 ";
                    } else if (field.isRelation) {
                        className = "entity-field field-relation";
                        prefix = "🔗 ";
                    }
                    
                    g.append("text")
                        .attr("class", className)
                        .attr("x", 8)
                        .attr("y", y)
                        .text(prefix + field.name + ": " + field.type);
                });
                
                if (d.data.fields.length > 8) {
                    g.append("text")
                        .attr("class", "entity-field")
                        .attr("x", 8)
                        .attr("y", headerHeight + 15 + 8 * 18)
                        .text("... +" + (d.data.fields.length - 8) + " más");
                }
            }
        }
        
        function drawRectNode(g, d) {
            g.append("rect")
                .attr("class", "node-shape process")
                .attr("width", d.width)
                .attr("height", d.height)
                .attr("rx", 4);
            
            g.append("text")
                .attr("class", "node-label")
                .attr("x", d.width / 2)
                .attr("y", d.height / 2)
                .text(d.label);
        }
        
        function drawDiamondNode(g, d) {
            const cx = d.width / 2;
            const cy = d.height / 2;
            
            g.append("polygon")
                .attr("class", "node-shape decision")
                .attr("points", \`\${cx},0 \${d.width},\${cy} \${cx},\${d.height} 0,\${cy}\`);
            
            g.append("text")
                .attr("class", "node-label")
                .attr("x", cx)
                .attr("y", cy)
                .text(d.label);
        }
        
        function drawEllipseNode(g, d) {
            g.append("ellipse")
                .attr("class", "node-shape " + d.type)
                .attr("cx", d.width / 2)
                .attr("cy", d.height / 2)
                .attr("rx", d.width / 2)
                .attr("ry", d.height / 2);
            
            g.append("text")
                .attr("class", "node-label")
                .attr("x", d.width / 2)
                .attr("y", d.height / 2)
                .text(d.label);
        }
        
        // Initial render - delay one frame so webview has layout dimensions
        setMode('select');
        requestAnimationFrame(function() {
            updateSvgSize();
            render();
        });
        
        // Auto-save on window close
        window.addEventListener('beforeunload', saveData);
    })();
    </script>
</body>
</html>`;
  }
}
