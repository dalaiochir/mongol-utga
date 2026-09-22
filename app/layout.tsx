import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Утга — Монгол хэл ба AI",
  description:
    "Монгол хэллэг, ёгтлол, ахуйн утгыг хиймэл оюун хэрхэн ойлгож байгааг судлах лаборатори.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
