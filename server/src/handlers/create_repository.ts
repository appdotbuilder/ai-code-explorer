import { db } from '../db';
import { repositoriesTable } from '../db/schema';
import { type CreateRepositoryInput, type Repository, createRepositoryInputSchema } from '../schema';

export const createRepository = async (input: CreateRepositoryInput): Promise<Repository> => {
  try {
    // Parse input to apply Zod defaults
    const parsedInput = createRepositoryInputSchema.parse(input);
    
    // Insert repository record
    const result = await db.insert(repositoriesTable)
      .values({
        github_url: parsedInput.github_url,
        name: parsedInput.name,
        description: parsedInput.description || null,
        owner: parsedInput.owner,
        default_branch: parsedInput.default_branch
      })
      .returning()
      .execute();

    const repository = result[0];
    return repository;
  } catch (error) {
    console.error('Repository creation failed:', error);
    throw error;
  }
};