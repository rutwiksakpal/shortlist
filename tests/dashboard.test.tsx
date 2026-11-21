import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from '../src/pages/DashboardPage';
import { UiHost } from '../src/components/UiHost';
import { useStore } from '../src/store/useStore';

describe('Dashboard (React Testing Library)', () => {
  it('lists seeded resumes, filters by search and creates a new resume', async () => {
    const user = userEvent.setup();
    render(
      <>
        <DashboardPage />
        <UiHost />
      </>,
    );
    expect(screen.getByRole('link', { name: 'Web Developer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Software Developer' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search resumes'), 'software');
    expect(screen.queryByRole('link', { name: 'Web Developer' })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search resumes'));

    await user.click(screen.getByRole('button', { name: 'New resume' }));
    await user.click(screen.getByRole('button', { name: 'Create resume' }));
    expect(await screen.findByText('Give this resume a name')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Resume name'), 'Shopify Developer');
    await user.click(screen.getByRole('button', { name: 'Create resume' }));
    expect(useStore.getState().variants.map((v) => v.name)).toContain('Shopify Developer');
    expect(window.location.hash).toMatch(/^#\/resume\/var_/);
  });
});
