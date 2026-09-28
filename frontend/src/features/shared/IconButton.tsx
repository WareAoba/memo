import { Children, isValidElement, type ReactNode, type ComponentProps } from 'react';
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
}: ComponentProps<'button'> & {
  icon: ComponentProps<typeof ActionIcon>['name'];
  variant?: ButtonVariant;
}) {
  const label = props['aria-label'] || textOf(children);
  return (
    <Button
      {...props}
      variant={variant}
      iconOnly
      className={`icon-button ${className}`}
      aria-label={label}
      title={props.title || label}
    >
      <ActionIcon name={icon} />
    </Button>
  );
}
