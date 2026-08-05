import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "@g14o/events demo",
  description:
    "Interactive demo for schema validation, hooks, middleware, and namespaces",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
