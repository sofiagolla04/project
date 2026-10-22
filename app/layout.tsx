import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Host Upgrade Planner",
  description: "Turn guest feedback into practical property improvements.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
