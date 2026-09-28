import type { ComponentProps, HTMLAttributes } from 'react';
import { createElement, useLayoutEffect, useRef } from 'react';
import { enterPopup } from './popupMotion';
import { ActionIcon } from './ActionIcon';

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
export function AutoTextarea({ value, style, ...props }: ComponentProps<'textarea'>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      element.style.height = 'auto';
      element.style.height = `${element.scrollHeight + 2}px`;
    };
    resize();
    let width = element.getBoundingClientRect().width;
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            const nextWidth = element.getBoundingClientRect().width;
            if (nextWidth !== width) {
              width = nextWidth;
              resize();
            }
          });
    if (element.parentElement) observer?.observe(element.parentElement);
    return () => observer?.disconnect();
  }, [value]);
  return (
    <Textarea
      {...props}
      ref={ref}
      value={value}
      style={{ ...style, resize: 'none', overflow: 'hidden' }}
    />
  );
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
export function MenuSurface({ className, ref, ...props }: ComponentProps<'div'>) {
  const local = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let disposed = false;
    let animation: Animation | undefined;
    queueMicrotask(() => {
      if (!disposed && local.current) animation = enterPopup(local.current);
    });
    return () => {
      disposed = true;
      animation?.cancel();
    };
  }, []);
  return (
    <div
      {...props}
      ref={(element) => {
        local.current = element;
        if (typeof ref === 'function') return ref(element);
        if (ref) ref.current = element;
      }}
      className={classes('ui-menu', className)}
    />
  );
}
export function MenuOption({ className, ...props }: ComponentProps<'button'>) {
  return <Button {...props} variant="option" className={classes('ui-menu-option', className)} />;
}

/** Track switcher is the canonical disclosure glyph and motion. */
export function DisclosureIcon() {
  return <ActionIcon name="down" className="ui-disclosure-icon" />;
}

/** Preserve native details keyboard behavior and open state. */
export function DisclosureSummary({ children, className, ...props }: ComponentProps<'summary'>) {
  return (
    <summary {...props} className={classes('ui-disclosure-summary', className)}>
      {children}
      <DisclosureIcon />
    </summary>
  );
}

/** Native checkbox semantics, switch appearance, and inherited fieldset disabling. */
export function ToggleSwitch({
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'role'>) {
  return (
    <span className={classes('ui-switch', className)}>
      <input {...props} type="checkbox" role="switch" />
      <span className="ui-switch-track" aria-hidden="true">
        <span />
      </span>
    </span>
  );
}
