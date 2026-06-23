import logoIcon from "@/assets/logo-icon.png";

interface LogoProps {
  className?: string;
}

/**
 * Caseway brand mark: a navy location pin enclosing gold-accented scales of
 * justice over a stylized map. Shipped as a transparent PNG so it can be
 * reused in the header, footer, admin, and as the favicon source.
 */
export function Logo({ className }: LogoProps) {
  return (
    <img src={logoIcon} alt="Caseway" className={className} draggable={false} />
  );
}
