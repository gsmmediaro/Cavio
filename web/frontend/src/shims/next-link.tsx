import * as React from "react";
import { Link as RouterLink } from "react-router-dom";

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  replace?: boolean;
  prefetch?: boolean;
  scroll?: boolean;
};

/** Vite shim for next/link — react-router Link for internal, <a> for external. */
export default function Link({
  href,
  children,
  replace,
  prefetch: _prefetch,
  scroll: _scroll,
  ...rest
}: LinkProps) {
  const external =
    /^https?:\/\//i.test(href) ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    rest.target === "_blank";

  if (external) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink to={href} replace={replace} {...rest}>
      {children}
    </RouterLink>
  );
}
