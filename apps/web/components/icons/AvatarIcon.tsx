const AVATAR_COUNT = 6;

function getAvatarIndex(address: string): number {
  const hex = address.replace(/^0x/, "").slice(0, 8);
  const hash = parseInt(hex, 16);
  return (Number.isFinite(hash) ? hash % AVATAR_COUNT : 0) + 1;
}

interface AvatarIconProps {
  address: string | undefined;
  size?: number;
  className?: string;
}

export default function AvatarIcon({ address, size = 40, className }: AvatarIconProps) {
  if (!address) {
    return (
      <div
        className={`shrink-0 rounded-full bg-primary ${className ?? ""}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  const idx = getAvatarIndex(address);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/images/avatars/avatar-${idx}.svg`}
      alt=""
      className={`shrink-0 block ${className ?? ""}`}
      style={{ width: size, height: size }}
    />
  );
}
