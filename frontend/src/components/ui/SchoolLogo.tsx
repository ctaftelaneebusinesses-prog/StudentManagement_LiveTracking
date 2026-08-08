import { useState } from "react";
import { GraduationCap } from "lucide-react";

interface SchoolLogoProps {
  src?: string | null;
  /** sm = sidebars (32px), lg = profile page (64px) */
  size?: "sm" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<SchoolLogoProps["size"]>, string> = {
  sm: "h-8 w-8 rounded-lg",
  lg: "h-16 w-16 rounded-xl",
};

const ICON_SIZE: Record<NonNullable<SchoolLogoProps["size"]>, number> = {
  sm: 18,
  lg: 30,
};

/**
 * Renders the current school's logo, or a default placeholder (matching the
 * Admin Console's original brand icon) when no logo has been uploaded, or if
 * the stored URL fails to load.
 */
export function SchoolLogo({ src, size = "sm", className = "" }: SchoolLogoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;

  if (showImage) {
    return (
      <img
        src={src}
        alt="School logo"
        onError={() => setFailed(true)}
        className={`shrink-0 bg-white object-contain shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.08] ${SIZE_CLASSES[size]} ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-accent-500 to-accent-700 text-white shadow-sm ${SIZE_CLASSES[size]} ${className}`}
    >
      <GraduationCap size={ICON_SIZE[size]} strokeWidth={2} />
    </span>
  );
}
