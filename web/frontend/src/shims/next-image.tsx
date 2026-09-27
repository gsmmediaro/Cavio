import * as React from "react";

type ImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  priority?: boolean;
  unoptimized?: boolean;
};

/** Vite shim for next/image — plain <img>. */
export default function Image({
  src,
  alt,
  width,
  height,
  fill,
  className,
  style,
  priority: _priority,
  unoptimized: _unoptimized,
  ...rest
}: ImgProps) {
  const fillStyle: React.CSSProperties | undefined = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }
    : style;
  return (
    <img
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      className={className}
      style={fillStyle}
      {...rest}
    />
  );
}
