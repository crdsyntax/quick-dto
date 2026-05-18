import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3';
import { ErdData, SavedDiagramState, Node, Link, Position } from '../types';

interface ErdCanvasProps {
  data: ErdData;
  savedState: SavedDiagramState;
  onSaveState: (state: SavedDiagramState) => void;
  onShowLabelEditor: (event: any, link: Link) => void;
}

export interface ErdCanvasHandle {
  resetLayout: () => void;
  exportSvg: () => void;
  getMermaid: () => string;
}

const ErdCanvas = forwardRef<ErdCanvasHandle, ErdCanvasProps>(({ data, savedState, onSaveState, onShowLabelEditor }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<SVGGElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);
  const zoomRef = useRef<any>(null);

  const config = {
    nodeWidth: 250,
    nodeHeaderHeight: 35,
    fieldHeight: 20,
    fieldPadding: 8,
    nodeSpacing: 100,
  };

  useImperativeHandle(ref, () => ({
    resetLayout: () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      nodesRef.current.forEach((node, i) => {
        const angle = (i / nodesRef.current.length) * 2 * Math.PI;
        const radius = Math.min(width, height) / 3;
        node.x = width / 2 + radius * Math.cos(angle) - node.width / 2;
        node.y = height / 2 + radius * Math.sin(angle) - node.height / 2;
      });
      render();
      saveState();
    },
    exportSvg: () => {
      if (!svgRef.current) return;
      const svgEl = svgRef.current;
      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      
      const style = getComputedStyle(document.body);
      const bgColor = style.getPropertyValue('--vscode-editor-background') || '#1e1e1e';
      const fgColor = style.getPropertyValue('--vscode-editor-foreground') || '#cccccc';
      const borderColor = style.getPropertyValue('--vscode-panel-border') || '#444';
      const cyanColor = style.getPropertyValue('--vscode-terminal-ansiCyan') || '#4ec9b0';
      const yellowColor = style.getPropertyValue('--vscode-terminal-ansiYellow') || '#dcdcaa';
      const blueColor = style.getPropertyValue('--vscode-terminal-ansiBlue') || '#569cd6';
      
      const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
      styleEl.textContent = `
          .entity-box { fill: ${bgColor}; stroke: ${borderColor}; stroke-width: 2px; rx: 4px; }
          .entity-title { fill: ${fgColor}; font-weight: bold; font-family: sans-serif; font-size: 14px; text-anchor: middle; dominant-baseline: middle; }
          .entity-field { fill: ${fgColor}; font-family: sans-serif; font-size: 12px; }
          .field-primary { fill: ${yellowColor}; font-weight: bold; font-family: sans-serif; font-size: 12px; }
          .field-relation { fill: ${blueColor}; text-decoration: underline; font-family: sans-serif; font-size: 12px; }
          .field-enum { fill: ${cyanColor}; font-style: italic; font-family: sans-serif; font-size: 12px; }
          .relation-path { fill: none; stroke: ${cyanColor}; stroke-width: 2px; }
          .relation-label { fill: ${fgColor}; font-size: 11px; font-family: sans-serif; text-anchor: middle; }
          text { font-family: Segoe UI, sans-serif; }
      `;
      
      clone.insertBefore(styleEl, clone.firstChild);
      
      const svgData = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([svgData], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "erd-diagram-" + new Date().toISOString().slice(0,10) + ".svg";
      a.click();
      URL.revokeObjectURL(url);
    },
    getMermaid: () => {
      let mermaid = "erDiagram\n";
      
      Object.entries(data.entities).forEach(([name, entity]) => { 
          mermaid += `    ${name} {\n`;
          if (entity.fields) {
              entity.fields.forEach((f) => {
                  let type = (f.type || 'string').replace(/[^a-zA-Z0-9_\[\]]/g, ''); 
                  let fname = (f.name || '').replace(/[^a-zA-Z0-9_]/g, '');
                  mermaid += `        ${type} ${fname}\n`;
              });
          }
          mermaid += "    }\n";
      });

      const relMap: Record<string, string> = {
          'ManyToOne': '}o--||',
          'OneToMany': '||--o{',
          'OneToOne': '||--||',
          'ManyToMany': '}o--o{'
      };

      Object.entries(data.entities).forEach(([name, entity]) => {
          if (entity.relations) {
              entity.relations.forEach((rel) => {
                  if (data.entities[rel.targetEntity]) {
                      const symbol = relMap[rel.type] || '}o--o{';
                      mermaid += `    ${name} ${symbol} ${rel.targetEntity} : "${rel.propertyName || ''}"\n`;
                  }
              });
          }
      });
      
      return mermaid;
    }
  }));

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    const width = window.innerWidth;
    const height = window.innerHeight;

    svg.attr("width", width).attr("height", height);

    // Markers
    const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
    defs.selectAll("*").remove();

    const createMarker = (id: string, path: string, refX: number, color?: string) => {
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
    };

    createMarker("marker-one-end", "M 4,-6 L 4,6 M 8,-6 L 8,6", 10);
    createMarker("marker-many-end", "M 2,0 L 10,-6 M 2,0 L 10,6", 10);
    createMarker("marker-opt-many-end", "M 6,0 L 10,-6 M 6,0 L 10,6 M 2,0 C 2,-3 5,-3 5,0 C 5,3 2,3 2,0", 10);
    createMarker("marker-one-start", "M 4,-6 L 4,6 M 8,-6 L 8,6", 2);
    createMarker("marker-many-start", "M 10,0 L 2,-6 M 10,0 L 2,6", 2);
    createMarker("marker-opt-many-start", "M 6,0 L 2,-6 M 6,0 L 2,6 M 10,0 C 10,-3 7,-3 7,0 C 7,3 10,3 10,0", 2);

    // Zoom
    const container = d3.select(containerRef.current);
    zoomRef.current = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            container.attr("transform", event.transform);
        });
    svg.call(zoomRef.current);

    // Prepare data
    const entities = data.entities || {};
    const savedPositions = savedState.positions || {};
    const savedRelations = savedState.relations || {};

    nodesRef.current = Object.entries(entities).map(([name, entity]) => {
      const fieldCount = entity.fields.length || 1;
      const nodeHeight = config.nodeHeaderHeight + (fieldCount * config.fieldHeight) + config.fieldPadding;
      const savedNode = savedPositions[name];
      
      return {
          id: name,
          data: entity,
          width: savedNode?.width || config.nodeWidth,
          height: nodeHeight,
          x: savedNode ? savedNode.x : Math.random() * (width - 400) + 200,
          y: savedNode ? savedNode.y : Math.random() * (height - 400) + 200,
      };
    });

    const links: Link[] = [];
    const linkPairCounts: Record<string, number> = {};

    Object.entries(entities).forEach(([sourceName, sourceData]) => {
      (sourceData.relations || []).forEach((rel) => {
          if (entities[rel.targetEntity]) {
              const pairKey = [sourceName, rel.targetEntity].sort().join('-');
              const index = linkPairCounts[pairKey] || 0;
              linkPairCounts[pairKey] = index + 1;
              
              const relKey = `${sourceName}->${rel.targetEntity}:${rel.propertyName}`;
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
    linksRef.current = links;

    render();
  }, [data]);

  const saveState = () => {
    const positions: Record<string, any> = {};
    nodesRef.current.forEach((node) => {
        positions[node.id] = { 
          x: node.x, 
          y: node.y,
          width: node.width,
          height: node.height
        };
    });

    const relations: Record<string, any> = {};
    linksRef.current.forEach((link) => {
        if (link.customLabel || (link.anchorPoints && link.anchorPoints.length > 0)) {
            relations[link.id] = {
                customLabel: link.customLabel,
                anchorPoints: link.anchorPoints
            };
        }
    });

    onSaveState({
        positions: positions,
        relations: relations
    });
  };

  const render = () => {
    if (!containerRef.current) return;
    const container = d3.select(containerRef.current);
    
    // Groups
    let linkGroup = container.select(".links");
    if (linkGroup.empty()) linkGroup = container.append("g").attr("class", "links");
    
    let anchorGroup = container.select(".anchors");
    if (anchorGroup.empty()) anchorGroup = container.append("g").attr("class", "anchors");
    
    let nodeGroup = container.select(".nodes");
    if (nodeGroup.empty()) nodeGroup = container.append("g").attr("class", "nodes");

    // Nodes
    const nodeSelection = nodeGroup.selectAll<SVGGElement, Node>(".entity-node")
      .data(nodesRef.current, (d) => d.id);

    nodeSelection.exit().remove();

    const nodeEnter = nodeSelection.enter()
      .append("g")
      .attr("class", "entity-node")
      .style("cursor", "move")
      .call(d3.drag<SVGGElement, Node>()
        .on("start", function(event) {
          d3.select(this).raise();
        })
        .on("drag", (event, d) => {
          d.x = event.x;
          d.y = event.y;
          render();
        })
        .on("end", saveState)
      );

    nodeEnter.append("rect")
      .attr("class", "entity-box")
      .attr("fill", "var(--vscode-editor-background)")
      .attr("stroke", "var(--vscode-panel-border)")
      .attr("stroke-width", 2)
      .attr("rx", 4);

    nodeEnter.append("rect")
      .attr("class", "title-bg")
      .attr("height", config.nodeHeaderHeight)
      .attr("fill", "var(--vscode-titleBar-activeBackground)")
      .attr("opacity", 0.3);

    nodeEnter.append("text")
      .attr("class", "entity-title")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "var(--vscode-editor-foreground)")
      .style("font-weight", "bold")
      .style("font-size", "14px")
      .text((d) => d.id);

    nodeEnter.append("text")
      .attr("class", "delete-btn")
      .text("×")
      .attr("text-anchor", "middle")
      .attr("fill", "var(--vscode-errorForeground)")
      .style("cursor", "pointer")
      .style("font-weight", "bold")
      .style("font-size", "16px")
      .style("opacity", 0.7)
      .on("mousedown", (e) => e.stopPropagation())
      .on("click", (e, d) => {
        e.stopPropagation();
        nodesRef.current = nodesRef.current.filter(n => n.id !== d.id);
        linksRef.current = linksRef.current.filter(l => l.source !== d.id && l.target !== d.id);
        render();
      });

    // Resize Handle
    nodeEnter.append("path")
      .attr("class", "resize-handle")
      .attr("d", "M -8,0 L 0,-8 M -4,0 L 0,-4")
      .attr("stroke", "var(--vscode-panel-border)")
      .attr("stroke-width", 1.5)
      .style("cursor", "nwse-resize")
      .call(d3.drag<SVGPathElement, Node>()
        .on("start", (event) => { event.sourceEvent.stopPropagation(); })
        .on("drag", (event, d) => {
          d.width = Math.max(150, event.x);
          render();
        })
        .on("end", saveState)
      );

    const allNodes = nodeEnter.merge(nodeSelection);
    
    allNodes.attr("transform", (d) => `translate(${d.x},${d.y})`);
    
    allNodes.select(".entity-box")
      .attr("width", (d) => d.width)
      .attr("height", (d) => d.height);

    allNodes.select(".title-bg")
      .attr("width", (d) => d.width);

    allNodes.select(".entity-title")
      .attr("x", (d) => d.width / 2)
      .attr("y", config.nodeHeaderHeight / 2);

    allNodes.select(".delete-btn")
      .attr("x", (d) => d.width - 15)
      .attr("y", 22);

    allNodes.select(".resize-handle")
      .attr("transform", (d) => `translate(${d.width},${d.height})`);

    allNodes.each(function(d) {
      const node = d3.select(this);
      node.selectAll(".field-group").remove();
      const fieldGroup = node.append("g").attr("class", "field-group");
      
      const fields = d.data.fields;
      
      if (fields.length === 0) {
          fieldGroup.append("text")
              .attr("class", "entity-field")
              .attr("x", 10)
              .attr("y", config.nodeHeaderHeight + 15)
              .attr("fill", "var(--vscode-editor-foreground)")
              .style("font-size", "12px")
              .text("(no fields)");
      } else {
          fields.forEach((field, i) => {
              const y = config.nodeHeaderHeight + (i * config.fieldHeight) + 15;
              let icon = "  ";
              let color = "var(--vscode-editor-foreground)";

              if (field.isPrimary) {
                  icon = "🔑 ";
                  color = "var(--vscode-terminal-ansiYellow)";
              } else if (field.isRelation) {
                  icon = "🔗 ";
                  color = "var(--vscode-terminal-ansiBlue)";
              } else if (field.isEnum) {
                  icon = "E ";
                  color = "var(--vscode-terminal-ansiCyan)";
              }

              const nullable = field.isNullable ? "?" : "";
              let typeDisplay = field.type;
              if (field.isEnum) {
                  typeDisplay = "ENUM " + field.type;
              }

              const text = icon + field.name + nullable + ": " + typeDisplay;
              
              const fieldText = fieldGroup.append("text")
                  .attr("x", 10)
                  .attr("y", y)
                  .attr("fill", color)
                  .style("font-size", "12px")
                  .text(text);

              // Truncate long text if necessary
              const maxChars = Math.floor((d.width - 20) / 7);
              if (text.length > maxChars) {
                fieldText.text(text.substring(0, maxChars - 3) + "...");
                fieldText.append("title").text(text);
              }

              if (field.isRelation) {
                  const relation = d.data.relations.find(r => r.propertyName === field.name);
                  if (relation) {
                      fieldText.on("click", (e) => {
                          e.stopPropagation();
                          focusNode(relation.targetEntity);
                      });
                      fieldText.style("cursor", "pointer");
                      fieldText.style("text-decoration", "underline dotted");
                      fieldText.append("title").text("Click to focus " + relation.targetEntity);
                  }
              }
          });
      }
    });

    // Links
    const linkSelection = linkGroup.selectAll<SVGGElement, Link>("g.link-group")
      .data(linksRef.current, (d) => d.id);

    linkSelection.exit().remove();

    const linkEnter = linkSelection.enter()
      .append("g")
      .attr("class", "link-group");
    
    linkEnter.append("path")
      .attr("class", "relation-path")
      .attr("fill", "none")
      .attr("stroke", "var(--vscode-terminal-ansiCyan)")
      .attr("stroke-width", 2);
    
    linkEnter.append("text")
      .attr("class", "relation-label")
      .attr("fill", "var(--vscode-descriptionForeground)")
      .style("font-size", "11px")
      .style("text-anchor", "middle")
      .style("cursor", "move")
      .style("user-select", "none")
      .on("dblclick", function(e, d) {
          e.stopPropagation();
          onShowLabelEditor(e, d);
      })
      .call(d3.drag<SVGTextElement, Link>()
          .on("start", (e) => { e.sourceEvent.stopPropagation(); })
          .on("drag", (e, d) => {
              if (!svgRef.current) return;
              const transform = d3.zoomTransform(svgRef.current);
              const point = transform.invert([e.sourceEvent.clientX, e.sourceEvent.clientY]);
              d.bendPoint = { x: point[0], y: point[1] };
              render();
          })
          .on("end", saveState)
      );

    linkEnter.on("click", (e, d) => {
      if (e.defaultPrevented || !svgRef.current) return;
      const transform = d3.zoomTransform(svgRef.current);
      const point = transform.invert([e.clientX, e.clientY]);
      if (!d.anchorPoints) d.anchorPoints = [];
      d.anchorPoints.push({ x: point[0], y: point[1] });
      render();
      saveState();
    });
    
    const allLinks = linkEnter.merge(linkSelection);

    // Update Links Paths
    const markerMap: Record<string, { start: string, end: string }> = {
        'ManyToOne': { start: 'marker-opt-many-start', end: 'marker-one-end' },
        'OneToMany': { start: 'marker-one-start', end: 'marker-opt-many-end' },
        'OneToOne': { start: 'marker-one-start', end: 'marker-one-end' },
        'ManyToMany': { start: 'marker-opt-many-start', end: 'marker-opt-many-end' }
    };

    allLinks.each(function(d) {
        const sourceNode = nodesRef.current.find(n => n.id === d.source);
        const targetNode = nodesRef.current.find(n => n.id === d.target);
        
        if (!sourceNode || !targetNode) return;
        
        const csx = sourceNode.x + sourceNode.width / 2;
        const csy = sourceNode.y + sourceNode.height / 2;
        const ctx = targetNode.x + targetNode.width / 2;
        const cty = targetNode.y + targetNode.height / 2;

        const offsetStep = 25;
        const offset = (d.linkIndex - ((d.totalInPair || 1) - 1) / 2) * offsetStep;
        
        const dx = Math.abs(csx - ctx);
        const dy = Math.abs(csy - cty);
        
        let path = "", labelX = 0, labelY = 0;

        const getEdgePoint = (node: Node, otherX: number, otherY: number) => {
            const nx = node.x + node.width / 2;
            const ny = node.y + node.height / 2;
            const dx = otherX - nx;
            const dy = otherY - ny;
            if (Math.abs(dx) / node.width > Math.abs(dy) / node.height) {
                return [nx + (dx > 0 ? node.width / 2 : -node.width / 2), ny];
            } else {
                return [nx, ny + (dy > 0 ? node.height / 2 : -node.height / 2)];
            }
        };

        if (d.anchorPoints && d.anchorPoints.length > 0) {
            let points = [];
            const pStart = getEdgePoint(sourceNode, d.anchorPoints[0].x, d.anchorPoints[0].y);
            points.push({ x: pStart[0], y: pStart[1] });
            d.anchorPoints.forEach(p => points.push(p));
            const lastAnchor = d.anchorPoints[d.anchorPoints.length - 1];
            const pEnd = getEdgePoint(targetNode, lastAnchor.x, lastAnchor.y);
            points.push({ x: pEnd[0], y: pEnd[1] });
            
            path = "M " + points[0].x + "," + points[0].y;
            for (let i = 1; i < points.length; i++) {
                path += " L " + points[i].x + "," + points[i].y;
            }
            labelX = (points[0].x + points[1].x) / 2;
            labelY = (points[0].y + points[1].y) / 2 - 10;
        } else {
            if (dx > dy) {
                const midX = (csx + ctx) / 2;
                const sx = csx + (ctx > csx ? sourceNode.width / 2 : -sourceNode.width / 2);
                const tx = ctx + (csx > ctx ? targetNode.width / 2 : -targetNode.width / 2);
                const sy = csy + offset;
                const ty = cty + offset;
                path = `M ${sx},${sy} L ${midX},${sy} L ${midX},${ty} L ${tx},${ty}`;
                labelX = midX;
                labelY = (sy + ty) / 2 - 10;
            } else {
                const midY = (csy + cty) / 2;
                const sy = csy + (cty > csy ? sourceNode.height / 2 : -sourceNode.height / 2);
                const ty = cty + (csy > cty ? targetNode.height / 2 : -targetNode.height / 2);
                const sx = csx + offset;
                const tx = ctx + offset;
                path = `M ${sx},${sy} L ${sx},${midY} L ${tx},${midY} L ${tx},${ty}`;
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

    // Anchors
    const allAnchorsData: any[] = [];
    linksRef.current.forEach((link) => {
        (link.anchorPoints || []).forEach((p, i) => {
            allAnchorsData.push({ link: link, point: p, index: i });
        });
    });

    const anchorSelection = anchorGroup.selectAll<SVGCircleElement, any>(".anchor-point")
        .data(allAnchorsData, d => d.link.id + "-" + d.index);

    anchorSelection.exit().remove();

    const anchorEnter = anchorSelection.enter()
        .append("circle")
        .attr("class", "anchor-point")
        .attr("r", 5)
        .attr("fill", "var(--vscode-terminal-ansiCyan)")
        .attr("stroke", "var(--vscode-editor-background)")
        .attr("stroke-width", 1)
        .style("cursor", "move")
        .on("contextmenu", (e, d) => {
            e.preventDefault();
            e.stopPropagation();
            d.link.anchorPoints.splice(d.index, 1);
            render();
            saveState();
        })
        .call(d3.drag<SVGCircleElement, any>()
            .on("start", (e) => { e.sourceEvent.stopPropagation(); })
            .on("drag", (e, d) => {
                if (!svgRef.current) return;
                const transform = d3.zoomTransform(svgRef.current);
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
  };

  const focusNode = (nodeId: string) => {
    const targetNode = nodesRef.current.find(n => n.id === nodeId);
    if (!targetNode || !svgRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const scale = 1.2;
    const x = -targetNode.x * scale + width / 2 - (targetNode.width / 2) * scale;
    const y = -targetNode.y * scale + height / 2 - (targetNode.height / 2) * scale;
    
    d3.select(svgRef.current).transition()
        .duration(750)
        .call(zoomRef.current.transform, d3.zoomIdentity.translate(x, y).scale(scale));
  };

  return (
    <svg ref={svgRef} id="diagram" className="w-full h-full">
      <defs></defs>
      <g ref={containerRef}></g>
    </svg>
  );
});

export default ErdCanvas;
