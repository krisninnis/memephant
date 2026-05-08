import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import {
  clearPersonalMemoryVault,
  loadPersonalMemoryVault,
} from '../../services/personalMemoryVaultStorage';
import { createDefaultPersonalMemoryVault, type PersonalMemoryVault } from '../../types/personalMemoryVault';
import ConfirmDialog from '../Shared/ConfirmDialog';

type VaultSection = {
  title: string;
  description: string;
  count?: number;
  status?: string;
};

function hasOwnerProfile(vault: PersonalMemoryVault): boolean {
  return Boolean(
    vault.ownerProfile.displayName ||
      vault.ownerProfile.role ||
      vault.ownerProfile.bio ||
      vault.ownerProfile.locationHint,
  );
}

function getPermissionCount(vault: PersonalMemoryVault): number {
  return Object.keys(vault.platformPermissions).length;
}

function sectionStatus(count?: number, status?: string): string {
  if (status) {
    return status;
  }

  return count && count > 0 ? `${count} saved` : 'Empty';
}

export function SettingsMemoryVault() {
  const showToast = useProjectStore((s) => s.showToast);
  const [vault, setVault] = useState<PersonalMemoryVault>(() => loadPersonalMemoryVault());
  const [confirmClear, setConfirmClear] = useState(false);

  const licensingDisabled = !vault.dataLicensingPreferences.allowLicensing;
  const sections: VaultSection[] = [
    {
      title: 'Owner Profile',
      description: 'Name, role, bio, or broad self-description you choose to store.',
      count: hasOwnerProfile(vault) ? 1 : 0,
    },
    {
      title: 'Preferences',
      description: 'Personal preferences you may later choose to share with an AI.',
      count: vault.preferences.length,
    },
    {
      title: 'Goals',
      description: 'Long-term personal, career, or creative goals.',
      count: vault.goals.length,
    },
    {
      title: 'Rules / Boundaries',
      description: 'Personal rules, boundaries, and AI collaboration limits.',
      count: vault.rules.length,
    },
    {
      title: 'Never Share',
      description: 'Things Memephant should never include in personal-memory exports.',
      count: vault.neverShare.length,
    },
    {
      title: 'Platform Permissions',
      description: 'Per-platform sharing permissions. Nothing is allowed by default.',
      count: getPermissionCount(vault),
    },
    {
      title: 'Licensing Preferences',
      description: 'Future consent and licensing preferences. Marketplace features are not enabled.',
      status: licensingDisabled ? 'Disabled' : 'Enabled',
    },
  ];

  const handleClearVault = () => {
    clearPersonalMemoryVault();
    setVault(createDefaultPersonalMemoryVault());
    setConfirmClear(false);
    showToast('Personal Memory Vault cleared from this device');
  };

  return (
    <div>
      <h2 className="settings-section-title">Personal Memory Vault</h2>
      <p className="settings-section-subtitle">
        A private, local-only shell for personal context you may later choose to carry across AI tools.
      </p>

      <div className="settings-trust-box">
        <div>Your Personal Memory Vault is separate from Project Memory.</div>
        <div className="settings-trust-list">
          <div>- Stored locally in this browser/app only</div>
          <div>- Not synced to cloud</div>
          <div>- Not included in project exports or Context Passports</div>
          <div>- Not sent to any AI unless a future permission flow asks you first</div>
        </div>
      </div>

      <div className="memory-vault-status-grid">
        <div className="memory-vault-status-card">
          <div className="memory-vault-status-label">Storage</div>
          <div className="memory-vault-status-value">Local only</div>
        </div>
        <div className="memory-vault-status-card">
          <div className="memory-vault-status-label">Sharing</div>
          <div className="memory-vault-status-value">Off by default</div>
        </div>
        <div className="memory-vault-status-card">
          <div className="memory-vault-status-label">Licensing</div>
          <div className="memory-vault-status-value">
            {licensingDisabled ? 'Disabled' : 'Enabled'}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Vault sections</div>
        <div className="memory-vault-grid">
          {sections.map((section) => (
            <section className="memory-vault-card" key={section.title}>
              <div className="memory-vault-card-header">
                <h3>{section.title}</h3>
                <span className="setting-badge">
                  {sectionStatus(section.count, section.status)}
                </span>
              </div>
              <p>{section.description}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Vault controls</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Clear Vault</div>
            <div className="setting-description">
              Remove the local Personal Memory Vault shell from this device. Project memories are not affected.
            </div>
          </div>
          <button
            className="setting-btn setting-btn--danger"
            onClick={() => setConfirmClear(true)}
            type="button"
          >
            Clear Vault
          </button>
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear Personal Memory Vault?"
          message="This clears only the local Personal Memory Vault on this device. Project memory, exports, and cloud backup are not changed."
          confirmLabel="Clear Vault"
          onConfirm={handleClearVault}
          onCancel={() => setConfirmClear(false)}
          dangerous
        />
      )}
    </div>
  );
}

export default SettingsMemoryVault;
