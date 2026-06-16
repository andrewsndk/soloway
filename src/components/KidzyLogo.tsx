import { cn } from "@/lib/utils";

import logoImg from "@/assets/l.png";

type KidzyLogoProps = {
  className?: string;
  /** Тільки значок без тексту */
  iconOnly?: boolean;
  /** Футер: світлий текст на темному тлі */
  onDark?: boolean;
};

export function KidzyLogo({ className, iconOnly = false, onDark = false }: KidzyLogoProps) {
  return (
    <span className="inline-flex items-center">
      <img
        src={logoImg}
        alt="SoloWay"
        className={cn("w-auto object-contain", className)}
        loading="eager"
      />
    </span>
  );
}
