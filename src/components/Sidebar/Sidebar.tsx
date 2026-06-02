import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useProjectStore } from "../../store/projectStore";
import {
  isDesktopApp,
  createProject,
  createProjectFromFolder,
  createProjectFromTemplate,
  importProjectFromFile,
  deleteProject,
} from "../../services/tauriActions";
import { PROJECT_TEMPLATES } from "../../utils/projectTemplates";
import type { ProjectTemplate } from "../../utils/projectTemplates";
import {
  ensureValidPlatformId,
  getPlatformConfig,
} from "../../utils/platformRegistry";
import ProjectCard from "./ProjectCard";
import ConfirmDialog from "../Shared/ConfirmDialog";
import LaunchpadWizard from "../Launchpad/LaunchpadWizard";
import BlueprintWizard from "../Blueprint/BlueprintWizard";
import { PassportBadgeButton } from "../../features/passport/components/PassportBadgeButton";

interface SidebarProps {
  onNavigate?: () => void;
}

type CreateMode = "none" | "name" | "templates" | "template-name";

function getInitials(email: string) {
  const name = email.split("@")[0] || "U";
  const parts = name.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2)
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getDisplayName(email: string) {
  const raw = email.split("@")[0] || "User";
  return raw
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const Sidebar = ({ onNavigate }: SidebarProps) => {
  const projects = useProjectStore((s) => s.projects);
  const cloudUser = useProjectStore((s) => s.cloudUser);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const currentView = useProjectStore((s) => s.currentView);
  const targetPlatform = useProjectStore((s) => s.targetPlatform);
  const settings = useProjectStore((s) => s.settings);

  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const setCurrentView = useProjectStore((s) => s.setCurrentView);
  const setSettingsTab = useProjectStore((s) => s.setSettingsTab);

  const [createMode, setCreateMode] = useState<CreateMode>("none");
  const [showLaunchpad, setShowLaunchpad] = useState(false);
  const [showBlueprint, setShowBlueprint] = useState(false);
  const [newName, setNewName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showDesktopPrompt, setShowDesktopPrompt] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<ProjectTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [cloudNudgeDismissed, setCloudNudgeDismissed] = useState(
    () => localStorage.getItem("mph_cloud_nudge_dismissed") === "1",
  );

  const nameInputRef = useRef<HTMLInputElement>(null);
  const templateNameRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const desktopApp = isDesktopApp();
  const selectedPlatformId = ensureValidPlatformId(
    targetPlatform,
    settings.platforms,
    settings.general.defaultPlatform,
  );
  const selectedPlatform = getPlatformConfig(
    selectedPlatformId,
    settings.platforms,
  );

  useEffect(() => {
    if (desktopApp) return;

    const dismissed = sessionStorage.getItem("mph_desktop_prompt_seen") === "1";
    if (dismissed) return;

    const showTimer = window.setTimeout(() => {
      setShowDesktopPrompt(true);
    }, 700);

    const hideTimer = window.setTimeout(() => {
      setShowDesktopPrompt(false);
      sessionStorage.setItem("mph_desktop_prompt_seen", "1");
    }, 5200);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [desktopApp]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(
      () => setDebouncedSearch(value),
      120,
    );
  }, []);

  const filteredProjects = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.summary?.toLowerCase().includes(q) ||
        p.currentState?.toLowerCase().includes(q) ||
        p.goals?.some((g) => g.toLowerCase().includes(q)) ||
        p.nextSteps?.some((s) => s.toLowerCase().includes(q)) ||
        p.decisions?.some((d) =>
          (typeof d === "string" ? d : d.decision).toLowerCase().includes(q),
        ),
    );
  }, [projects, debouncedSearch]);
  const visibleProjects = showAllProjects
    ? filteredProjects
    : filteredProjects.slice(0, 4);

  const hiddenProjectCount = Math.max(
    filteredProjects.length - visibleProjects.length,
    0,
  );
  const resetCreate = () => {
    setCreateMode("none");
    setNewName("");
    setTemplateName("");
    setSelectedTemplate(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createProject(newName);
    resetCreate();
    onNavigate?.();
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !templateName.trim()) return;
    await createProjectFromTemplate(selectedTemplate, templateName);
    resetCreate();
    onNavigate?.();
  };

  const handleNewProjectClick = () => {
    resetCreate();
    setShowLaunchpad(true);
  };

  const handleImportClick = () => {
    importFileRef.current?.click();

    if (!desktopApp && !showDesktopPrompt) {
      setShowDesktopPrompt(true);

      window.setTimeout(() => {
        setShowDesktopPrompt(false);
      }, 4000);
    }
  };

  const handleImportFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await importProjectFromFile(file);
    event.target.value = "";
    onNavigate?.();
  };

  const openCloudBackup = () => {
    setSettingsTab("sync");
    setCurrentView("settings");
    onNavigate?.();
  };

  const openDesktopDownload = () => {
    window.open(
      "https://memephant.com/download",
      "_blank",
      "noopener,noreferrer",
    );
  };

  const pendingDeleteProject = pendingDeleteId
    ? projects.find((p) => p.id === pendingDeleteId)
    : null;

  const planLabel = "Free during early access";

  return (
    <div className="sidebar-inner">
      {!desktopApp && showDesktopPrompt && (
        <button
          type="button"
          className="sidebar-desktop-prompt"
          onClick={openDesktopDownload}
          title="Open the desktop app download page"
        >
          Want full project tracking? Use the desktop app
        </button>
      )}

      <div className="sidebar-header">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.85rem",
            }}
          >
            <img
              src="/icons/source-elephant-1024.png"
              alt="Memephant"
              style={{
                width: "48px",
                height: "48px",
                objectFit: "contain",
                borderRadius: "14px",
                filter: "drop-shadow(0 0 14px rgba(245,158,11,0.18))",
              }}
            />

            <div>
              <h2 className="sidebar-brand">Memephant</h2>
              <p className="sidebar-tagline">
                Portable AI identity & continuity
              </p>
            </div>
          </div>

          <div
            style={{
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.13)",
              borderRadius: "16px",
              padding: "0.9rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.7rem",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.28rem",
              }}
            >
              <span
                style={{
                  color: "#f8fafc",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                }}
              >
                Your AI Identity
              </span>

              <span
                style={{
                  color: "#cbd5e1",
                  fontSize: "0.76rem",
                  lineHeight: 1.5,
                }}
              >
                Teach AI tools how you work once — then carry it everywhere.
              </span>
            </div>

            <div
              style={{
                transform: "scale(1.04)",
                transformOrigin: "top left",
                marginTop: "0.3rem",
              }}
            >
              <PassportBadgeButton onNavigate={onNavigate} />
            </div>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-settings-btn"
          onClick={() => {
            setCurrentView("settings");
            onNavigate?.();
          }}
          title="Open Settings"
          aria-label="Open settings"
        >
          ⚙️
        </button>
      </div>

      <div
        className="sidebar-primary-nav"
        aria-label="Main navigation"
        style={{
          marginTop: "0.2rem",
          marginBottom: "0.65rem",
        }}
      >
        <button
          type="button"
          className={`sidebar-nav-card${currentView === "memory-vault" ? " sidebar-nav-card--active" : ""}`}
          aria-current={currentView === "memory-vault" ? "page" : undefined}
          onClick={() => {
            setCurrentView("memory-vault");
            onNavigate?.();
          }}
          title="Open your local Personal Memory Vault"
          style={{
            width: "100%",
            cursor: "pointer",
            background:
              currentView === "memory-vault"
                ? "linear-gradient(135deg, rgba(124,58,237,0.22), rgba(245,158,11,0.12))"
                : "rgba(255,255,255,0.03)",
            border:
              currentView === "memory-vault"
                ? "1px solid rgba(245,158,11,0.28)"
                : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "18px",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "0.38rem",
            transition: "all 0.22s ease",
            boxShadow:
              currentView === "memory-vault"
                ? "0 0 22px rgba(245,158,11,0.08)"
                : "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.borderColor = "rgba(245,158,11,0.22)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor =
              currentView === "memory-vault"
                ? "rgba(245,158,11,0.28)"
                : "rgba(255,255,255,0.08)";
          }}
        >
          <span
            style={{
              color: "#f8fafc",
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Memory Vault
          </span>

          <span
            style={{
              color: "#94a3b8",
              fontSize: "0.76rem",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            Private personal memory
          </span>
        </button>

        <button
          type="button"
          className={`sidebar-nav-card${currentView === "launch-studio" ? " sidebar-nav-card--active" : ""}`}
          aria-current={currentView === "launch-studio" ? "page" : undefined}
          onClick={() => {
            setCurrentView("launch-studio");
            onNavigate?.();
          }}
          title="Open Launch Studio"
          style={{
            width: "100%",
            cursor: "pointer",
            background:
              currentView === "launch-studio"
                ? "linear-gradient(135deg, rgba(217,119,6,0.2), rgba(14,165,233,0.12))"
                : "rgba(255,255,255,0.03)",
            border:
              currentView === "launch-studio"
                ? "1px solid rgba(245,158,11,0.28)"
                : "1px solid rgba(255,255,255,0.08)",
            borderRadius: "18px",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "0.38rem",
            transition: "all 0.22s ease",
            boxShadow:
              currentView === "launch-studio"
                ? "0 0 22px rgba(245,158,11,0.08)"
                : "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.borderColor = "rgba(245,158,11,0.22)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.borderColor =
              currentView === "launch-studio"
                ? "rgba(245,158,11,0.28)"
                : "rgba(255,255,255,0.08)";
          }}
        >
          <span
            style={{
              color: "#f8fafc",
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Launch Studio
          </span>

          <span
            style={{
              color: "#94a3b8",
              fontSize: "0.76rem",
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            Launch kits and build updates
          </span>
        </button>
      </div>

      <div className="sidebar-actions">
        {createMode === "none" && (
          <>
            <button
              type="button"
              className="sidebar-action-btn sidebar-action-btn--primary"
              data-tour="new-project"
              onClick={handleNewProjectClick}
              style={{ background: selectedPlatform.color ?? "#64748b" }}
              title="Start a new project memory"
            >
              + New Project
            </button>

            <button
              type="button"
              className="sidebar-action-btn"
              onClick={() => {
                resetCreate();
                setShowBlueprint(true);
              }}
              title="Plan a new project before writing code"
            >
              New Project Blueprint
            </button>

            <button
              type="button"
              className="sidebar-action-btn"
              onClick={() => {
                setCreateMode("templates");
              }}
              title="Create a project from a starter template"
            >
              📋 From template
            </button>

            {desktopApp ? (
              <button
                type="button"
                className="sidebar-action-btn"
                onClick={() => void createProjectFromFolder()}
                title="Create a project by scanning a local folder"
              >
                📂 Select folder
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="sidebar-action-btn"
                  onClick={handleImportClick}
                  title="Import a saved project JSON file"
                >
                  📥 Import project JSON
                </button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: "none" }}
                  onChange={(e) => void handleImportFileChange(e)}
                  title="Choose a project JSON file to import"
                />
              </>
            )}
          </>
        )}

        {createMode === "name" && (
          <div className="sidebar-create-form">
            <input
              ref={nameInputRef}
              type="text"
              className="sidebar-create-input"
              placeholder="Project name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              title="Enter a name for the new project"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
                if (e.key === "Escape") resetCreate();
              }}
            />
            <div className="sidebar-create-buttons">
              <button
                type="button"
                className="sidebar-action-btn sidebar-action-btn--primary"
                onClick={() => void handleCreate()}
                title="Create this project"
              >
                Create
              </button>
              <button
                type="button"
                className="sidebar-action-btn"
                onClick={resetCreate}
                title="Cancel creating this project"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {createMode === "templates" && (
          <div className="sidebar-template-picker">
            <p className="sidebar-template-title">Pick a template</p>
            {PROJECT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                className="sidebar-template-option"
                onClick={() => {
                  setSelectedTemplate(t);
                  setTemplateName("");
                  setCreateMode("template-name");
                  setTimeout(() => templateNameRef.current?.focus(), 50);
                }}
                title={`Use the ${t.label} template`}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="sidebar-action-btn"
              onClick={resetCreate}
              title="Cancel choosing a template"
            >
              Cancel
            </button>
          </div>
        )}

        {createMode === "template-name" && selectedTemplate && (
          <div className="sidebar-create-form">
            <p className="sidebar-template-chosen">
              {selectedTemplate.emoji} {selectedTemplate.label}
            </p>
            <input
              ref={templateNameRef}
              type="text"
              className="sidebar-create-input"
              placeholder="Project name..."
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              title="Enter a name for this template project"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateFromTemplate();
                if (e.key === "Escape") resetCreate();
              }}
            />
            <div className="sidebar-create-buttons">
              <button
                type="button"
                className="sidebar-action-btn sidebar-action-btn--primary"
                disabled={!templateName.trim()}
                onClick={() => void handleCreateFromTemplate()}
                title="Create this project from the selected template"
              >
                Create
              </button>
              <button
                type="button"
                className="sidebar-action-btn"
                onClick={resetCreate}
                title="Cancel creating this template project"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {!cloudUser && projects.length > 0 && !cloudNudgeDismissed && (
        <div className="sidebar-cloud-nudge">
          <div className="sidebar-cloud-nudge__text">
            <span>☁️</span>
            <span>Back up your projects and sync across devices</span>
          </div>
          <div className="sidebar-cloud-nudge__actions">
            <button
              className="sidebar-cloud-nudge__cta"
              onClick={openCloudBackup}
              title="Open Cloud Backup settings to sign in"
            >
              Sign in free →
            </button>
            <button
              className="sidebar-cloud-nudge__dismiss"
              aria-label="Dismiss"
              onClick={() => {
                localStorage.setItem("mph_cloud_nudge_dismissed", "1");
                setCloudNudgeDismissed(true);
              }}
              title="Hide this cloud backup reminder"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {projects.length > 2 && (
        <div className="sidebar-search">
          <input
            type="search"
            className="sidebar-search-input"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            title="Search projects by name, summary, goals, decisions, or next steps"
          />
          {searchQuery && (
            <button
              className="sidebar-search-clear"
              onClick={() => {
                handleSearchChange("");
                setDebouncedSearch("");
              }}
              aria-label="Clear search"
              title="Clear the project search"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className="sidebar-projects">
        {projects.length === 0 && (
          <p className="sidebar-empty">
            {desktopApp
              ? "No projects yet — create one above or open a folder."
              : "No projects yet — create one above or import a project."}
          </p>
        )}

        {projects.length > 0 && filteredProjects.length === 0 && (
          <p className="sidebar-empty">No projects match "{searchQuery}".</p>
        )}

        {visibleProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isActive={project.id === activeProjectId}
            onSelect={() => {
              setActiveProject(project.id);
              setCurrentView("projects");
              onNavigate?.();
            }}
            onDelete={() => setPendingDeleteId(project.id)}
          />
        ))}
        {hiddenProjectCount > 0 && (
          <button
            type="button"
            className="sidebar-show-more"
            onClick={() => setShowAllProjects(true)}
          >
            Show {hiddenProjectCount} more
          </button>
        )}

        {showAllProjects && filteredProjects.length > 4 && (
          <button
            type="button"
            className="sidebar-show-more"
            onClick={() => setShowAllProjects(false)}
          >
            Show less
          </button>
        )}
      </div>

      <div className="sidebar-account-dock">
        {!cloudUser ? (
          <div className="sidebar-auth-card">
            <div className="sidebar-auth-content">
              <div className="sidebar-auth-icon">☁️</div>

              <div className="sidebar-auth-text">
                <p className="sidebar-auth-title">Back up & sync</p>
                <p className="sidebar-auth-desc">
                  Access your projects on any device and never lose your
                  context.
                </p>
              </div>

              <div className="sidebar-auth-actions">
                <button
                  type="button"
                  className="sidebar-auth-btn sidebar-auth-btn--primary"
                  onClick={openCloudBackup}
                  title="Open Cloud Backup settings to create an account"
                >
                  Create account
                </button>

                <button
                  type="button"
                  className="sidebar-auth-btn sidebar-auth-btn--secondary"
                  onClick={openCloudBackup}
                  title="Open Cloud Backup settings to sign in"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="sidebar-account-card"
            onClick={openCloudBackup}
            title="Open account and Cloud Backup settings"
          >
            <div className="sidebar-account-card__avatar">
              {getInitials(cloudUser.email)}
            </div>

            <div className="sidebar-account-card__meta">
              <div className="sidebar-account-card__name">
                {getDisplayName(cloudUser.email)}
              </div>
              <div className="sidebar-account-card__subline">
                {planLabel} plan
              </div>
            </div>

            <div className="sidebar-account-card__chevron">›</div>
          </button>
        )}
      </div>

      {pendingDeleteProject && (
        <ConfirmDialog
          title={`Remove "${pendingDeleteProject.name}"?`}
          message="This removes the project from the app. Your files won't be deleted."
          confirmLabel="Remove"
          onConfirm={() => {
            void deleteProject(pendingDeleteProject.id);
            setPendingDeleteId(null);
          }}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {showLaunchpad && (
        <LaunchpadWizard
          onClose={() => setShowLaunchpad(false)}
          onScanExisting={() => {
            setShowLaunchpad(false);
            void createProjectFromFolder();
            onNavigate?.();
          }}
          onCreateBlankMemory={() => {
            setShowLaunchpad(false);
            setCreateMode("name");
            setTimeout(() => nameInputRef.current?.focus(), 50);
          }}
        />
      )}

      {showBlueprint && (
        <BlueprintWizard
          onClose={() => setShowBlueprint(false)}
          onProjectCreated={() => {
            setShowBlueprint(false);
            onNavigate?.();
          }}
        />
      )}
    </div>
  );
};

export default Sidebar;
