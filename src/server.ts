import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import {
  createYoga,
  maskError as maskUnexpectedError,
  type Plugin,
} from "graphql-yoga";
import { createContext, type GraphQLContext } from "./context.js";
import { schema } from "./schema.js";
import { maxDepthRule, REQUEST_TIMEOUT_MS } from "./security.js";

/** El limite de profundidad se aplica antes de ejecutar la operacion. */
const depthLimitPlugin: Plugin<GraphQLContext> = {
  onValidate({ addValidationRule }) {
    addValidationRule(maxDepthRule);
  },
};

export const yoga = createYoga<GraphQLContext>({
  schema,
  context: () => createContext(),
  graphqlEndpoint: "/graphql",
  graphiql: {
    title: "Biblioteca GraphQL",
  },
  logging: process.env.NODE_ENV !== "test",
  plugins: [depthLimitPlugin],
  maskedErrors: {
    errorMessage: "Ocurrio un error interno.",
    maskError(error, message, isDev) {
      const publicCodes = new Set([
        "BAD_USER_INPUT",
        "NOT_FOUND",
        "CONFLICT",
        "QUERY_TOO_DEEP",
      ]);
      const extensions =
        error instanceof Error &&
        "extensions" in error &&
        typeof error.extensions === "object" &&
        error.extensions !== null
          ? (error.extensions as Record<string, unknown>)
          : undefined;
      if (
        error instanceof Error &&
        extensions &&
        publicCodes.has(String(extensions.code))
      ) {
        return error;
      }
      return maskUnexpectedError(error, message, isDev);
    },
  },
});

export function startServer(port = Number(process.env.PORT ?? 4000)) {
  const server = createServer(yoga);
  // Tercer limite operativo: una solicitud no puede ocupar el servidor sin fin.
  server.requestTimeout = REQUEST_TIMEOUT_MS;
  server.headersTimeout = REQUEST_TIMEOUT_MS;
  server.listen(port, () => {
    console.info(`Biblioteca GraphQL disponible en http://localhost:${port}/graphql`);
  });
  return server;
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  startServer();
}
