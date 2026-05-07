const cloudHydrationAutosaveSkipIds = new Set<string>();

export function replaceCloudHydrationAutosaveSkipIds(ids: Iterable<string>): void {
  cloudHydrationAutosaveSkipIds.clear();

  for (const id of ids) {
    if (typeof id === 'string' && id.trim()) {
      cloudHydrationAutosaveSkipIds.add(id);
    }
  }
}

export function clearCloudHydrationAutosaveSkipIds(): void {
  cloudHydrationAutosaveSkipIds.clear();
}

export function consumeCloudHydrationAutosaveSkip(projectId: string): boolean {
  if (!cloudHydrationAutosaveSkipIds.has(projectId)) {
    return false;
  }

  cloudHydrationAutosaveSkipIds.delete(projectId);
  return true;
}
