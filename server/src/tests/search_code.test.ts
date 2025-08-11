import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable, codeFilesTable, searchQueriesTable } from '../db/schema';
import { type SearchCodeInput } from '../schema';
import { searchCode } from '../handlers/search_code';
import { eq } from 'drizzle-orm';

// Test data
const testRepository = {
  github_url: 'https://github.com/test/repo',
  name: 'test-repo',
  description: 'A test repository',
  owner: 'testuser',
  default_branch: 'main'
};

const testCodeFiles = [
  {
    repository_id: 1, // Will be set after repo creation
    path: 'src/utils.ts',
    content: `
export function calculateSum(a: number, b: number): number {
  return a + b;
}

export function formatUser(user: User): string {
  return \`Hello, \${user.name}!\`;
}
`,
    language: 'typescript',
    size: 150,
    ai_summary: 'Utility functions for calculations and formatting'
  },
  {
    repository_id: 1,
    path: 'src/api.js',
    content: `
function fetchUser(id) {
  return fetch(\`/api/users/\${id}\`);
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
`,
    language: 'javascript',
    size: 120,
    ai_summary: null
  },
  {
    repository_id: 1,
    path: 'README.md',
    content: `
# Test Repository

This is a test repository for code search functionality.

## Features
- Calculate sums and totals
- User formatting
- API utilities
`,
    language: 'markdown',
    size: 80,
    ai_summary: null
  }
];

describe('searchCode', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should search code content and return matching results', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();
    const repositoryId = repoResult[0].id;

    // Create test code files
    const filesWithRepoId = testCodeFiles.map(file => ({
      ...file,
      repository_id: repositoryId
    }));
    
    await db.insert(codeFilesTable)
      .values(filesWithRepoId)
      .execute();

    // Search for "calculate"
    const searchInput: SearchCodeInput = {
      repository_id: repositoryId,
      query: 'calculate',
      include_ai_analysis: false
    };

    const results = await searchCode(searchInput);

    // Should find matches in utils.ts and api.js
    expect(results.length).toBeGreaterThan(0);
    
    const filePaths = results.map(r => r.file_path);
    expect(filePaths).toContain('src/utils.ts');
    expect(filePaths).toContain('src/api.js');

    // Check result structure
    const firstResult = results[0];
    expect(firstResult.file_path).toBeDefined();
    expect(firstResult.line_number).toBeGreaterThan(0);
    expect(firstResult.content_snippet).toContain('calculate');
    expect(firstResult.relevance_score).toBeGreaterThan(0);
    expect(firstResult.relevance_score).toBeLessThanOrEqual(1);
    expect(firstResult.ai_context).toBeNull();
  });

  it('should include AI context when requested', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();
    const repositoryId = repoResult[0].id;

    // Create test code files
    const filesWithRepoId = testCodeFiles.map(file => ({
      ...file,
      repository_id: repositoryId
    }));
    
    await db.insert(codeFilesTable)
      .values(filesWithRepoId)
      .execute();

    const searchInput: SearchCodeInput = {
      repository_id: repositoryId,
      query: 'formatUser',
      include_ai_analysis: true
    };

    const results = await searchCode(searchInput);

    expect(results.length).toBeGreaterThan(0);
    const resultWithAI = results.find(r => r.ai_context !== null);
    expect(resultWithAI).toBeDefined();
    expect(resultWithAI!.ai_context).toContain('Utility functions');
  });

  it('should filter by file types', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();
    const repositoryId = repoResult[0].id;

    // Create test code files
    const filesWithRepoId = testCodeFiles.map(file => ({
      ...file,
      repository_id: repositoryId
    }));
    
    await db.insert(codeFilesTable)
      .values(filesWithRepoId)
      .execute();

    // Search only in TypeScript files
    const searchInput: SearchCodeInput = {
      repository_id: repositoryId,
      query: 'function',
      file_types: ['typescript'],
      include_ai_analysis: false
    };

    const results = await searchCode(searchInput);

    // Should only find matches in TypeScript files
    expect(results.length).toBeGreaterThan(0);
    results.forEach(result => {
      expect(result.file_path).toContain('.ts');
    });
  });

  it('should search in file paths', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();
    const repositoryId = repoResult[0].id;

    // Create test code files
    const filesWithRepoId = testCodeFiles.map(file => ({
      ...file,
      repository_id: repositoryId
    }));
    
    await db.insert(codeFilesTable)
      .values(filesWithRepoId)
      .execute();

    // Search for "api" - should match file path
    const searchInput: SearchCodeInput = {
      repository_id: repositoryId,
      query: 'api',
      include_ai_analysis: false
    };

    const results = await searchCode(searchInput);

    expect(results.length).toBeGreaterThan(0);
    const apiFileResults = results.filter(r => r.file_path.includes('api'));
    expect(apiFileResults.length).toBeGreaterThan(0);
  });

  it('should log search queries for analytics', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();
    const repositoryId = repoResult[0].id;

    // Create test code files
    const filesWithRepoId = testCodeFiles.map(file => ({
      ...file,
      repository_id: repositoryId
    }));
    
    await db.insert(codeFilesTable)
      .values(filesWithRepoId)
      .execute();

    const searchInput: SearchCodeInput = {
      repository_id: repositoryId,
      query: 'test query',
      include_ai_analysis: false
    };

    await searchCode(searchInput);

    // Check that search query was logged
    const loggedQueries = await db.select()
      .from(searchQueriesTable)
      .where(eq(searchQueriesTable.repository_id, repositoryId))
      .execute();

    expect(loggedQueries).toHaveLength(1);
    expect(loggedQueries[0].query).toEqual('test query');
    expect(loggedQueries[0].query_type).toEqual('code');
    expect(loggedQueries[0].results_count).toBeGreaterThanOrEqual(0);
  });

  it('should return empty results for non-existent repository', async () => {
    const searchInput: SearchCodeInput = {
      repository_id: 999, // Non-existent repository
      query: 'anything',
      include_ai_analysis: false
    };

    const results = await searchCode(searchInput);

    expect(results).toHaveLength(0);

    // Should still log the search
    const loggedQueries = await db.select()
      .from(searchQueriesTable)
      .where(eq(searchQueriesTable.repository_id, 999))
      .execute();

    expect(loggedQueries).toHaveLength(1);
    expect(loggedQueries[0].results_count).toEqual(0);
  });

  it('should handle multiple file types filter', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();
    const repositoryId = repoResult[0].id;

    // Create test code files
    const filesWithRepoId = testCodeFiles.map(file => ({
      ...file,
      repository_id: repositoryId
    }));
    
    await db.insert(codeFilesTable)
      .values(filesWithRepoId)
      .execute();

    const searchInput: SearchCodeInput = {
      repository_id: repositoryId,
      query: 'function',
      file_types: ['typescript', 'javascript'],
      include_ai_analysis: false
    };

    const results = await searchCode(searchInput);

    expect(results.length).toBeGreaterThan(0);
    
    // Should include both TypeScript and JavaScript files
    const filePaths = results.map(r => r.file_path);
    expect(filePaths.some(path => path.includes('.ts'))).toBe(true);
    expect(filePaths.some(path => path.includes('.js'))).toBe(true);
    
    // Should not include markdown files
    expect(filePaths.some(path => path.includes('.md'))).toBe(false);
  });

  it('should sort results by relevance score', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();
    const repositoryId = repoResult[0].id;

    // Create test code files with different relevance patterns
    await db.insert(codeFilesTable)
      .values([
        {
          repository_id: repositoryId,
          path: 'exact_match.ts',
          content: 'calculate', // Exact match at beginning
          language: 'typescript',
          size: 10
        },
        {
          repository_id: repositoryId,
          path: 'partial_match.ts',
          content: 'function recalculate() {}', // Partial match
          language: 'typescript',
          size: 25
        }
      ])
      .execute();

    const searchInput: SearchCodeInput = {
      repository_id: repositoryId,
      query: 'calculate',
      include_ai_analysis: false
    };

    const results = await searchCode(searchInput);

    expect(results.length).toBeGreaterThan(1);
    
    // Results should be sorted by relevance (highest first)
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].relevance_score).toBeGreaterThanOrEqual(results[i + 1].relevance_score);
    }
  });
});