import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "@g14o/paystack demo",
  description:
    "Interactive Better Auth + Paystack plugin demo with env validation",
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
