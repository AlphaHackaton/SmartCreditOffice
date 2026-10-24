import { ButtonDesktop } from '@alfalab/core-components-button/esm/desktop';
import { TitleDesktop, Text } from '@alfalab/core-components-typography/esm';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Link } from 'react-router-dom';

const RouterLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'>>(
  ({ href, ...props }, ref) => <Link to={href ?? '/client'} {...props} ref={ref} />,
);

export function NotFoundPage() {
  return <section className="not-found">
    <p className="eyebrow">404</p>
    <TitleDesktop tag="h1" view="large" font="system">Страница не найдена</TitleDesktop>
    <Text tag="p" view="primary-large">Возможно, адрес изменился. Вернитесь в кабинет, чтобы продолжить.</Text>
    <ButtonDesktop view="primary" size={48} Component={RouterLink} href="/client">В клиентский кабинет</ButtonDesktop>
  </section>;
}
