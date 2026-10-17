import Image from "next/image";
import { cn } from "~/lib/utils";

export type CelisLogoVariant = "primary" | "reversed" | "mark-only" | "auto";
export interface CelisLogoProps {
  variant?: CelisLogoVariant;
  size?: number;
  className?: string;
  badge?: boolean;
}

/** Shared Celis logo artwork used throughout the application. */
export function CelisLogo({ variant = "auto", size = 48, className, badge = false }: CelisLogoProps) {
  const markOnly = variant === "mark-only";
  const height = markOnly ? size : size * 1.5;
  const width = markOnly ? size : height * (4 / 3);

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", badge && "rounded-md", className)}
      style={{ width, height }}
      role="img"
      aria-label="Celis"
    >
      <Image
        src="/branding/celis-logo.png"
        alt=""
        width={419}
        height={330}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export default CelisLogo;
