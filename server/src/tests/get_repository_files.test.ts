import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable, codeFilesTable } from '../db/schema';
import { getRepositoryFiles } from '../handlers/get_repository_files';
import { eq } from 'drizzle-orm';

describe('getRepositoryFiles', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when repository has no files', async () => {
    // Create a repository first
    const repoResult = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/empty-repo',
        name: 'empty-repo',
        description: 'An empty repository',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repository = repoResult[0];

    const result = await getRepositoryFiles(repository.id);

    expect(result).toEqual([]);
  });

  it('should return all files for a repository', async () => {
    // Create a repository
    const repoResult = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/my-repo',
        name: 'my-repo',
        description: 'A test repository',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repository = repoResult[0];

    // Create multiple code files for this repository
    const fileInputs = [
      {
        repository_id: repository.id,
        path: 'src/index.js',
        content: 'console.log("Hello World");',
        language: 'javascript',
        size: 26,
        ai_summary: 'Main entry point file',
        complexity_score: '2.50'
      },
      {
        repository_id: repository.id,
        path: 'src/utils.ts',
        content: 'export const helper = () => {};',
        language: 'typescript',
        size: 31,
        ai_summary: null,
        complexity_score: '1.20'
      },
      {
        repository_id: repository.id,
        path: 'README.md',
        content: '# My Repo\nThis is a test repository.',
        language: 'markdown',
        size: 37,
        ai_summary: 'Repository documentation',
        complexity_score: null
      }
    ];

    await db.insert(codeFilesTable)
      .values(fileInputs)
      .execute();

    const result = await getRepositoryFiles(repository.id);

    expect(result).toHaveLength(3);

    // Verify files are returned with proper data types
    const indexFile = result.find(f => f.path === 'src/index.js');
    expect(indexFile).toBeDefined();
    expect(indexFile!.repository_id).toBe(repository.id);
    expect(indexFile!.language).toBe('javascript');
    expect(indexFile!.size).toBe(26);
    expect(indexFile!.ai_summary).toBe('Main entry point file');
    expect(indexFile!.complexity_score).toBe(2.5); // Converted to number
    expect(typeof indexFile!.complexity_score).toBe('number');
    expect(indexFile!.created_at).toBeInstanceOf(Date);
    expect(indexFile!.last_updated).toBeInstanceOf(Date);

    const utilsFile = result.find(f => f.path === 'src/utils.ts');
    expect(utilsFile).toBeDefined();
    expect(utilsFile!.language).toBe('typescript');
    expect(utilsFile!.complexity_score).toBe(1.2); // Converted to number
    expect(typeof utilsFile!.complexity_score).toBe('number');

    const readmeFile = result.find(f => f.path === 'README.md');
    expect(readmeFile).toBeDefined();
    expect(readmeFile!.language).toBe('markdown');
    expect(readmeFile!.complexity_score).toBeNull(); // null values preserved
    expect(readmeFile!.ai_summary).toBe('Repository documentation');
  });

  it('should only return files for the specified repository', async () => {
    // Create two repositories
    const repo1Result = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/repo1',
        name: 'repo1',
        description: 'First repository',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repo2Result = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/repo2',
        name: 'repo2',
        description: 'Second repository',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repo1 = repo1Result[0];
    const repo2 = repo2Result[0];

    // Create files for both repositories
    await db.insert(codeFilesTable)
      .values([
        {
          repository_id: repo1.id,
          path: 'repo1-file.js',
          content: 'console.log("repo1");',
          language: 'javascript',
          size: 20
        },
        {
          repository_id: repo1.id,
          path: 'another-repo1-file.ts',
          content: 'export default {};',
          language: 'typescript',
          size: 18
        },
        {
          repository_id: repo2.id,
          path: 'repo2-file.py',
          content: 'print("repo2")',
          language: 'python',
          size: 14
        }
      ])
      .execute();

    // Query files for repo1 only
    const repo1Files = await getRepositoryFiles(repo1.id);
    expect(repo1Files).toHaveLength(2);
    expect(repo1Files.every(f => f.repository_id === repo1.id)).toBe(true);
    expect(repo1Files.map(f => f.path).sort()).toEqual(['another-repo1-file.ts', 'repo1-file.js']);

    // Query files for repo2 only
    const repo2Files = await getRepositoryFiles(repo2.id);
    expect(repo2Files).toHaveLength(1);
    expect(repo2Files[0].repository_id).toBe(repo2.id);
    expect(repo2Files[0].path).toBe('repo2-file.py');
    expect(repo2Files[0].language).toBe('python');
  });

  it('should handle repositories with large numbers of files', async () => {
    // Create a repository
    const repoResult = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/large-repo',
        name: 'large-repo',
        description: 'A repository with many files',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repository = repoResult[0];

    // Create many files
    const fileInputs = Array.from({ length: 50 }, (_, i) => ({
      repository_id: repository.id,
      path: `src/file${i}.js`,
      content: `// File ${i}\nconsole.log(${i});`,
      language: 'javascript',
      size: 20 + i,
      complexity_score: i % 2 === 0 ? `${(i / 10).toFixed(2)}` : null
    }));

    await db.insert(codeFilesTable)
      .values(fileInputs)
      .execute();

    const result = await getRepositoryFiles(repository.id);

    expect(result).toHaveLength(50);
    expect(result.every(f => f.repository_id === repository.id)).toBe(true);
    
    // Verify numeric conversion for complexity scores
    const filesWithComplexity = result.filter(f => f.complexity_score !== null);
    expect(filesWithComplexity.length).toBe(25); // Half have complexity scores
    filesWithComplexity.forEach(file => {
      expect(typeof file.complexity_score).toBe('number');
    });

    // Verify files without complexity scores
    const filesWithoutComplexity = result.filter(f => f.complexity_score === null);
    expect(filesWithoutComplexity.length).toBe(25);
  });

  it('should return files with all required fields', async () => {
    // Create a repository
    const repoResult = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/complete-repo',
        name: 'complete-repo',
        description: 'Repository for field validation',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repository = repoResult[0];

    // Create a file with all possible fields filled
    await db.insert(codeFilesTable)
      .values({
        repository_id: repository.id,
        path: 'src/complete.ts',
        content: 'export class CompleteClass {\n  constructor() {}\n}',
        language: 'typescript',
        size: 45,
        ai_summary: 'A complete class implementation',
        complexity_score: '3.75'
      })
      .execute();

    const result = await getRepositoryFiles(repository.id);

    expect(result).toHaveLength(1);
    const file = result[0];

    // Verify all schema fields are present
    expect(file.id).toBeDefined();
    expect(typeof file.id).toBe('number');
    expect(file.repository_id).toBe(repository.id);
    expect(file.path).toBe('src/complete.ts');
    expect(file.content).toBe('export class CompleteClass {\n  constructor() {}\n}');
    expect(file.language).toBe('typescript');
    expect(file.size).toBe(45);
    expect(file.ai_summary).toBe('A complete class implementation');
    expect(file.complexity_score).toBe(3.75);
    expect(typeof file.complexity_score).toBe('number');
    expect(file.last_updated).toBeInstanceOf(Date);
    expect(file.created_at).toBeInstanceOf(Date);
  });
});