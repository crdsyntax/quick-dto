import { HttpCollection } from "../../../generators/http-tester.generator";

export function isValidHttpCollection(value: unknown): value is HttpCollection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    (candidate.type === "http" || candidate.type === "socket") &&
    typeof candidate.url === "string" &&
    typeof candidate.method === "string" &&
    typeof candidate.body === "string" &&
    Array.isArray(candidate.queryParams) &&
    Array.isArray(candidate.headers) &&
    typeof candidate.authType === "string" &&
    typeof candidate.authToken === "string" &&
    typeof candidate.basicUsername === "string" &&
    typeof candidate.basicPassword === "string"
  );
}

export function normalizeCollections(parsed: unknown): HttpCollection[] {
  if (Array.isArray(parsed)) {
    return parsed.filter(isValidHttpCollection);
  }

  if (isValidHttpCollection(parsed)) {
    return [parsed];
  }

  return [];
}

export function mergeCollections(
  currentCollections: HttpCollection[],
  incomingCollections: HttpCollection[]
): HttpCollection[] {
  const merged = [...currentCollections];

  incomingCollections.forEach((incomingCollection) => {
    const existsIndex = merged.findIndex(
      (collection) =>
        collection.name === incomingCollection.name &&
        collection.type === incomingCollection.type
    );

    if (existsIndex !== -1) {
      merged[existsIndex] = incomingCollection;
    } else {
      merged.push(incomingCollection);
    }
  });

  return merged;
}

export function filterCollectionsByType(
  collections: HttpCollection[],
  type: "http" | "socket"
): HttpCollection[] {
  return collections.filter((collection) => collection.type === type);
}
