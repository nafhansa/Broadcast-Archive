export function Logo({ variant = "original", height = 28 }: { variant?: "original" | "green"; height?: number }) {
  const src = variant === "green" ? "/logo-mark-green.svg" : "/logo-mark.svg";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" height={height} width={height} style={{ height, width: height }} />;
}
