import Image from "next/image";

/** Cropped from the UTOPIA logotype — white glyphs, transparent ground. */
export const UTOPIA_WORDMARK = {
  src: "/brand/utopia-wordmark.png",
  width: 872,
  height: 285,
} as const;

type UtopiaWordmarkProps = {
  className?: string;
  priority?: boolean;
  sizes?: string;
  alt?: string;
};

export function UtopiaWordmark({
  className,
  priority,
  sizes,
  alt = "",
}: UtopiaWordmarkProps) {
  return (
    <Image
      src={UTOPIA_WORDMARK.src}
      alt={alt}
      width={UTOPIA_WORDMARK.width}
      height={UTOPIA_WORDMARK.height}
      priority={priority}
      sizes={sizes}
      draggable={false}
      className={className}
    />
  );
}
