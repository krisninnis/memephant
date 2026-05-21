import { useCallback, useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useProjectStore } from '../../store/projectStore';
import { createProject } from '../../services/tauriActions';
import { searchProjectMemory } from '../../utils/searchProjectMemory';
import './CommandPalette.css';

interface PaletteAction {
  id: string;
  label: string;
  icon: string;
  run: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const projects = useProjectStore((s) => s.projects);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setCurrentView = useProjectStore((s) => s.setCurrentView);
  const setSettingsTab = useProjectStore((s) => s.setSettingsTab);
  const showToast = useProjectStore((s) => s.showToast);
  const cloudUser = useProjectStore((s) => s.cloudUser);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    function onOpenSearch() {
      setOpen(true);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('memephant:open-search', onOpenSearch);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('memephant:open-search', onOpenSearch);
    };
  }, []);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const actions: PaletteAction[] = [
    {
      id: 'new-project',
      label: 'New project',
      icon: '+',
      run: async () => {
        close();
        const name = window.prompt('Project name:');
        if (name?.trim()) await createProject(name.trim());
      },
    },
    {
      id: 'goto-settings-general',
      label: 'Settings - General',
      icon: 'G',
      run: () => { close(); setSettingsTab('general'); setCurrentView('settings'); },
    },
    {
      id: 'goto-settings-sync',
      label: 'Settings - Cloud Backup',
      icon: 'C',
      run: () => { close(); setSettingsTab('sync'); setCurrentView('settings'); },
    },
    {
      id: 'goto-memory-vault',
      label: 'Open Memory Vault',
      icon: 'V',
      run: () => { close(); setCurrentView('memory-vault'); },
    },
    {
      id: 'goto-settings-privacy',
      label: 'Settings - Privacy',
      icon: 'P',
      run: () => { close(); setSettingsTab('privacy'); setCurrentView('settings'); },
    },
    {
      id: 'goto-settings-platforms',
      label: 'Settings - AI Platforms',
      icon: 'AI',
      run: () => { close(); setSettingsTab('platforms'); setCurrentView('settings'); },
    },
    {
      id: 'goto-settings-about',
      label: 'Settings - About',
      icon: 'i',
      run: () => { close(); setSettingsTab('about'); setCurrentView('settings'); },
    },
    ...(cloudUser
      ? [
          {
            id: 'sync-now',
            label: 'Sync with cloud now',
            icon: 'S',
            run: () => {
              close();
              setSettingsTab('sync');
              setCurrentView('settings');
              showToast('Opening Cloud Backup - click Sync now.');
            },
          },
        ]
      : []),
  ];

  const trimmedSearch = search.trim();
  const searchResults = searchProjectMemory(projects, trimmedSearch, 18);
  const filteredActions = trimmedSearch
    ? actions.filter((action) =>
        action.label.toLocaleLowerCase().includes(trimmedSearch.toLocaleLowerCase()))
    : actions;

  if (!open) return null;

  return (
    <div className="cmd-overlay" onClick={close} role="dialog" aria-modal="true" aria-label="Search Memephant">
      <div
        className="cmd-wrapper"
        onClick={(event) => event.stopPropagation()}
        role="presentation"
      >
        <Command label="Search Memephant" shouldFilter={false} loop>
          <div className="cmd-input-row">
            <span className="cmd-input-icon" aria-hidden="true">⌕</span>
            <Command.Input
              className="cmd-input"
              aria-label="Search Memephant"
              placeholder="Search projects, decisions, files..."
              value={search}
              onValueChange={setSearch}
              autoFocus
            />
            <kbd className="cmd-esc-hint" onClick={close}>esc</kbd>
          </div>

          <Command.List className="cmd-list">
            <Command.Empty className="cmd-empty">
              No local project memory matched &ldquo;{search}&rdquo;.
            </Command.Empty>

            {trimmedSearch && searchResults.length > 0 && (
              <Command.Group heading="Project memory" className="cmd-group">
                {searchResults.map((result) => (
                  <Command.Item
                    key={result.id}
                    value={`${result.projectName} ${result.section} ${result.snippet}`}
                    className="cmd-item"
                    onSelect={() => {
                      setActiveProject(result.projectId);
                      setCurrentView('projects');
                      close();
                    }}
                  >
                    <span className="cmd-item-icon" aria-hidden="true">⌕</span>
                    <span className="cmd-item-main">
                      <span className="cmd-item-label">{result.projectName}</span>
                      <span className="cmd-item-hint">{result.snippet}</span>
                    </span>
                    <span className="cmd-item-section">{result.section}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!trimmedSearch && projects.length > 0 && (
              <Command.Group heading="Projects" className="cmd-group">
                {projects.map((project) => (
                  <Command.Item
                    key={project.id}
                    value={project.name}
                    className="cmd-item"
                    onSelect={() => {
                      setActiveProject(project.id);
                      setCurrentView('projects');
                      close();
                    }}
                  >
                    <span className="cmd-item-icon" aria-hidden="true">P</span>
                    <span className="cmd-item-main">
                      <span className="cmd-item-label">{project.name}</span>
                      {project.currentState && (
                        <span className="cmd-item-hint">
                          {project.currentState.slice(0, 72)}
                          {project.currentState.length > 72 ? '...' : ''}
                        </span>
                      )}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {filteredActions.length > 0 && (
              <Command.Group heading="Actions" className="cmd-group">
                {filteredActions.map((action) => (
                  <Command.Item
                    key={action.id}
                    value={action.label}
                    className="cmd-item"
                    onSelect={() => void action.run()}
                  >
                    <span className="cmd-item-icon" aria-hidden="true">{action.icon}</span>
                    <span className="cmd-item-label">{action.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

export default CommandPalette;
