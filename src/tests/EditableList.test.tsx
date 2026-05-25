import { fireEvent, render, screen } from '@testing-library/react';
import { EditableList } from '../components/Editor/EditableList';

describe('EditableList collapsible selected items', () => {
  it('collapses selected files behind a summary and keeps editing actions available', () => {
    const onChange = jest.fn();
    const items = ['src/App.tsx', 'src/components/Editor/ProjectEditor.tsx'];

    render(
      <EditableList
        label="Important Files & Assets"
        items={items}
        onChange={onChange}
        placeholder="Add a file or asset path..."
        collapsibleSelectedItems
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Show selected files ▾' });
    expect(screen.getByText('2 files selected')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByDisplayValue('src/App.tsx')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a file or asset path...')).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveTextContent('Hide selected files ▴');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByDisplayValue('src/App.tsx')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove item' })[0]);
    expect(onChange).toHaveBeenCalledWith(['src/components/Editor/ProjectEditor.tsx']);

    fireEvent.change(screen.getByPlaceholderText('Add a file or asset path...'), {
      target: { value: 'README.md' },
    });
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));

    expect(onChange).toHaveBeenCalledWith([
      'src/App.tsx',
      'src/components/Editor/ProjectEditor.tsx',
      'README.md',
    ]);
  });
});
