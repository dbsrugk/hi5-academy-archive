import type { ImgHTMLAttributes } from "react";
type Props = ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string; fill?: boolean; priority?: boolean; unoptimized?: boolean; sizes?: string; quality?: number; placeholder?: string };
export default function Image({ fill, priority, unoptimized: _u, quality: _q, placeholder: _p, style, ...rest }: Props) {
  const fillStyle = fill ? { position: "absolute" as const, inset: 0, width: "100%", height: "100%" } : undefined;
  return <img loading={priority ? "eager" : "lazy"} decoding="async" style={{ ...fillStyle, ...style }} {...rest} />;
}
