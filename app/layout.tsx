import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AskElaine",
  description: "Chat with Elaine's AI portfolio assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col">{children}</body>
    </html>
  );
}
