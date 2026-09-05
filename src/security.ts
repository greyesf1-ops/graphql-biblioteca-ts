import {
  GraphQLError,
  Kind,
  type ASTVisitor,
  type SelectionSetNode,
  type ValidationContext,
} from "graphql";

/** Maximo de elementos que una lista puede devolver en una sola respuesta. */
export const MAX_PAGE_SIZE = 20;

/** Profundidad maxima de anidamiento aceptada en una operacion. */
export const MAX_QUERY_DEPTH = 8;

/** Tiempo maximo que el servidor mantiene abierta una solicitud HTTP. */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Calcula el nivel de anidamiento mas profundo del documento. Los fragmentos se
 * expanden y se marcan como visitados para que un ciclo no provoque recursion
 * infinita durante la propia validacion.
 */
function measureDepth(
  selectionSet: SelectionSetNode,
  context: ValidationContext,
  visitedFragments: Set<string>,
): number {
  let deepest = 0;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const childDepth = selection.selectionSet
        ? measureDepth(selection.selectionSet, context, visitedFragments)
        : 0;
      deepest = Math.max(deepest, 1 + childDepth);
      continue;
    }

    if (selection.kind === Kind.INLINE_FRAGMENT) {
      deepest = Math.max(
        deepest,
        measureDepth(selection.selectionSet, context, visitedFragments),
      );
      continue;
    }

    const fragmentName = selection.name.value;
    if (visitedFragments.has(fragmentName)) {
      continue;
    }
    const fragment = context.getFragment(fragmentName);
    if (!fragment) {
      continue;
    }

    visitedFragments.add(fragmentName);
    deepest = Math.max(
      deepest,
      measureDepth(fragment.selectionSet, context, visitedFragments),
    );
    visitedFragments.delete(fragmentName);
  }

  return deepest;
}

/** La introspeccion es legitimamente profunda y la usa GraphiQL para documentar. */
function isIntrospectionOnly(selectionSet: SelectionSetNode): boolean {
  return selectionSet.selections.every(
    (selection) =>
      selection.kind === Kind.FIELD && selection.name.value.startsWith("__"),
  );
}

/**
 * Regla de validacion que rechaza operaciones demasiado anidadas antes de
 * ejecutarlas. Sin este limite, `Book.author` y `Author.books` permiten
 * construir un documento que se recorre a si mismo indefinidamente.
 */
export function maxDepthRule(context: ValidationContext): ASTVisitor {
  return {
    OperationDefinition(node) {
      if (isIntrospectionOnly(node.selectionSet)) {
        return;
      }

      const depth = measureDepth(node.selectionSet, context, new Set());
      if (depth <= MAX_QUERY_DEPTH) {
        return;
      }

      context.reportError(
        new GraphQLError(
          `La operacion alcanza ${depth} niveles y el maximo permitido es ${MAX_QUERY_DEPTH}.`,
          {
            nodes: [node],
            extensions: {
              code: "QUERY_TOO_DEEP",
              maxDepth: MAX_QUERY_DEPTH,
              actualDepth: depth,
            },
          },
        ),
      );
    },
  };
}
