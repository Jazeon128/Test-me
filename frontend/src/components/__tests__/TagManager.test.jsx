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
        get: vi.fn(),
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

test('lists and creates tags in its notebook and reloads when the notebook changes', async () => {
    tagsAPI.list.mockResolvedValue({ data: [] });
    tagsAPI.create.mockResolvedValue({ data: { id: 8, name: 'Local', notebook_id: 5, shared: false } });
    const { rerender } = render(<TagManager notebook_id={5} />);
    await screen.findByText('No tags yet. Create one below!');
    expect(tagsAPI.list).toHaveBeenCalledWith(5);
    fireEvent.click(screen.getByText('Create New Tag'));
    fireEvent.change(screen.getByPlaceholderText(/e.g., Important/i), { target: { value: 'Local' } });
    fireEvent.click(screen.getByText('Create Tag'));
    await screen.findByText('Local');
    expect(tagsAPI.create).toHaveBeenCalledWith({ name: 'Local', color: 'blue', notebook_id: 5 });
    rerender(<TagManager notebook_id={6} />);
    await waitFor(() => expect(tagsAPI.list).toHaveBeenCalledWith(6));
});

test('labels shared tags and requires an in-page confirmation with the fetched count', async () => {
    const tag = { id: 4, name: 'Global', color: 'blue', notebook_id: null, shared: true };
    tagsAPI.list.mockResolvedValue({ data: [tag] });
    tagsAPI.get.mockResolvedValue({ data: { ...tag, question_count: 17 } });
    tagsAPI.delete.mockResolvedValue({ data: { affected_questions: 17 } });
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<TagManager notebook_id={5} mode="manage" />);
    expect(await screen.findByText('Shared')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Global' }));
    expect(await screen.findByText('This tag is shared by every notebook. Remove it from 17 questions everywhere?')).toBeInTheDocument();
    expect(tagsAPI.get).toHaveBeenCalledWith(4);
    expect(tagsAPI.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tagsAPI.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Global' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag' }));
    await waitFor(() => expect(tagsAPI.delete).toHaveBeenCalledWith(4));
    await waitFor(() => expect(screen.queryByText('Global')).not.toBeInTheDocument());
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
});
