import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
copyFileSync(
  new URL("../schema.graphql", import.meta.url),
  new URL("../dist/schema.graphql", import.meta.url),
);
