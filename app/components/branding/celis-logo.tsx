import Image from "next/image";
import { cn } from "~/lib/utils";

export type CelisLogoVariant = "primary" | "reversed" | "mark-only" | "auto";
export interface CelisLogoProps {
  variant?: CelisLogoVariant;
  size?: number;
  className?: string;
  badge?: boolean;
}

/** Shared branding using the approved artwork in logo-assets/new. */
export function CelisLogo({ variant = "auto", size = 48, className, badge = false }: CelisLogoProps) {
  const markOnly = variant === "mark-only";
  const adaptive = variant === "auto" || variant === "primary";
  const height = markOnly ? size : size * 1.5;
  const width = markOnly ? size : height * (4 / 3);
  const imageClass = "h-full w-full object-contain";
  const source = markOnly ? "celis-mark-on-white.png" : variant === "reversed" ? "celis-logo-on-navy.png" : "celis-logo-on-white.png";

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", badge && "rounded-md", className)}
      style={{ width, height }}
      role="img"
      aria-label="Celis"
    >
      <Image
        src={`/branding/${source}`}
        alt=""
        width={markOnly ? 256 : 800}
        height={markOnly ? 256 : 600}
        className={cn(imageClass, adaptive && "dark:hidden")}
      />
      {adaptive && (
        <Image
          src="/branding/celis-logo-on-navy.png"
          alt=""
          width={800}
          height={600}
          className={cn(imageClass, "hidden dark:block")}
        />
      )}
    </span>
  );
}

export default CelisLogo;
