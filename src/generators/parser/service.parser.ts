import { ServiceMethodInfo, ServiceParamInfo } from "../../types/types";


export function parseServiceMethods(serviceContent: string): ServiceMethodInfo[] {
  const methods: ServiceMethodInfo[] = [];
  const methodRegex = /async\s+(\w+)\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)>/g;
  let match;

  while ((match = methodRegex.exec(serviceContent)) !== null) {
    const name = match[1];
    const paramsStr = match[2];
    const returnType = match[3].trim();

    if (!["create", "findAll", "findOne", "update", "remove"].includes(name)) continue;

    const params: ServiceParamInfo[] = [];
    if (paramsStr.trim()) {
      paramsStr.split(",").forEach(p => {
        const paramMatch = p.trim().match(/^(\w+)(\??)\s*:\s*(.+)$/);
        if (paramMatch) {
          const [, paramName, optional, type] = paramMatch;
          params.push({
            name: paramName,
            type: type.trim(),
            isOptional: optional === "?",
          });
        }
      });
    }

    methods.push({ name, params, returnType });
  }

  return methods;
}