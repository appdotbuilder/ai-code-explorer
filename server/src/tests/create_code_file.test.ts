import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable, codeFilesTable } from '../db/schema';
import { type CreateCodeFileInput, type CreateRepositoryInput } from '../schema';
import { createCodeFile } from '../handlers/create_code_file';
import { eq } from 'drizzle-orm';

// Helper to create a test repository
const createTestRepository = async (): Promise<number> => {
  const repositoryInput: CreateRepositoryInput = {
    github_url: 'https://github.com/test/repo',
    name: 'Test Repository',
    description: 'A test repository',
    owner: 'test',
    default_branch: 'main'
  };

  const result = await db.insert(repositoriesTable)
    .values({
      github_url: repositoryInput.github_url,
      name: repositoryInput.name,
      description: repositoryInput.description,
      owner: repositoryInput.owner,
      default_branch: repositoryInput.default_branch
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('createCodeFile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a code file with all fields', async () => {
    const repositoryId = await createTestRepository();
    
    const testInput: CreateCodeFileInput = {
      repository_id: repositoryId,
      path: 'src/index.js',
      content: 'console.log("Hello World");',
      language: 'javascript',
      size: 25
    };

    const result = await createCodeFile(testInput);

    // Basic field validation
    expect(result.repository_id).toEqual(repositoryId);
    expect(result.path).toEqual('src/index.js');
    expect(result.content).toEqual('console.log("Hello World");');
    expect(result.language).toEqual('javascript');
    expect(result.size).toEqual(25);
    expect(result.id).toBeDefined();
    expect(result.ai_summary).toBeNull();
    expect(result.complexity_score).toBeNull();
    expect(result.last_updated).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a code file with minimal fields (language optional)', async () => {
    const repositoryId = await createTestRepository();
    
    const testInput: CreateCodeFileInput = {
      repository_id: repositoryId,
      path: 'README.md',
      content: '# Test Project\n\nThis is a test.',
      size: 34
    };

    const result = await createCodeFile(testInput);

    expect(result.repository_id).toEqual(repositoryId);
    expect(result.path).toEqual('README.md');
    expect(result.content).toEqual('# Test Project\n\nThis is a test.');
    expect(result.language).toBeNull();
    expect(result.size).toEqual(34);
    expect(result.id).toBeDefined();
  });

  it('should save code file to database', async () => {
    const repositoryId = await createTestRepository();
    
    const testInput: CreateCodeFileInput = {
      repository_id: repositoryId,
      path: 'utils/helper.ts',
      content: 'export const helper = () => { return true; };',
      language: 'typescript',
      size: 43
    };

    const result = await createCodeFile(testInput);

    // Query using proper drizzle syntax
    const codeFiles = await db.select()
      .from(codeFilesTable)
      .where(eq(codeFilesTable.id, result.id))
      .execute();

    expect(codeFiles).toHaveLength(1);
    const savedFile = codeFiles[0];
    expect(savedFile.repository_id).toEqual(repositoryId);
    expect(savedFile.path).toEqual('utils/helper.ts');
    expect(savedFile.content).toEqual('export const helper = () => { return true; };');
    expect(savedFile.language).toEqual('typescript');
    expect(savedFile.size).toEqual(43);
    expect(savedFile.last_updated).toBeInstanceOf(Date);
    expect(savedFile.created_at).toBeInstanceOf(Date);
  });

  it('should handle large file content', async () => {
    const repositoryId = await createTestRepository();
    
    // Create a large content string
    const largeContent = 'const data = [\n' + 
      Array(1000).fill(0).map((_, i) => `  { id: ${i}, value: "item_${i}" }`).join(',\n') + 
      '\n];';
    
    const testInput: CreateCodeFileInput = {
      repository_id: repositoryId,
      path: 'data/large_dataset.js',
      content: largeContent,
      language: 'javascript',
      size: largeContent.length
    };

    const result = await createCodeFile(testInput);

    expect(result.content).toEqual(largeContent);
    expect(result.size).toEqual(largeContent.length);
    expect(result.path).toEqual('data/large_dataset.js');
  });

  it('should create multiple code files for same repository', async () => {
    const repositoryId = await createTestRepository();
    
    const files = [
      {
        path: 'src/main.js',
        content: 'const main = () => console.log("main");',
        language: 'javascript',
        size: 38
      },
      {
        path: 'src/utils.js', 
        content: 'export const util = () => true;',
        language: 'javascript',
        size: 31
      },
      {
        path: 'package.json',
        content: '{"name": "test", "version": "1.0.0"}',
        language: 'json',
        size: 36
      }
    ];

    const results = [];
    for (const file of files) {
      const input: CreateCodeFileInput = {
        repository_id: repositoryId,
        ...file
      };
      results.push(await createCodeFile(input));
    }

    expect(results).toHaveLength(3);
    
    // Verify all files are saved in database
    const savedFiles = await db.select()
      .from(codeFilesTable)
      .where(eq(codeFilesTable.repository_id, repositoryId))
      .execute();

    expect(savedFiles).toHaveLength(3);
    
    const paths = savedFiles.map(f => f.path).sort();
    expect(paths).toEqual(['package.json', 'src/main.js', 'src/utils.js']);
  });

  it('should create code file even with non-existent repository_id', async () => {
    // Note: The schema doesn't enforce foreign key constraints at the database level,
    // so this will succeed even with a non-existent repository_id
    const testInput: CreateCodeFileInput = {
      repository_id: 99999, // Non-existent repository
      path: 'src/test.js',
      content: 'console.log("test");',
      language: 'javascript',
      size: 20
    };

    const result = await createCodeFile(testInput);
    
    expect(result.repository_id).toEqual(99999);
    expect(result.path).toEqual('src/test.js');
    expect(result.content).toEqual('console.log("test");');
    expect(result.language).toEqual('javascript');
    expect(result.size).toEqual(20);
    expect(result.id).toBeDefined();
  });
});