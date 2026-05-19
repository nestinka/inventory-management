// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockBadge } from '@/components/ui/stock-badge';

describe('StockBadge', () => {
  it('renders HEALTHY state with correct aria-label', () => {
    render(<StockBadge state="HEALTHY" stock={12} />);
    expect(screen.getByLabelText('Healthy stock: 12')).toBeInTheDocument();
  });

  it('renders LOW state', () => {
    render(<StockBadge state="LOW" stock={2} />);
    expect(screen.getByLabelText('Low stock: 2')).toBeInTheDocument();
  });

  it('renders OUT state', () => {
    render(<StockBadge state="OUT" stock={0} />);
    expect(screen.getByLabelText('Out stock: 0')).toBeInTheDocument();
  });

  it('includes screen reader text for colour-blind users', () => {
    render(<StockBadge state="LOW" stock={3} />);
    expect(screen.getByText('(Low)')).toBeInTheDocument();
  });
});
