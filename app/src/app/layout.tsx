import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiDAR Training Portal",
  description: "3D LiDAR annotation training, assessment and certification",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
