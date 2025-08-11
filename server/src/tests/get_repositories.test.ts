import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable } from '../db/schema';
import { type CreateRepositoryInput } from '../schema';
import { getRepositories } from '../handlers/get_repositories';
import { eq } from 'drizzle-orm';

// Test repository data
const testRepo1: CreateRepositoryInput = {
  github_url: 'https://github.com/test-user/repo1',
  name: 'Test Repository 1',
  description: 'First test repository',
  owner: 'test-user',
  default_branch: 'main'
};

const testRepo2: CreateRepositoryInput = {
  github_url: 'https://github.com/test-user/repo2',
  name: 'Test Repository 2',
  description: null,
  owner: 'test-user',
  default_branch: 'develop'
};

const testRepo3: CreateRepositoryInput = {
  github_url: 'https://github.com/another-user/repo3',
  name: 'Test Repository 3',
  description: 'Third test repository',
  owner: 'another-user',
  default_branch: 'main'
};

describe('getRepositories', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no repositories exist', async () => {
    const result = await getRepositories();
    
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return single repository when only one exists', async () => {
    // Create a single repository
    await db.insert(repositoriesTable)
      .values({
        github_url: testRepo1.github_url,
        name: testRepo1.name,
        description: testRepo1.description,
        owner: testRepo1.owner,
        default_branch: testRepo1.default_branch
      })
      .execute();

    const result = await getRepositories();
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Test Repository 1');
    expect(result[0].github_url).toEqual('https://github.com/test-user/repo1');
    expect(result[0].description).toEqual('First test repository');
    expect(result[0].owner).toEqual('test-user');
    expect(result[0].default_branch).toEqual('main');
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].last_analyzed).toBeNull();
  });

  it('should return multiple repositories when they exist', async () => {
    // Create multiple repositories
    await db.insert(repositoriesTable)
      .values([
        {
          github_url: testRepo1.github_url,
          name: testRepo1.name,
          description: testRepo1.description,
          owner: testRepo1.owner,
          default_branch: testRepo1.default_branch
        },
        {
          github_url: testRepo2.github_url,
          name: testRepo2.name,
          description: testRepo2.description,
          owner: testRepo2.owner,
          default_branch: testRepo2.default_branch
        },
        {
          github_url: testRepo3.github_url,
          name: testRepo3.name,
          description: testRepo3.description,
          owner: testRepo3.owner,
          default_branch: testRepo3.default_branch
        }
      ])
      .execute();

    const result = await getRepositories();
    
    expect(result).toHaveLength(3);
    
    // Verify all repositories are returned
    const repoNames = result.map(r => r.name);
    expect(repoNames).toContain('Test Repository 1');
    expect(repoNames).toContain('Test Repository 2');
    expect(repoNames).toContain('Test Repository 3');
    
    // Verify structure of each repository
    result.forEach(repo => {
      expect(repo.id).toBeDefined();
      expect(typeof repo.id).toBe('number');
      expect(repo.github_url).toMatch(/^https:\/\/github\.com\/.*\/.*$/);
      expect(repo.name).toBeDefined();
      expect(repo.owner).toBeDefined();
      expect(repo.default_branch).toBeDefined();
      expect(repo.created_at).toBeInstanceOf(Date);
    });
  });

  it('should handle repositories with null descriptions correctly', async () => {
    // Create repository with null description
    await db.insert(repositoriesTable)
      .values({
        github_url: testRepo2.github_url,
        name: testRepo2.name,
        description: testRepo2.description, // This is null
        owner: testRepo2.owner,
        default_branch: testRepo2.default_branch
      })
      .execute();

    const result = await getRepositories();
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Test Repository 2');
    expect(result[0].description).toBeNull();
    expect(result[0].default_branch).toEqual('develop');
  });

  it('should return repositories ordered by creation date (newest first)', async () => {
    // Create repositories with slight delay to ensure different timestamps
    const repo1Result = await db.insert(repositoriesTable)
      .values({
        github_url: testRepo1.github_url,
        name: testRepo1.name,
        description: testRepo1.description,
        owner: testRepo1.owner,
        default_branch: testRepo1.default_branch
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const repo2Result = await db.insert(repositoriesTable)
      .values({
        github_url: testRepo2.github_url,
        name: testRepo2.name,
        description: testRepo2.description,
        owner: testRepo2.owner,
        default_branch: testRepo2.default_branch
      })
      .returning()
      .execute();

    const result = await getRepositories();
    
    expect(result).toHaveLength(2);
    
    // Verify ordering - newest first
    expect(result[0].name).toEqual('Test Repository 2'); // Created second
    expect(result[1].name).toEqual('Test Repository 1'); // Created first
    
    // Verify timestamps are in correct order
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should handle repositories with last_analyzed dates', async () => {
    const analyzedDate = new Date('2024-01-15T10:00:00Z');
    
    // Create repository and then update with last_analyzed
    const insertedRepo = await db.insert(repositoriesTable)
      .values({
        github_url: testRepo1.github_url,
        name: testRepo1.name,
        description: testRepo1.description,
        owner: testRepo1.owner,
        default_branch: testRepo1.default_branch
      })
      .returning()
      .execute();

    // Update with last_analyzed date
    await db.update(repositoriesTable)
      .set({ last_analyzed: analyzedDate })
      .where(eq(repositoriesTable.id, insertedRepo[0].id))
      .execute();

    const result = await getRepositories();
    
    expect(result).toHaveLength(1);
    expect(result[0].last_analyzed).toBeInstanceOf(Date);
    expect(result[0].last_analyzed?.toISOString()).toEqual('2024-01-15T10:00:00.000Z');
  });
});