import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable } from '../db/schema';
import { type CreateRepositoryInput } from '../schema';
import { createRepository } from '../handlers/create_repository';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateRepositoryInput = {
  github_url: 'https://github.com/test/repo',
  name: 'test-repo',
  description: 'A test repository for unit testing',
  owner: 'test',
  default_branch: 'main'
};

// Test input with minimal fields (testing Zod defaults)
const minimalInput = {
  github_url: 'https://github.com/minimal/repo',
  name: 'minimal-repo',
  owner: 'minimal'
  // description is optional, default_branch will be defaulted by Zod parsing
} as CreateRepositoryInput;

describe('createRepository', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a repository with all fields', async () => {
    const result = await createRepository(testInput);

    // Basic field validation
    expect(result.github_url).toEqual('https://github.com/test/repo');
    expect(result.name).toEqual('test-repo');
    expect(result.description).toEqual('A test repository for unit testing');
    expect(result.owner).toEqual('test');
    expect(result.default_branch).toEqual('main');
    expect(result.last_analyzed).toBeNull();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a repository with minimal fields', async () => {
    const result = await createRepository(minimalInput);

    // Basic field validation
    expect(result.github_url).toEqual('https://github.com/minimal/repo');
    expect(result.name).toEqual('minimal-repo');
    expect(result.description).toBeNull();
    expect(result.owner).toEqual('minimal');
    expect(result.default_branch).toEqual('main'); // Should use Zod default
    expect(result.last_analyzed).toBeNull();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save repository to database', async () => {
    const result = await createRepository(testInput);

    // Query database to verify the record was saved
    const repositories = await db.select()
      .from(repositoriesTable)
      .where(eq(repositoriesTable.id, result.id))
      .execute();

    expect(repositories).toHaveLength(1);
    const savedRepo = repositories[0];
    expect(savedRepo.github_url).toEqual('https://github.com/test/repo');
    expect(savedRepo.name).toEqual('test-repo');
    expect(savedRepo.description).toEqual('A test repository for unit testing');
    expect(savedRepo.owner).toEqual('test');
    expect(savedRepo.default_branch).toEqual('main');
    expect(savedRepo.last_analyzed).toBeNull();
    expect(savedRepo.created_at).toBeInstanceOf(Date);
  });

  it('should handle null description correctly', async () => {
    const inputWithNullDescription = {
      ...testInput,
      description: null
    };

    const result = await createRepository(inputWithNullDescription);

    expect(result.description).toBeNull();

    // Verify in database
    const repositories = await db.select()
      .from(repositoriesTable)
      .where(eq(repositoriesTable.id, result.id))
      .execute();

    expect(repositories[0].description).toBeNull();
  });

  it('should create multiple repositories with unique IDs', async () => {
    const input1 = {
      ...testInput,
      github_url: 'https://github.com/test/repo1',
      name: 'repo1'
    };

    const input2 = {
      ...testInput,
      github_url: 'https://github.com/test/repo2',
      name: 'repo2'
    };

    const result1 = await createRepository(input1);
    const result2 = await createRepository(input2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('repo1');
    expect(result2.name).toEqual('repo2');

    // Verify both are in database
    const allRepos = await db.select()
      .from(repositoriesTable)
      .execute();

    expect(allRepos).toHaveLength(2);
    expect(allRepos.map(r => r.name)).toContain('repo1');
    expect(allRepos.map(r => r.name)).toContain('repo2');
  });

  it('should handle different branch names', async () => {
    const inputWithCustomBranch = {
      ...testInput,
      default_branch: 'develop'
    };

    const result = await createRepository(inputWithCustomBranch);

    expect(result.default_branch).toEqual('develop');

    // Verify in database
    const repositories = await db.select()
      .from(repositoriesTable)
      .where(eq(repositoriesTable.id, result.id))
      .execute();

    expect(repositories[0].default_branch).toEqual('develop');
  });
});