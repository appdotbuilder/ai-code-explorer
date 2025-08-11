import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable, codeFilesTable, codeFunctionsTable } from '../db/schema';
import { type CreateRepositoryInput, type CreateCodeFileInput } from '../schema';
import { analyzeCodeFile } from '../handlers/analyze_code_file';
import { eq } from 'drizzle-orm';

// Test data
const testRepository: CreateRepositoryInput = {
  github_url: 'https://github.com/test/repo',
  name: 'Test Repository',
  description: 'A repository for testing',
  owner: 'testowner',
  default_branch: 'main'
};

const simpleCodeContent = `
import { utils } from './utils';

function hello(name) {
  if (name) {
    return "Hello, " + name;
  }
  return "Hello, World!";
}

const greet = (person) => {
  return hello(person);
};

export { hello, greet };
`;

const complexCodeContent = `
import { db } from './database';
import { logger } from './logger';

class UserService {
  async createUser(userData) {
    try {
      if (!userData.email) {
        throw new Error('Email is required');
      }
      
      for (let i = 0; i < userData.preferences.length; i++) {
        if (userData.preferences[i].isDefault) {
          switch (userData.preferences[i].type) {
            case 'theme':
              this.setTheme(userData.preferences[i].value);
              break;
            case 'language':
              this.setLanguage(userData.preferences[i].value);
              break;
            default:
              logger.warn('Unknown preference type');
          }
        }
      }
      
      while (this.isProcessing()) {
        await this.waitForCompletion();
      }
      
      return await db.users.create(userData);
    } catch (error) {
      logger.error('User creation failed', error);
      throw error;
    }
  }
}

export function validateUser(user) {
  if (!user) return false;
  if (!user.email) return false;
  return true;
}
`;

describe('analyzeCodeFile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let repositoryId: number;
  let simpleFileId: number;
  let complexFileId: number;

  beforeEach(async () => {
    // Create test repository
    const repositories = await db.insert(repositoriesTable)
      .values({
        github_url: testRepository.github_url,
        name: testRepository.name,
        description: testRepository.description,
        owner: testRepository.owner,
        default_branch: testRepository.default_branch
      })
      .returning()
      .execute();

    repositoryId = repositories[0].id;

    // Create test code files
    const simpleFile = await db.insert(codeFilesTable)
      .values({
        repository_id: repositoryId,
        path: 'simple.js',
        content: simpleCodeContent,
        language: 'javascript',
        size: simpleCodeContent.length
      })
      .returning()
      .execute();

    const complexFile = await db.insert(codeFilesTable)
      .values({
        repository_id: repositoryId,
        path: 'complex.js',
        content: complexCodeContent,
        language: 'javascript',
        size: complexCodeContent.length
      })
      .returning()
      .execute();

    simpleFileId = simpleFile[0].id;
    complexFileId = complexFile[0].id;
  });

  it('should analyze a simple code file and update with AI summary', async () => {
    const result = await analyzeCodeFile(simpleFileId);

    // Verify basic properties
    expect(result.id).toEqual(simpleFileId);
    expect(result.repository_id).toEqual(repositoryId);
    expect(result.path).toEqual('simple.js');
    expect(result.language).toEqual('javascript');

    // Verify AI analysis was added
    expect(result.ai_summary).toBeDefined();
    expect(result.ai_summary).toContain('javascript file');
    expect(result.ai_summary).toContain('includes external dependencies');
    expect(result.ai_summary).toContain('exports functionality');
    expect(result.ai_summary).toContain('function definitions');

    // Verify complexity score was calculated
    expect(result.complexity_score).toBeDefined();
    if (result.complexity_score !== null) {
      expect(typeof result.complexity_score).toBe('number');
      expect(result.complexity_score).toBeGreaterThan(0);
    }

    // Verify last_updated was updated
    expect(result.last_updated).toBeInstanceOf(Date);
  });

  it('should calculate higher complexity for complex code', async () => {
    const simpleResult = await analyzeCodeFile(simpleFileId);
    const complexResult = await analyzeCodeFile(complexFileId);

    if (complexResult.complexity_score && simpleResult.complexity_score) {
      expect(complexResult.complexity_score).toBeGreaterThan(simpleResult.complexity_score);
    }
    expect(complexResult.ai_summary).toContain('includes external dependencies');
    expect(complexResult.ai_summary).toContain('defines classes');
  });

  it('should extract functions from code and save them', async () => {
    await analyzeCodeFile(simpleFileId);

    // Check that functions were extracted and saved
    const functions = await db.select()
      .from(codeFunctionsTable)
      .where(eq(codeFunctionsTable.file_id, simpleFileId))
      .execute();

    expect(functions.length).toBeGreaterThan(0);

    // Find specific functions
    const helloFunction = functions.find(f => f.name === 'hello');
    const greetFunction = functions.find(f => f.name === 'greet');

    expect(helloFunction).toBeDefined();
    if (helloFunction) {
      expect(helloFunction.signature).toContain('function hello(name)');
      expect(helloFunction.line_start).toBeGreaterThan(0);
      expect(helloFunction.line_end).toBeGreaterThan(helloFunction.line_start);
    }

    expect(greetFunction).toBeDefined();
    if (greetFunction) {
      expect(greetFunction.signature).toContain('const greet = (person) =>');
    }
  });

  it('should extract functions from complex code', async () => {
    await analyzeCodeFile(complexFileId);

    const functions = await db.select()
      .from(codeFunctionsTable)
      .where(eq(codeFunctionsTable.file_id, complexFileId))
      .execute();

    expect(functions.length).toBeGreaterThan(0);

    const validateFunction = functions.find(f => f.name === 'validateUser');
    expect(validateFunction).toBeDefined();
    if (validateFunction) {
      expect(validateFunction.signature).toContain('function validateUser(user)');
    }
  });

  it('should persist analysis results to database', async () => {
    const result = await analyzeCodeFile(simpleFileId);

    // Query database directly to verify persistence
    const files = await db.select()
      .from(codeFilesTable)
      .where(eq(codeFilesTable.id, simpleFileId))
      .execute();

    expect(files).toHaveLength(1);
    const savedFile = files[0];

    expect(savedFile.ai_summary).toBeDefined();
    expect(savedFile.complexity_score).toBeDefined();
    if (savedFile.complexity_score && result.complexity_score !== null) {
      expect(parseFloat(savedFile.complexity_score)).toEqual(result.complexity_score);
    }
    expect(savedFile.last_updated).toBeInstanceOf(Date);
  });

  it('should handle files without recognized language', async () => {
    // Create file with null language
    const fileWithoutLanguage = await db.insert(codeFilesTable)
      .values({
        repository_id: repositoryId,
        path: 'unknown.txt',
        content: 'Some generic content\nwith multiple lines',
        language: null,
        size: 50
      })
      .returning()
      .execute();

    const result = await analyzeCodeFile(fileWithoutLanguage[0].id);

    expect(result.ai_summary).toBeDefined();
    expect(result.ai_summary).toContain('code file');
    expect(result.complexity_score).toBeDefined();
    if (result.complexity_score !== null) {
      expect(result.complexity_score).toBeGreaterThan(0);
    }
  });

  it('should handle empty or minimal code files', async () => {
    const minimalFile = await db.insert(codeFilesTable)
      .values({
        repository_id: repositoryId,
        path: 'minimal.js',
        content: '// Just a comment',
        language: 'javascript',
        size: 17
      })
      .returning()
      .execute();

    const result = await analyzeCodeFile(minimalFile[0].id);

    expect(result.ai_summary).toBeDefined();
    expect(result.complexity_score).toBeDefined();
    if (result.complexity_score !== null) {
      expect(result.complexity_score).toEqual(1); // Base complexity for simple content
    }
  });

  it('should throw error for non-existent file', async () => {
    const nonExistentFileId = 99999;

    await expect(analyzeCodeFile(nonExistentFileId))
      .rejects
      .toThrow(/Code file with ID 99999 not found/i);
  });

  it('should update existing analysis when run multiple times', async () => {
    // First analysis
    const firstResult = await analyzeCodeFile(simpleFileId);
    const firstUpdated = firstResult.last_updated;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Second analysis
    const secondResult = await analyzeCodeFile(simpleFileId);

    expect(secondResult.id).toEqual(firstResult.id);
    if (firstUpdated) {
      expect(secondResult.last_updated.getTime()).toBeGreaterThan(firstUpdated.getTime());
    }
    expect(secondResult.ai_summary).toEqual(firstResult.ai_summary); // Same content = same analysis
    if (secondResult.complexity_score !== null && firstResult.complexity_score !== null) {
      expect(secondResult.complexity_score).toEqual(firstResult.complexity_score);
    }
  });

  it('should handle code with various control flow structures', async () => {
    const controlFlowCode = `
    function complexLogic(data) {
      if (data.length > 0) {
        for (let i = 0; i < data.length; i++) {
          while (data[i].processing) {
            switch (data[i].status) {
              case 'pending':
                try {
                  processItem(data[i]);
                } catch (error) {
                  handleError(error);
                }
                break;
              case 'complete':
                return data[i];
            }
          }
        }
      }
    }
    `;

    const complexControlFile = await db.insert(codeFilesTable)
      .values({
        repository_id: repositoryId,
        path: 'control-flow.js',
        content: controlFlowCode,
        language: 'javascript',
        size: controlFlowCode.length
      })
      .returning()
      .execute();

    const result = await analyzeCodeFile(complexControlFile[0].id);

    // Should have high complexity due to multiple control structures
    if (result.complexity_score !== null) {
      expect(result.complexity_score).toBeGreaterThan(5);
    }
    expect(result.ai_summary).toContain('function definitions');
  });
});