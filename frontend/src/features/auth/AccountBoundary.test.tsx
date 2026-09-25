import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountBoundary } from './AccountBoundary';
import { getAccount } from '../../api/auth';
import { ApiError } from '../../api/client';
vi.mock('../../api/auth', () => ({ getAccount: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
describe('account bootstrap', () => {
  it('does not mount private data before resolving the account', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof getAccount>>) => void;
    vi.mocked(getAccount).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const child = vi.fn((account) => <p>{account.display_name}</p>);
    render(<AccountBoundary>{child}</AccountBoundary>);
    expect(child).not.toHaveBeenCalled();
    resolve({ id: 'owner', display_name: '테스트 계정', email: null });
    expect(await screen.findByText('테스트 계정')).toBeInTheDocument();
  });
  it('keeps private data unmounted after 401 and allows retry', async () => {
    vi.mocked(getAccount)
      .mockRejectedValueOnce(new ApiError('Auth.signInRequired', 401))
      .mockResolvedValueOnce({ id: 'owner', display_name: '테스트 계정', email: null });
    const child = vi.fn((account) => <p>{account.display_name}</p>);
    render(<AccountBoundary>{child}</AccountBoundary>);
    expect(await screen.findByRole('alert')).toHaveTextContent('로그인이 필요합니다');
    expect(child).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('테스트 계정')).toBeInTheDocument();
  });
});
