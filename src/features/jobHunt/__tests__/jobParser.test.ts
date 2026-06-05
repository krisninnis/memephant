import { parseJobsFromText } from '../jobParser';

describe('parseJobsFromText', () => {
  it('handles numbered ChatGPT job lists', () => {
    const jobs = parseJobsFromText(`
      1. Frontend Developer at Acme Labs - London hybrid - £55k https://example.com/acme
      2. React Engineer at Bright Systems - Remote UK - £65k
    `);

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toEqual(expect.objectContaining({
      title: 'Frontend Developer',
      company: 'Acme Labs',
      remoteType: 'hybrid',
      salary: '£55k',
      url: 'https://example.com/acme',
      status: 'not_applied',
    }));
    expect(jobs[1]).toEqual(expect.objectContaining({
      title: 'React Engineer',
      company: 'Bright Systems',
      remoteType: 'remote',
    }));
  });

  it('handles markdown bullets', () => {
    const jobs = parseJobsFromText(`
      - Product Engineer - Northstar AI | Remote | £70k
      - UI Developer at Studio Nine (onsite)
    `);

    expect(jobs).toHaveLength(2);
    expect(jobs[0].title).toBe('Product Engineer');
    expect(jobs[0].company).toBe('Northstar AI');
    expect(jobs[0].remoteType).toBe('remote');
    expect(jobs[1].remoteType).toBe('onsite');
  });

  it('extracts URLs and detects remote/hybrid/onsite', () => {
    const jobs = parseJobsFromText(`
      1) Platform Developer at Cloud Co - remote - https://jobs.example.dev/platform
      2) Tools Engineer at Build Ltd - hybrid in Bristol
      3) Gameplay Programmer at Local Studio - on-site
    `);

    expect(jobs[0].url).toBe('https://jobs.example.dev/platform');
    expect(jobs.map((job) => job.remoteType)).toEqual(['remote', 'hybrid', 'onsite']);
  });

  it('handles missing company/title safely', () => {
    const jobs = parseJobsFromText('https://example.com/job remote role looks relevant');

    expect(jobs).toHaveLength(1);
    expect(jobs[0].title).toBeTruthy();
    expect(jobs[0].pastedText).toContain('https://example.com/job');
  });

  it('never throws on messy input', () => {
    expect(() => parseJobsFromText(' - - - \n\n *** ')).not.toThrow();
  });
});
