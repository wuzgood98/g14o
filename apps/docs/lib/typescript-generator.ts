import {
  createFileSystemGeneratorCache,
  createGenerator,
  type Generator,
} from "fumadocs-typescript";

export const typeScriptGenerator: Generator = createGenerator({
  cache: createFileSystemGeneratorCache(".next/fumadocs-typescript"),
});
