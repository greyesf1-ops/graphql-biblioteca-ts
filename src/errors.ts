import { GraphQLError } from "graphql";
import type { ZodIssue } from "zod";

interface PublicIssue {
  field: string;
  message: string;
}

export function badUserInput(
  message: string,
  issues?: ZodIssue[],
): GraphQLError {
  const publicIssues: PublicIssue[] | undefined = issues?.map((issue) => ({
    field: issue.path.join(".") || "input",
    message: issue.message,
  }));

  return new GraphQLError(message, {
    extensions: {
      code: "BAD_USER_INPUT",
      ...(publicIssues ? { issues: publicIssues } : {}),
    },
  });
}

export function notFound(resource: string, id: string): GraphQLError {
  return new GraphQLError(`${resource} con id '${id}' no existe.`, {
    extensions: { code: "NOT_FOUND" },
  });
}

export function conflict(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: "CONFLICT" },
  });
}
