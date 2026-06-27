import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "g14o",
    },
    links: [
      {
        text: "GitHub",
        url: "https://github.com/wuzgood98/g14o",
        external: true,
      },
    ],
  };
}
