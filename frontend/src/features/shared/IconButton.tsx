import { useTranslation } from 'react-i18next';
import { tr } from '../../i18n';
import {
  Children,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ComponentProps,
} from 'react';
import { ActionIcon } from './ActionIcon';
import { Button, type ButtonVariant } from './ui';

function textOf(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (isValidElement<{ children?: ReactNode; 'aria-hidden'?: boolean | 'true' }>(child)) {
        return child.props['aria-hidden'] ? '' : textOf(child.props.children);
      }
      return '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function IconButton({
  icon,
  children,
  className = '',
  variant = 'ghost',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ComponentProps<typeof ActionIcon>['name'];
  variant?: ButtonVariant;
}) {
  useTranslation();
  const label = props['aria-label'] || textOf(children);
  const busy = label.includes(tr('design-reference.saving'));
  return (
    <Button
      {...props}
      variant={variant}
      iconOnly
      className={`icon-button ${className}`}
      aria-label={label}
      title={props.title || label}
      aria-busy={props['aria-busy'] ?? (busy || undefined)}
    >
      <ActionIcon name={icon} />
    </Button>
  );
}
