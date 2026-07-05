import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
});

export function getPageImage(page: (typeof source)["$inferPage"]) {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `/og/${segments.join("/")}`,
  };
}
