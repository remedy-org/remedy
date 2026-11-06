import type { SVGProps } from "react";

// 16px line icons on a 16 grid, stroke = currentColor. Decorative by default: pair them with a word.
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

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 8.5l3 3 6-7" />
  </Icon>
);

export const CrossIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </Icon>
);

// Held for a person: a pause.
export const HoldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 4.5v7M10 4.5v7" />
  </Icon>
);

// Blocked before the model: a barred circle.
export const BlockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.25" />
    <path d="M4.3 11.7l7.4-7.4" />
  </Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 2.75l5.75 10H2.25z" />
    <path d="M8 6.75v2.5M8 11.25v.01" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8h9.5M9 4.5L12.5 8 9 11.5" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="5.25" />
    <path d="M8 5.25V8l1.75 1.25" />
  </Icon>
);
