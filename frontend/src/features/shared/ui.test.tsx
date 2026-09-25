import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Button, Input, MenuOption, Select, Surface } from './ui';
import { IconButton } from './IconButton';

it('does not submit a form through a secondary action but preserves explicit submit buttons', () => {
  const submit = vi.fn((event) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <Button>보조 동작</Button>
      <IconButton icon="save" type="submit">
        저장
      </IconButton>
    </form>,
  );
  fireEvent.click(screen.getByRole('button', { name: '보조 동작' }));
  expect(submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(submit).toHaveBeenCalledOnce();
});
it('preserves native form values, refs and fieldset disabled behavior through shared controls', () => {
  const ref = createRef<HTMLInputElement>();
  render(
    <form aria-label="입력">
      <Surface as="fieldset" disabled>
        <Input ref={ref} name="name" defaultValue="워크" />
        <Select name="group" defaultValue="a">
          <option value="a">그룹 A</option>
        </Select>
        <MenuOption>선택</MenuOption>
      </Surface>
    </form>,
  );
  expect(ref.current).toBe(screen.getByRole('textbox'));
  expect(ref.current).toBeDisabled();
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(screen.getByRole('button', { name: '선택' })).toBeDisabled();
  expect(Array.from(new FormData(screen.getByRole('form') as HTMLFormElement).entries())).toEqual(
    [],
  );
});
