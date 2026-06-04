import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "@g14o/env-core demo",
  description: "Zod, Valibot, and ArkType environment validation showcase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
