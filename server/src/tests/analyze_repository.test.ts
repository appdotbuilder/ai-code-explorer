import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable } from '../db/schema';
import { analyzeRepository } from '../handlers/analyze_repository';
import { eq } from 'drizzle-orm';

// Test repository input - define explicitly with proper types
const testRepositoryData = {
  github_url: 'https://github.com/test/repo',
  name: 'test-repo',
  description: 'A test repository for analysis' as string | null,
  owner: 'test',
  default_branch: 'main'
};

describe('analyzeRepository', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update repository last_analyzed timestamp', async () => {
    // Create a test repository first
    const createResult = await db.insert(repositoriesTable)
      .values(testRepositoryData)
      .returning()
      .execute();

    const createdRepo = createResult[0];
    expect(createdRepo.last_analyzed).toBeNull();

    // Analyze the repository
    const result = await analyzeRepository(createdRepo.id);

    // Verify the result
    expect(result.id).toEqual(createdRepo.id);
    expect(result.github_url).toEqual(testRepositoryData.github_url);
    expect(result.name).toEqual(testRepositoryData.name);
    expect(result.description).toEqual(testRepositoryData.description);
    expect(result.owner).toEqual(testRepositoryData.owner);
    expect(result.default_branch).toEqual(testRepositoryData.default_branch);
    expect(result.last_analyzed).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify last_analyzed was updated and is recent
    const now = new Date();
    const timeDiff = now.getTime() - result.last_analyzed!.getTime();
    expect(timeDiff).toBeLessThan(5000); // Should be within 5 seconds
  });

  it('should save updated timestamp to database', async () => {
    // Create a test repository
    const createResult = await db.insert(repositoriesTable)
      .values(testRepositoryData)
      .returning()
      .execute();

    const createdRepo = createResult[0];
    
    // Analyze the repository
    const result = await analyzeRepository(createdRepo.id);

    // Query database directly to verify update
    const updatedRepo = await db.select()
      .from(repositoriesTable)
      .where(eq(repositoriesTable.id, createdRepo.id))
      .execute();

    expect(updatedRepo).toHaveLength(1);
    expect(updatedRepo[0].last_analyzed).toBeInstanceOf(Date);
    expect(updatedRepo[0].last_analyzed!.getTime()).toEqual(result.last_analyzed!.getTime());
  });

  it('should throw error for non-existent repository', async () => {
    const nonExistentId = 99999;

    await expect(analyzeRepository(nonExistentId))
      .rejects
      .toThrow(/Repository with id 99999 not found/i);
  });

  it('should update last_analyzed multiple times', async () => {
    // Create a test repository
    const createResult = await db.insert(repositoriesTable)
      .values(testRepositoryData)
      .returning()
      .execute();

    const createdRepo = createResult[0];

    // First analysis
    const firstAnalysis = await analyzeRepository(createdRepo.id);
    expect(firstAnalysis.last_analyzed).toBeInstanceOf(Date);

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Second analysis
    const secondAnalysis = await analyzeRepository(createdRepo.id);
    expect(secondAnalysis.last_analyzed).toBeInstanceOf(Date);

    // Second analysis should have a later timestamp
    expect(secondAnalysis.last_analyzed!.getTime()).toBeGreaterThan(firstAnalysis.last_analyzed!.getTime());
  });

  it('should preserve all other repository fields', async () => {
    // Create a repository with all fields - define with proper types
    const fullRepoData = {
      github_url: 'https://github.com/full/example',
      name: 'full-example',
      description: 'A complete example repository' as string | null,
      owner: 'full-owner',
      default_branch: 'develop'
    };

    const createResult = await db.insert(repositoriesTable)
      .values(fullRepoData)
      .returning()
      .execute();

    const createdRepo = createResult[0];

    // Analyze the repository
    const result = await analyzeRepository(createdRepo.id);

    // All original fields should be preserved
    expect(result.github_url).toEqual(fullRepoData.github_url);
    expect(result.name).toEqual(fullRepoData.name);
    expect(result.description).toEqual(fullRepoData.description);
    expect(result.owner).toEqual(fullRepoData.owner);
    expect(result.default_branch).toEqual(fullRepoData.default_branch);
    expect(result.created_at).toEqual(createdRepo.created_at);
    
    // Only last_analyzed should be updated
    expect(result.last_analyzed).toBeInstanceOf(Date);
    expect(result.last_analyzed).not.toEqual(createdRepo.last_analyzed);
  });

  it('should handle repository with null description', async () => {
    // Create a repository with null description
    const nullDescRepoData = {
      github_url: 'https://github.com/null/example',
      name: 'null-example',
      description: null as string | null,
      owner: 'null-owner',
      default_branch: 'main'
    };

    const createResult = await db.insert(repositoriesTable)
      .values(nullDescRepoData)
      .returning()
      .execute();

    const createdRepo = createResult[0];

    // Analyze the repository
    const result = await analyzeRepository(createdRepo.id);

    // Verify null description is preserved
    expect(result.description).toBeNull();
    expect(result.last_analyzed).toBeInstanceOf(Date);
  });
});