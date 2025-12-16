import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import TagManager from '../TagManager';
import { tagsAPI } from '../../services/api';

// Mock the API module
vi.mock('../../services/api', () => ({
    tagsAPI: {
        list: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
    },
}));

describe('TagManager', () => {
    const mockTags = [
        { id: 1, name: 'Important', color: 'red' },
        { id: 2, name: 'Review', color: 'blue' },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        tagsAPI.list.mockResolvedValue({ data: mockTags });
    });

    test('renders tags from API', async () => {
        render(<TagManager />);

        // Should show loading initially
        // Note: The component shows a spinner div, we can look for that or just wait
        // expect(screen.getByRole('status')).toBeInTheDocument(); 

        await waitFor(() => {
            expect(screen.getByText('Important')).toBeInTheDocument();
            expect(screen.getByText('Review')).toBeInTheDocument();
        });
    });

    test('creates a new tag', async () => {
        const newTag = { id: 3, name: 'New Tag', color: 'green' };
        tagsAPI.create.mockResolvedValue({ data: newTag });

        render(<TagManager />);

        await waitFor(() => expect(screen.getByText('Important')).toBeInTheDocument());

        // Click create button
        fireEvent.click(screen.getByText('Create New Tag'));

        // Input name
        const input = screen.getByPlaceholderText(/e.g., Important/i);
        fireEvent.change(input, { target: { value: 'New Tag' } });

        // Select color (green)
        const greenBtn = screen.getByTitle('green');
        fireEvent.click(greenBtn);

        // Submit
        fireEvent.click(screen.getByText('Create Tag'));

        await waitFor(() => {
            expect(tagsAPI.create).toHaveBeenCalledWith({ name: 'New Tag', color: 'green' });
            expect(screen.getByText('New Tag')).toBeInTheDocument();
        });
    });
});
