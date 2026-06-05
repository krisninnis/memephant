import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseJobsFromText } from './jobParser';
import type { JobApplicationStatus, JobHuntProfile, JobItem } from './types';

const DEFAULT_PROFILE: JobHuntProfile = {
  targetRoles: [],
  targetLocations: [],
  preferredRemoteType: 'any',
  cvSummary: '',
  keySkills: [],
  projects: [],
  constraints: '',
};

type JobHuntStore = {
  profile: JobHuntProfile;
  jobs: JobItem[];
  selectedJobId: string | null;
  lastImportCount: number;
  updateProfile: (profile: JobHuntProfile) => void;
  createJob: (job?: Partial<JobItem>) => JobItem;
  updateJob: (id: string, updates: Partial<JobItem>) => void;
  deleteJob: (id: string) => void;
  updateJobStatus: (id: string, status: JobApplicationStatus) => void;
  selectJob: (id: string | null) => void;
  importJobsFromText: (text: string) => number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createJobItem(input: Partial<JobItem> = {}): JobItem {
  const timestamp = nowIso();
  return {
    id: input.id ?? `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: input.title?.trim() || 'Untitled role',
    company: input.company,
    location: input.location,
    remoteType: input.remoteType ?? 'unknown',
    salary: input.salary,
    url: input.url,
    source: input.source,
    fitScore: input.fitScore ?? 'unknown',
    status: input.status ?? 'not_applied',
    notes: input.notes ?? '',
    pastedText: input.pastedText,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? timestamp,
  };
}

export const useJobHuntStore = create<JobHuntStore>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      jobs: [],
      selectedJobId: null,
      lastImportCount: 0,
      updateProfile: (profile) => set({ profile }),
      createJob: (job = {}) => {
        const nextJob = createJobItem(job);
        set((state) => ({
          jobs: [nextJob, ...state.jobs],
          selectedJobId: nextJob.id,
        }));
        return nextJob;
      },
      updateJob: (id, updates) =>
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === id
              ? {
                  ...job,
                  ...updates,
                  title: updates.title !== undefined ? updates.title || 'Untitled role' : job.title,
                  updatedAt: nowIso(),
                }
              : job,
          ),
        })),
      deleteJob: (id) =>
        set((state) => {
          const jobs = state.jobs.filter((job) => job.id !== id);
          return {
            jobs,
            selectedJobId: state.selectedJobId === id ? jobs[0]?.id ?? null : state.selectedJobId,
          };
        }),
      updateJobStatus: (id, status) => get().updateJob(id, { status }),
      selectJob: (id) => set({ selectedJobId: id }),
      importJobsFromText: (text) => {
        const parsedJobs = parseJobsFromText(text).map((job) => createJobItem(job));
        set((state) => ({
          jobs: [...parsedJobs, ...state.jobs],
          selectedJobId: parsedJobs[0]?.id ?? state.selectedJobId,
          lastImportCount: parsedJobs.length,
        }));
        return parsedJobs.length;
      },
    }),
    {
      name: 'mph_job_hunt_v1',
      version: 1,
      merge: (persisted, current) => {
        const data = persisted as Partial<JobHuntStore> | undefined;
        return {
          ...current,
          ...data,
          profile: {
            ...DEFAULT_PROFILE,
            ...(data?.profile ?? {}),
          },
          jobs: Array.isArray(data?.jobs) ? data.jobs.map((job) => createJobItem(job)) : [],
          selectedJobId: data?.selectedJobId ?? null,
          lastImportCount: 0,
        };
      },
    },
  ),
);
