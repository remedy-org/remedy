import type { SVGProps } from "react";

// Claim-flow line icons on the shared 16 grid (see components/ui/icons). Decorative: always paired with words.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.75 5.25h2.5l1.25-1.75h3l1.25 1.75h2.5v7.25H2.75z" />
    <circle cx="8" cy="8.75" r="2.25" />
  </Icon>
);

export const EyeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M1.75 8s2.25-4.25 6.25-4.25S14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z" />
    <circle cx="8" cy="8" r="1.75" />
  </Icon>
);

export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4.5" y="1.75" width="7" height="12.5" rx="1.5" />
    <path d="M7.25 11.75h1.5" />
  </Icon>
);

export const PayoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="1.75" y="4" width="12.5" height="8" rx="1" />
    <circle cx="8" cy="8" r="1.75" />
    <path d="M4.25 8h.01M11.75 8h.01" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 8h11" strokeDasharray="1.5 2" />
  </Icon>
);
