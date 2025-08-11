import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable, codeFilesTable, codeIssuesTable } from '../db/schema';
import { type CreateRepositoryInput, type CreateCodeFileInput, type CreateCodeIssueInput } from '../schema';
import { getCodeIssues, type GetCodeIssuesFilters } from '../handlers/get_code_issues';

describe('getCodeIssues', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testRepositoryId: number;
  let testFileId: number;
  let otherRepositoryId: number;
  let otherFileId: number;

  beforeEach(async () => {
    // Create test repository
    const repositoryInput: CreateRepositoryInput = {
      github_url: 'https://github.com/test/repo',
      name: 'Test Repository',
      description: 'A test repository',
      owner: 'test',
      default_branch: 'main'
    };

    const repositoryResult = await db.insert(repositoriesTable)
      .values(repositoryInput)
      .returning()
      .execute();
    testRepositoryId = repositoryResult[0].id;

    // Create test file
    const fileInput: CreateCodeFileInput = {
      repository_id: testRepositoryId,
      path: 'src/main.js',
      content: 'console.log("Hello World");',
      language: 'javascript',
      size: 100
    };

    const fileResult = await db.insert(codeFilesTable)
      .values(fileInput)
      .returning()
      .execute();
    testFileId = fileResult[0].id;

    // Create another repository and file for isolation testing
    const otherRepositoryInput: CreateRepositoryInput = {
      github_url: 'https://github.com/other/repo',
      name: 'Other Repository',
      description: 'Another test repository',
      owner: 'other',
      default_branch: 'main'
    };

    const otherRepositoryResult = await db.insert(repositoriesTable)
      .values(otherRepositoryInput)
      .returning()
      .execute();
    otherRepositoryId = otherRepositoryResult[0].id;

    const otherFileInput: CreateCodeFileInput = {
      repository_id: otherRepositoryId,
      path: 'src/other.js',
      content: 'console.log("Other");',
      language: 'javascript',
      size: 50
    };

    const otherFileResult = await db.insert(codeFilesTable)
      .values(otherFileInput)
      .returning()
      .execute();
    otherFileId = otherFileResult[0].id;
  });

  it('should return empty array when no issues exist', async () => {
    const result = await getCodeIssues(testRepositoryId);

    expect(result).toEqual([]);
  });

  it('should return all issues for a repository', async () => {
    // Create multiple issues
    const issueInputs: CreateCodeIssueInput[] = [
      {
        file_id: testFileId,
        issue_type: 'bug',
        severity: 'high',
        description: 'Memory leak detected',
        line_number: 15,
        suggestion: 'Use proper cleanup'
      },
      {
        file_id: testFileId,
        issue_type: 'performance',
        severity: 'medium',
        description: 'Inefficient loop',
        line_number: 32,
        suggestion: 'Consider using map()'
      },
      {
        file_id: testFileId,
        issue_type: 'security',
        severity: 'critical',
        description: 'XSS vulnerability',
        line_number: 8
      }
    ];

    await db.insert(codeIssuesTable)
      .values(issueInputs)
      .execute();

    const result = await getCodeIssues(testRepositoryId);

    expect(result).toHaveLength(3);
    expect(result[0].issue_type).toBe('bug');
    expect(result[0].severity).toBe('high');
    expect(result[0].description).toBe('Memory leak detected');
    expect(result[0].line_number).toBe(15);
    expect(result[0].suggestion).toBe('Use proper cleanup');
    expect(result[0].file_id).toBe(testFileId);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);

    expect(result[1].issue_type).toBe('performance');
    expect(result[1].severity).toBe('medium');
    expect(result[2].issue_type).toBe('security');
    expect(result[2].severity).toBe('critical');
    expect(result[2].suggestion).toBeNull();
  });

  it('should only return issues for the specified repository', async () => {
    // Create issues in both repositories
    await db.insert(codeIssuesTable)
      .values({
        file_id: testFileId,
        issue_type: 'bug',
        severity: 'high',
        description: 'Issue in test repo',
      })
      .execute();

    await db.insert(codeIssuesTable)
      .values({
        file_id: otherFileId,
        issue_type: 'style',
        severity: 'low',
        description: 'Issue in other repo',
      })
      .execute();

    const result = await getCodeIssues(testRepositoryId);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Issue in test repo');
    expect(result[0].file_id).toBe(testFileId);
  });

  it('should filter by severity', async () => {
    // Create issues with different severities
    const issueInputs: CreateCodeIssueInput[] = [
      {
        file_id: testFileId,
        issue_type: 'bug',
        severity: 'critical',
        description: 'Critical bug',
      },
      {
        file_id: testFileId,
        issue_type: 'style',
        severity: 'low',
        description: 'Style issue',
      },
      {
        file_id: testFileId,
        issue_type: 'security',
        severity: 'high',
        description: 'Security issue',
      }
    ];

    await db.insert(codeIssuesTable)
      .values(issueInputs)
      .execute();

    const filters: GetCodeIssuesFilters = {
      severity: ['critical', 'high']
    };

    const result = await getCodeIssues(testRepositoryId, filters);

    expect(result).toHaveLength(2);
    expect(result.every(issue => ['critical', 'high'].includes(issue.severity))).toBe(true);
    expect(result.some(issue => issue.description === 'Critical bug')).toBe(true);
    expect(result.some(issue => issue.description === 'Security issue')).toBe(true);
    expect(result.some(issue => issue.description === 'Style issue')).toBe(false);
  });

  it('should filter by issue type', async () => {
    // Create issues with different types
    const issueInputs: CreateCodeIssueInput[] = [
      {
        file_id: testFileId,
        issue_type: 'bug',
        severity: 'high',
        description: 'Bug issue',
      },
      {
        file_id: testFileId,
        issue_type: 'performance',
        severity: 'medium',
        description: 'Performance issue',
      },
      {
        file_id: testFileId,
        issue_type: 'security',
        severity: 'critical',
        description: 'Security issue',
      }
    ];

    await db.insert(codeIssuesTable)
      .values(issueInputs)
      .execute();

    const filters: GetCodeIssuesFilters = {
      issue_type: ['bug', 'security']
    };

    const result = await getCodeIssues(testRepositoryId, filters);

    expect(result).toHaveLength(2);
    expect(result.every(issue => ['bug', 'security'].includes(issue.issue_type))).toBe(true);
    expect(result.some(issue => issue.description === 'Bug issue')).toBe(true);
    expect(result.some(issue => issue.description === 'Security issue')).toBe(true);
    expect(result.some(issue => issue.description === 'Performance issue')).toBe(false);
  });

  it('should filter by file path', async () => {
    // Create another file in the same repository
    const anotherFileResult = await db.insert(codeFilesTable)
      .values({
        repository_id: testRepositoryId,
        path: 'src/utils.js',
        content: 'export const utils = {};',
        language: 'javascript',
        size: 50
      })
      .returning()
      .execute();
    const anotherFileId = anotherFileResult[0].id;

    // Create issues in both files
    const issueInputs: CreateCodeIssueInput[] = [
      {
        file_id: testFileId,
        issue_type: 'bug',
        severity: 'high',
        description: 'Issue in main.js',
      },
      {
        file_id: anotherFileId,
        issue_type: 'style',
        severity: 'low',
        description: 'Issue in utils.js',
      }
    ];

    await db.insert(codeIssuesTable)
      .values(issueInputs)
      .execute();

    const filters: GetCodeIssuesFilters = {
      file_path: 'src/main.js'
    };

    const result = await getCodeIssues(testRepositoryId, filters);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Issue in main.js');
    expect(result[0].file_id).toBe(testFileId);
  });

  it('should apply multiple filters together', async () => {
    // Create issues with various combinations
    const issueInputs: CreateCodeIssueInput[] = [
      {
        file_id: testFileId,
        issue_type: 'bug',
        severity: 'critical',
        description: 'Critical bug - should match',
      },
      {
        file_id: testFileId,
        issue_type: 'bug',
        severity: 'low',
        description: 'Low priority bug - should not match',
      },
      {
        file_id: testFileId,
        issue_type: 'style',
        severity: 'critical',
        description: 'Critical style - should not match',
      }
    ];

    await db.insert(codeIssuesTable)
      .values(issueInputs)
      .execute();

    const filters: GetCodeIssuesFilters = {
      severity: ['critical'],
      issue_type: ['bug']
    };

    const result = await getCodeIssues(testRepositoryId, filters);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Critical bug - should match');
    expect(result[0].severity).toBe('critical');
    expect(result[0].issue_type).toBe('bug');
  });

  it('should return empty array when filters match no issues', async () => {
    // Create issues that won't match the filter
    await db.insert(codeIssuesTable)
      .values({
        file_id: testFileId,
        issue_type: 'bug',
        severity: 'low',
        description: 'Low priority bug',
      })
      .execute();

    const filters: GetCodeIssuesFilters = {
      severity: ['critical'],
      issue_type: ['security']
    };

    const result = await getCodeIssues(testRepositoryId, filters);

    expect(result).toEqual([]);
  });

  it('should handle non-existent repository', async () => {
    const result = await getCodeIssues(999999);

    expect(result).toEqual([]);
  });

  it('should handle empty filter arrays', async () => {
    await db.insert(codeIssuesTable)
      .values({
        file_id: testFileId,
        issue_type: 'bug',
        severity: 'high',
        description: 'Test issue',
      })
      .execute();

    const filters: GetCodeIssuesFilters = {
      severity: [],
      issue_type: []
    };

    const result = await getCodeIssues(testRepositoryId, filters);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Test issue');
  });
});