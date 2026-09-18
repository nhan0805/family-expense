import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

function Harness() {
  return (
    <>
      <button type="button">Open dialog</button>
      <Dialog open onClose={() => undefined} title="Confirm" description="Review this action">
        <button type="button" data-dialog-autofocus>Cancel</button>
        <button type="button">Confirm</button>
      </Dialog>
    </>
  );
}

describe('Dialog primitive', () => {
  afterEach(cleanup);

  it('announces title/description and focuses the preferred control', async () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Confirm' });
    expect(dialog).toHaveAccessibleDescription('Review this action');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
  });

  it('keeps focus inside and closes from Escape', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Confirm">
        <button type="button">First</button>
        <button type="button">Last</button>
      </Dialog>,
    );
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
