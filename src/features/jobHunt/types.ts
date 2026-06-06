export type JobApplicationStatus =
  | 'not_applied'
  | 'shortlisted'
  | 'applied'
  | 'follow_up'
  | 'interview'
  | 'rejected'
  | 'offer'
  | (string & {});

export type JobRemoteType = 'remote' | 'hybrid' | 'onsite' | 'remote_uk_only' | 'unknown' | (string & {});

export type JobFitScore = 'high' | 'medium' | 'low' | 'stretch' | 'not_suitable' | 'unknown' | (string & {});

export type JobItem = {
  id: string;
  title: string;
  company?: string;
  location?: string;
  remoteType?: JobRemoteType;
  salary?: string;
  url?: string;
  source?: string;
  fitScore?: JobFitScore;
  status: JobApplicationStatus;
  notes?: string;
  pastedText?: string;
  createdAt: string;
  updatedAt: string;
};

export type JobHuntProfile = {
  targetRoles: string[];
  targetLocations: string[];
  preferredRemoteType?: 'remote' | 'hybrid' | 'onsite' | 'remote_uk_only' | 'any' | (string & {});
  experienceLevel?: string;
  cvSummary?: string;
  keySkills: string[];
  projects: string[];
  constraints?: string;
};

export type JobPromptType = 'tailor_cv' | 'cover_message' | 'interview_prep' | 'fit_analysis';
