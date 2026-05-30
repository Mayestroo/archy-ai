import Image from "next/image";
import Link from "next/link";
import logoImage from "@/public/logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  withText?: boolean;
  href?: string;
  className?: string;
}

export default function Logo({
  size = "md",
  withText = true,
  href = "/",
  className = "",
}: LogoProps) {
  const logo =
    size === "sm" ? "h-6 w-[74px]" : size === "lg" ? "h-9 w-[112px]" : "h-7 w-[88px]";
  const text = size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base";

  const content = (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`${logo} relative inline-flex overflow-hidden`}>
        <Image
          src={logoImage}
          alt={withText ? "Archy" : "Archy AI"}
          className="absolute left-1/2 top-1/2 h-auto w-full max-w-none -translate-x-1/2 -translate-y-1/2 scale-[3.05] dark:invert"
        />
      </span>
      {withText && (
        <span className={`${text} font-bold tracking-tight text-foreground`}>
          AI
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex items-center">
      {content}
    </Link>
  );
}
