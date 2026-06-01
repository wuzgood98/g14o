import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "@g14o/core cache demo",
  description: "Verify cache behavior during next build and at runtime",
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
