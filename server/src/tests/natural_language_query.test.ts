import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable, codeFilesTable, codeFunctionsTable, codeIssuesTable } from '../db/schema';
import { type NaturalLanguageQueryInput } from '../schema';
import { naturalLanguageQuery } from '../handlers/natural_language_query';

// Test data
const testRepository = {
  github_url: 'https://github.com/test/repo',
  name: 'test-repo',
  description: 'A test repository',
  owner: 'test-owner',
  default_branch: 'main'
};

const testCodeFiles = [
  {
    repository_id: 1,
    path: '/src/auth/login.js',
    content: 'function authenticate(username, password) { return validateUser(username, password); }',
    language: 'javascript',
    size: 500,
    ai_summary: 'Authentication logic for user login'
  },
  {
    repository_id: 1,
    path: '/src/utils/helpers.js',
    content: 'function validateUser(user, pass) { if (!user || !pass) throw new Error("Invalid input"); }',
    language: 'javascript',
    size: 300,
    ai_summary: 'Helper functions for user validation'
  },
  {
    repository_id: 1,
    path: '/src/database/queries.js',
    content: 'function getUserData(id) { return db.query("SELECT * FROM users WHERE id = ?", [id]); }',
    language: 'javascript',
    size: 200,
    ai_summary: 'Database query functions'
  }
];

const testFunctions = [
  {
    file_id: 1,
    name: 'authenticate',
    signature: 'authenticate(username, password)',
    line_start: 1,
    line_end: 3,
    ai_explanation: 'Main authentication function'
  },
  {
    file_id: 2,
    name: 'validateUser',
    signature: 'validateUser(user, pass)',
    line_start: 1,
    line_end: 5,
    ai_explanation: 'Validates user credentials'
  }
];

const testIssues = [
  {
    file_id: 2,
    issue_type: 'security' as const,
    severity: 'high' as const,
    description: 'Potential SQL injection vulnerability',
    line_number: 3,
    suggestion: 'Use parameterized queries'
  },
  {
    file_id: 1,
    issue_type: 'maintainability' as const,
    severity: 'medium' as const,
    description: 'Function lacks error handling',
    line_number: 2,
    suggestion: 'Add try-catch blocks'
  }
];

describe('naturalLanguageQuery', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should process natural language query and return analysis', async () => {
    // Create test repository
    const [repository] = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();

    // Create test code files
    const codeFilesData = testCodeFiles.map(file => ({
      ...file,
      repository_id: repository.id
    }));
    const [file1, file2] = await db.insert(codeFilesTable)
      .values(codeFilesData)
      .returning()
      .execute();

    // Create test functions
    const functionsData = [
      { ...testFunctions[0], file_id: file1.id },
      { ...testFunctions[1], file_id: file2.id }
    ];
    await db.insert(codeFunctionsTable)
      .values(functionsData)
      .execute();

    // Create test issues
    const issuesData = [
      { ...testIssues[0], file_id: file2.id },
      { ...testIssues[1], file_id: file1.id }
    ];
    await db.insert(codeIssuesTable)
      .values(issuesData)
      .execute();

    const input: NaturalLanguageQueryInput = {
      repository_id: repository.id,
      question: 'How does authentication work in this codebase?'
    };

    const result = await naturalLanguageQuery(input);

    // Verify response structure
    expect(result.summary).toBeTypeOf('string');
    expect(result.key_functions).toBeInstanceOf(Array);
    expect(result.potential_issues).toBeInstanceOf(Array);
    expect(result.suggestions).toBeInstanceOf(Array);
    expect(result.related_files).toBeInstanceOf(Array);

    // Verify content relevance
    expect(result.summary).toMatch(/authentication/i);
    expect(result.key_functions).toContain('authenticate');
    expect(result.key_functions).toContain('validateUser');
    expect(result.potential_issues.length).toBeGreaterThan(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.related_files).toContain('/src/auth/login.js');
  });

  it('should handle query with context files specified', async () => {
    // Create test repository and files
    const [repository] = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();

    const codeFilesData = testCodeFiles.map(file => ({
      ...file,
      repository_id: repository.id
    }));
    await db.insert(codeFilesTable)
      .values(codeFilesData)
      .execute();

    const input: NaturalLanguageQueryInput = {
      repository_id: repository.id,
      question: 'What security issues exist?',
      context_files: ['/src/auth/login.js', '/src/utils/helpers.js']
    };

    const result = await naturalLanguageQuery(input);

    expect(result.summary).toMatch(/security/i);
    expect(result.related_files).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/auth.*login/),
        expect.stringMatching(/utils.*helpers/)
      ])
    );
  });

  it('should return meaningful response when no relevant files found', async () => {
    // Create repository with no code files
    const [repository] = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();

    const input: NaturalLanguageQueryInput = {
      repository_id: repository.id,
      question: 'How does the payment system work?'
    };

    const result = await naturalLanguageQuery(input);

    expect(result.summary).toMatch(/no relevant code files found/i);
    expect(result.key_functions).toHaveLength(0);
    expect(result.potential_issues).toHaveLength(0);
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/detailed file paths/i)
      ])
    );
    expect(result.related_files).toHaveLength(0);
  });

  it('should handle performance-related questions', async () => {
    // Create test data
    const [repository] = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();

    const performanceFile = {
      repository_id: repository.id,
      path: '/src/performance/optimizer.js',
      content: 'function slowOperation() { for(let i = 0; i < 1000000; i++) { /* slow loop */ } }',
      language: 'javascript',
      size: 400,
      ai_summary: 'Performance critical operations'
    };

    await db.insert(codeFilesTable)
      .values(performanceFile)
      .execute();

    const input: NaturalLanguageQueryInput = {
      repository_id: repository.id,
      question: 'What performance issues exist in the code?'
    };

    const result = await naturalLanguageQuery(input);

    expect(result.summary).toMatch(/performance/i);
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/complexity.*optimization/i)
      ])
    );
    expect(result.related_files).toContain('/src/performance/optimizer.js');
  });

  it('should handle security-related questions', async () => {
    // Create test data with security focus
    const [repository] = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();

    const securityFile = {
      repository_id: repository.id,
      path: '/src/security/validator.js',
      content: 'function sanitizeInput(input) { return input.replace(/<script>/g, ""); }',
      language: 'javascript',
      size: 250,
      ai_summary: 'Input sanitization and security validation'
    };

    const [file] = await db.insert(codeFilesTable)
      .values(securityFile)
      .returning()
      .execute();

    // Add security issue
    const securityIssue = {
      file_id: file.id,
      issue_type: 'security' as const,
      severity: 'critical' as const,
      description: 'XSS vulnerability in input sanitization',
      line_number: 1,
      suggestion: 'Use a proper sanitization library'
    };

    await db.insert(codeIssuesTable)
      .values(securityIssue)
      .execute();

    const input: NaturalLanguageQueryInput = {
      repository_id: repository.id,
      question: 'Are there any security vulnerabilities?'
    };

    const result = await naturalLanguageQuery(input);

    expect(result.summary).toMatch(/security/i);
    expect(result.potential_issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/security.*XSS vulnerability/i)
      ])
    );
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/security audit.*authentication/i)
      ])
    );
  });

  it('should throw error for non-existent repository', async () => {
    const input: NaturalLanguageQueryInput = {
      repository_id: 999,
      question: 'How does this work?'
    };

    await expect(naturalLanguageQuery(input)).rejects.toThrow(/repository not found/i);
  });

  it('should limit results appropriately', async () => {
    // Create repository with many files
    const [repository] = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();

    // Create 15 files (more than the limit of 10)
    const manyFiles = Array.from({ length: 15 }, (_, i) => ({
      repository_id: repository.id,
      path: `/src/file${i}.js`,
      content: 'function testFunction() { return "test"; }',
      language: 'javascript',
      size: 100,
      ai_summary: 'Test file for limitation testing'
    }));

    await db.insert(codeFilesTable)
      .values(manyFiles)
      .execute();

    const input: NaturalLanguageQueryInput = {
      repository_id: repository.id,
      question: 'What test functions exist?'
    };

    const result = await naturalLanguageQuery(input);

    // Should limit related files to 5
    expect(result.related_files.length).toBeLessThanOrEqual(5);
    
    // Should limit suggestions to 5
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });

  it('should extract keywords correctly from questions', async () => {
    const [repository] = await db.insert(repositoriesTable)
      .values(testRepository)
      .returning()
      .execute();

    const specificFile = {
      repository_id: repository.id,
      path: '/src/database/connection.js',
      content: 'function connectToDatabase() { return mysql.createConnection(config); }',
      language: 'javascript',
      size: 150,
      ai_summary: 'Database connection management'
    };

    await db.insert(codeFilesTable)
      .values(specificFile)
      .execute();

    const input: NaturalLanguageQueryInput = {
      repository_id: repository.id,
      question: 'How do we connect to the database and what mysql functions are used?'
    };

    const result = await naturalLanguageQuery(input);

    // Should find the database file based on keywords
    expect(result.related_files).toContain('/src/database/connection.js');
    expect(result.summary).toMatch(/database/i);
  });
});