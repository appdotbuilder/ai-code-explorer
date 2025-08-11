import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable, codeFilesTable, codeFunctionsTable } from '../db/schema';
import { getFileFunctions } from '../handlers/get_file_functions';
import { eq } from 'drizzle-orm';

describe('getFileFunctions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return functions ordered by line start', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/repo',
        name: 'Test Repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    // Create test code file
    const fileResult = await db.insert(codeFilesTable)
      .values({
        repository_id: repoResult[0].id,
        path: 'src/utils.js',
        content: 'function helper() {}\nfunction main() {}',
        size: 100,
        language: 'javascript'
      })
      .returning()
      .execute();

    // Create test functions in reverse order to test ordering
    await db.insert(codeFunctionsTable)
      .values([
        {
          file_id: fileResult[0].id,
          name: 'main',
          signature: 'function main()',
          line_start: 10,
          line_end: 20,
          ai_explanation: 'Main function that runs the application',
          complexity_score: '3.5'
        },
        {
          file_id: fileResult[0].id,
          name: 'helper',
          signature: 'function helper(data)',
          line_start: 5,
          line_end: 8,
          ai_explanation: 'Helper utility function',
          complexity_score: '1.2'
        }
      ])
      .execute();

    const result = await getFileFunctions(fileResult[0].id);

    expect(result).toHaveLength(2);

    // Should be ordered by line_start (helper first, then main)
    expect(result[0].name).toBe('helper');
    expect(result[0].line_start).toBe(5);
    expect(result[0].line_end).toBe(8);
    expect(result[0].signature).toBe('function helper(data)');
    expect(result[0].ai_explanation).toBe('Helper utility function');
    expect(result[0].complexity_score).toBe(1.2);
    expect(typeof result[0].complexity_score).toBe('number');

    expect(result[1].name).toBe('main');
    expect(result[1].line_start).toBe(10);
    expect(result[1].line_end).toBe(20);
    expect(result[1].complexity_score).toBe(3.5);
    expect(typeof result[1].complexity_score).toBe('number');
  });

  it('should handle functions without AI explanation or complexity score', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/repo',
        name: 'Test Repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    // Create test code file
    const fileResult = await db.insert(codeFilesTable)
      .values({
        repository_id: repoResult[0].id,
        path: 'src/basic.py',
        content: 'def simple(): pass',
        size: 50,
        language: 'python'
      })
      .returning()
      .execute();

    // Create function without optional fields
    await db.insert(codeFunctionsTable)
      .values({
        file_id: fileResult[0].id,
        name: 'simple',
        signature: 'def simple():',
        line_start: 1,
        line_end: 1
      })
      .execute();

    const result = await getFileFunctions(fileResult[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('simple');
    expect(result[0].ai_explanation).toBeNull();
    expect(result[0].complexity_score).toBeNull();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return empty array for file with no functions', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/repo',
        name: 'Test Repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    // Create test code file
    const fileResult = await db.insert(codeFilesTable)
      .values({
        repository_id: repoResult[0].id,
        path: 'src/config.json',
        content: '{"setting": "value"}',
        size: 20,
        language: 'json'
      })
      .returning()
      .execute();

    const result = await getFileFunctions(fileResult[0].id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for non-existent file', async () => {
    const result = await getFileFunctions(99999);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle multiple functions with same line numbers correctly', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/repo',
        name: 'Test Repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    // Create test code file
    const fileResult = await db.insert(codeFilesTable)
      .values({
        repository_id: repoResult[0].id,
        path: 'src/class.js',
        content: 'class TestClass { method1() {} method2() {} }',
        size: 200,
        language: 'javascript'
      })
      .returning()
      .execute();

    // Create multiple functions with same start line (e.g., class methods)
    await db.insert(codeFunctionsTable)
      .values([
        {
          file_id: fileResult[0].id,
          name: 'method1',
          signature: 'method1()',
          line_start: 15,
          line_end: 18
        },
        {
          file_id: fileResult[0].id,
          name: 'method2',
          signature: 'method2()',
          line_start: 15,
          line_end: 21
        }
      ])
      .execute();

    const result = await getFileFunctions(fileResult[0].id);

    expect(result).toHaveLength(2);
    // Both should be returned, ordered by line_start (though they're the same)
    expect(result.map(f => f.name)).toContain('method1');
    expect(result.map(f => f.name)).toContain('method2');
  });

  it('should verify data is saved to database correctly', async () => {
    // Create test repository
    const repoResult = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/repo',
        name: 'Test Repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    // Create test code file
    const fileResult = await db.insert(codeFilesTable)
      .values({
        repository_id: repoResult[0].id,
        path: 'src/test.py',
        content: 'def calculate(): return 42',
        size: 75,
        language: 'python'
      })
      .returning()
      .execute();

    // Create test function
    const functionResult = await db.insert(codeFunctionsTable)
      .values({
        file_id: fileResult[0].id,
        name: 'calculate',
        signature: 'def calculate():',
        line_start: 1,
        line_end: 1,
        complexity_score: '2.0'
      })
      .returning()
      .execute();

    // Query database directly to verify data persistence
    const dbFunctions = await db.select()
      .from(codeFunctionsTable)
      .where(eq(codeFunctionsTable.file_id, fileResult[0].id))
      .execute();

    expect(dbFunctions).toHaveLength(1);
    expect(dbFunctions[0].name).toBe('calculate');
    expect(dbFunctions[0].file_id).toBe(fileResult[0].id);
    expect(dbFunctions[0].complexity_score).toBe('2.00'); // Stored as string in DB with precision formatting

    // Test handler returns converted data
    const result = await getFileFunctions(fileResult[0].id);
    expect(result[0].complexity_score).toBe(2.0); // Converted to number
  });
});