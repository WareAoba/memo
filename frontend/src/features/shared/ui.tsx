import type { ComponentProps, HTMLAttributes } from 'react';
import { createElement } from 'react';

export type ButtonVariant = 'secondary' | 'primary' | 'ghost' | 'danger' | 'plain' | 'option';
type ButtonStyle = { variant?: ButtonVariant; iconOnly?: boolean };
const classes = (...values: (string | undefined | false)[]) => values.filter(Boolean).join(' ');

/** Use plain only for structural controls (calendar cells, clock handles, card rows). */
export function Button({
  variant = 'secondary',
  iconOnly,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & ButtonStyle) {
  return (
    <button
      {...props}
      type={type}
      data-variant={variant}
      className={classes('ui-button', iconOnly && 'ui-icon-button', className)}
    />
  );
}

export function ButtonLink({
  variant = 'secondary',
  iconOnly,
  className,
  ...props
}: ComponentProps<'a'> & ButtonStyle) {
  return (
    <a
      {...props}
      data-variant={variant}
      className={classes('button ui-button', iconOnly && 'ui-icon-button', className)}
    />
  );
}

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      {...props}
      type={type}
      className={classes(
        type === 'checkbox' || type === 'radio' ? 'ui-check' : 'ui-input',
        className,
      )}
    />
  );
}
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={classes('ui-input', className)} />;
}
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select {...props} className={classes('ui-input ui-select', className)} />;
}

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article' | 'fieldset';
  tone?: 'default' | 'soft' | 'accent' | 'danger';
  padding?: 'none' | 'compact' | 'normal';
  disabled?: boolean;
};
export function Surface({
  as = 'div',
  tone = 'default',
  padding = 'normal',
  className,
  ...props
}: SurfaceProps) {
  return createElement(as, {
    ...props,
    'data-tone': tone,
    'data-padding': padding,
    className: classes('ui-surface', className),
  });
}
export function CardButton({ className, ...props }: ComponentProps<'button'>) {
  return (
    <Button
      {...props}
      variant="plain"
      className={classes('ui-surface ui-card-button', className)}
    />
  );
}
export function PageHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={classes('ui-page-header', className)} />;
}

/** Positioning and combobox keyboard behavior belong to the caller; appearance is shared. */
export function MenuSurface({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={classes('ui-menu', className)} />;
}
export function MenuOption({ className, ...props }: ComponentProps<'button'>) {
  return <Button {...props} variant="option" className={classes('ui-menu-option', className)} />;
}
