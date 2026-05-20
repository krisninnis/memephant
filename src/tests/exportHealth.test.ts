import {
  analyzeExportHealth,
  compressExportForPaste,
} from '../utils/exportHealth';

describe('analyzeExportHealth', () => {
  it('marks a normal export as safe', () => {
    const result = analyzeExportHealth('# Project\n\nA concise handoff.\n\nmemphant_update');

    expect(result.riskLevel).toBe('safe');
    expect(result.suggestedAction).toBe('none');
    expect(result.warnings).toEqual([]);
    expect(result.characterCount).toBeGreaterThan(0);
    expect(result.approximateTokens).toBeGreaterThan(0);
  });

  it('warns on oversized exports', () => {
    const result = analyzeExportHealth('A'.repeat(46000));

    expect(result.riskLevel).toBe('warning');
    expect(result.suggestedAction).toBe('compress');
    expect(result.warnings).toContain('Export is large (46,000 characters).');
  });

  it('marks very large exports as high risk', () => {
    const result = analyzeExportHealth('A'.repeat(76000));

    expect(result.riskLevel).toBe('high');
    expect(result.suggestedAction).toBe('compress');
  });

  it('detects duplicated AI Working Style blocks', () => {
    const result = analyzeExportHealth('# AI Working Style\nA\n\n# AI Working Style\nB');

    expect(result.riskLevel).toBe('high');
    expect(result.warnings).toContain('Export contains repeated AI Working Style blocks.');
  });

  it('detects repeated memphant_update instructions', () => {
    const result = analyzeExportHealth('memphant_update\n{}\n\nmemphant_update\n{}');

    expect(result.riskLevel).toBe('high');
    expect(result.warnings).toContain('Export contains repeated memphant_update instructions.');
  });

  it('detects local file paths', () => {
    const result = analyzeExportHealth('Project lives at C:\\Users\\thoma\\project-brain');

    expect(result.riskLevel).toBe('high');
    expect(result.warnings).toContain('Export may contain a local file path.');
  });

  it('detects secret-looking strings', () => {
    const result = analyzeExportHealth('token=abcdefghijklmnopqrstuvwxyz123456');

    expect(result.riskLevel).toBe('high');
    expect(result.warnings).toContain('Export may contain a secret-looking string.');
  });

  it('detects unusual control characters and excessive blank lines', () => {
    const result = analyzeExportHealth('alpha\u0001\n\n\n\n\nomega');

    expect(result.warnings).toContain('Export contains unusual control characters.');
    expect(result.warnings).toContain('Export contains excessive blank lines.');
  });
});

describe('compressExportForPaste', () => {
  it('removes unusual control characters and collapses excessive blank lines', () => {
    const output = compressExportForPaste('alpha\u0001\n\n\n\nomega  \n');

    expect(output).toBe('alpha\n\nomega');
  });
});
