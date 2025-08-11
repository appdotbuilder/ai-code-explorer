import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { repositoriesTable, codeFilesTable, codeDependenciesTable } from '../db/schema';
import { getDependencyVisualization } from '../handlers/get_dependency_visualization';

describe('getDependencyVisualization', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty visualization for repository with no dependencies', async () => {
    // Create repository with no dependencies
    const repository = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/empty-repo',
        name: 'empty-repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const result = await getDependencyVisualization(repository[0].id);

    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('should generate visualization for repository with dependencies', async () => {
    // Create repository
    const repository = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/sample-repo',
        name: 'sample-repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repoId = repository[0].id;

    // Create code files
    await db.insert(codeFilesTable)
      .values([
        {
          repository_id: repoId,
          path: 'src/main.ts',
          content: 'import utils from "./utils";',
          language: 'typescript',
          size: 100
        },
        {
          repository_id: repoId,
          path: 'src/utils.ts',
          content: 'export default function utils() {}',
          language: 'typescript',
          size: 50
        },
        {
          repository_id: repoId,
          path: 'config/app.json',
          content: '{"name": "test"}',
          language: 'json',
          size: 25
        }
      ])
      .execute();

    // Create dependencies
    await db.insert(codeDependenciesTable)
      .values([
        {
          repository_id: repoId,
          from_file: 'src/main.ts',
          to_file: 'src/utils.ts',
          dependency_type: 'import'
        },
        {
          repository_id: repoId,
          from_file: 'src/main.ts',
          to_file: 'config/app.json',
          dependency_type: 'require'
        }
      ])
      .execute();

    const result = await getDependencyVisualization(repoId);

    // Should have 3 nodes (all files referenced in dependencies)
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);

    // Check nodes
    const nodeIds = result.nodes.map(n => n.id).sort();
    expect(nodeIds).toEqual(['config/app.json', 'src/main.ts', 'src/utils.ts']);

    // Check node labels (should be just filenames)
    const mainNode = result.nodes.find(n => n.id === 'src/main.ts');
    expect(mainNode).toBeDefined();
    expect(mainNode!.label).toBe('main.ts');
    expect(mainNode!.type).toBe('entry'); // Should detect as entry file

    const utilsNode = result.nodes.find(n => n.id === 'src/utils.ts');
    expect(utilsNode).toBeDefined();
    expect(utilsNode!.label).toBe('utils.ts');
    expect(utilsNode!.type).toBe('utility'); // Should detect as utility file

    const configNode = result.nodes.find(n => n.id === 'config/app.json');
    expect(configNode).toBeDefined();
    expect(configNode!.label).toBe('app.json');
    expect(configNode!.type).toBe('config'); // Should detect as config file

    // Check edges
    expect(result.edges).toEqual(
      expect.arrayContaining([
        {
          from: 'src/main.ts',
          to: 'src/utils.ts',
          type: 'import'
        },
        {
          from: 'src/main.ts',
          to: 'config/app.json',
          type: 'require'
        }
      ])
    );
  });

  it('should handle different dependency types correctly', async () => {
    // Create repository
    const repository = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/multi-dep-repo',
        name: 'multi-dep-repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repoId = repository[0].id;

    // Create dependencies with different types
    await db.insert(codeDependenciesTable)
      .values([
        {
          repository_id: repoId,
          from_file: 'main.js',
          to_file: 'module1.js',
          dependency_type: 'import'
        },
        {
          repository_id: repoId,
          from_file: 'main.js',
          to_file: 'module2.js',
          dependency_type: 'require'
        },
        {
          repository_id: repoId,
          from_file: 'base.py',
          to_file: 'derived.py',
          dependency_type: 'inherit'
        },
        {
          repository_id: repoId,
          from_file: 'template.html',
          to_file: 'common.html',
          dependency_type: 'include'
        }
      ])
      .execute();

    const result = await getDependencyVisualization(repoId);

    expect(result.edges).toHaveLength(4);
    
    // Check all dependency types are preserved
    const edgeTypes = result.edges.map(e => e.type).sort();
    expect(edgeTypes).toEqual(['import', 'include', 'inherit', 'require']);
  });

  it('should handle file type detection based on extension', async () => {
    // Create repository
    const repository = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/type-detection-repo',
        name: 'type-detection-repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repoId = repository[0].id;

    // Create files with various extensions
    await db.insert(codeFilesTable)
      .values([
        {
          repository_id: repoId,
          path: 'README.md',
          content: '# Documentation',
          language: 'markdown',
          size: 50
        },
        {
          repository_id: repoId,
          path: 'test/example.test.ts',
          content: 'describe("test", () => {})',
          language: 'typescript',
          size: 75
        }
      ])
      .execute();

    // Create dependencies to include these files
    await db.insert(codeDependenciesTable)
      .values([
        {
          repository_id: repoId,
          from_file: 'index.js',
          to_file: 'README.md',
          dependency_type: 'include'
        },
        {
          repository_id: repoId,
          from_file: 'index.js',
          to_file: 'test/example.test.ts',
          dependency_type: 'import'
        }
      ])
      .execute();

    const result = await getDependencyVisualization(repoId);

    const readmeNode = result.nodes.find(n => n.id === 'README.md');
    expect(readmeNode!.type).toBe('documentation'); // Should detect markdown as documentation

    const testNode = result.nodes.find(n => n.id === 'test/example.test.ts');
    expect(testNode!.type).toBe('test'); // Should detect test file
  });

  it('should use language from database when available', async () => {
    // Create repository
    const repository = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/lang-repo',
        name: 'lang-repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repoId = repository[0].id;

    // Create file with specific language
    await db.insert(codeFilesTable)
      .values({
        repository_id: repoId,
        path: 'script.py',
        content: 'print("hello")',
        language: 'Python',
        size: 20
      })
      .execute();

    // Create dependency
    await db.insert(codeDependenciesTable)
      .values({
        repository_id: repoId,
        from_file: 'main.py',
        to_file: 'script.py',
        dependency_type: 'import'
      })
      .execute();

    const result = await getDependencyVisualization(repoId);

    const scriptNode = result.nodes.find(n => n.id === 'script.py');
    expect(scriptNode!.type).toBe('python'); // Should use lowercased language from DB
  });

  it('should handle non-existent repository gracefully', async () => {
    const result = await getDependencyVisualization(99999);
    
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('should handle complex dependency graphs', async () => {
    // Create repository
    const repository = await db.insert(repositoriesTable)
      .values({
        github_url: 'https://github.com/test/complex-repo',
        name: 'complex-repo',
        owner: 'test',
        default_branch: 'main'
      })
      .returning()
      .execute();

    const repoId = repository[0].id;

    // Create a more complex dependency graph: A -> B -> C, A -> D, C -> D
    await db.insert(codeDependenciesTable)
      .values([
        {
          repository_id: repoId,
          from_file: 'A.js',
          to_file: 'B.js',
          dependency_type: 'import'
        },
        {
          repository_id: repoId,
          from_file: 'B.js',
          to_file: 'C.js',
          dependency_type: 'require'
        },
        {
          repository_id: repoId,
          from_file: 'A.js',
          to_file: 'D.js',
          dependency_type: 'import'
        },
        {
          repository_id: repoId,
          from_file: 'C.js',
          to_file: 'D.js',
          dependency_type: 'import'
        }
      ])
      .execute();

    const result = await getDependencyVisualization(repoId);

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(4);

    // Verify all nodes are present
    const nodeIds = result.nodes.map(n => n.id).sort();
    expect(nodeIds).toEqual(['A.js', 'B.js', 'C.js', 'D.js']);

    // Verify graph structure
    const fromA = result.edges.filter(e => e.from === 'A.js').map(e => e.to).sort();
    expect(fromA).toEqual(['B.js', 'D.js']);

    const toD = result.edges.filter(e => e.to === 'D.js').map(e => e.from).sort();
    expect(toD).toEqual(['A.js', 'C.js']);
  });
});