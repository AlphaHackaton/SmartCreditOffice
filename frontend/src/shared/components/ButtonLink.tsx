import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';

const RouterLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(({ href, ...props }, ref) => <Link to={href ?? '/client'} {...props} ref={ref} />);
export function ButtonLink({ to, children }: { to: string; children: ReactNode }) {
  return <ButtonDesktop view="primary" size={48} Component={RouterLink} href={to}>{children}</ButtonDesktop>;
}
