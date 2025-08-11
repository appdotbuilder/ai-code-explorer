import { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import type { Repository, CreateRepositoryInput } from '../../../server/src/schema';

interface RepositoryManagerProps {
  repository?: Repository;
  onRepositoryCreated: (repository: Repository) => void;
  onRepositoriesRefresh: () => void;
}

export function RepositoryManager({ 
  repository, 
  onRepositoryCreated, 
  onRepositoriesRefresh 
}: RepositoryManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CreateRepositoryInput>({
    github_url: '',
    name: '',
    description: null,
    owner: '',
    default_branch: 'main'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await trpc.createRepository.mutate(formData);
      onRepositoryCreated(response);
      setSuccess('Repository added successfully! 🎉');
      
      // Reset form
      setFormData({
        github_url: '',
        name: '',
        description: null,
        owner: '',
        default_branch: 'main'
      });
    } catch (error) {
      console.error('Failed to create repository:', error);
      setError('Failed to add repository. Please check the URL and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGitHubUrlChange = (url: string) => {
    setFormData((prev: CreateRepositoryInput) => ({ ...prev, github_url: url }));
    
    // Auto-extract repo info from GitHub URL
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      const owner = match[1];
      const name = match[2]?.replace(/\.git$/, '');
      if (owner && name) {
        setFormData((prev: CreateRepositoryInput) => ({
          ...prev,
          owner,
          name
        }));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Add New Repository */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ➕ Add New Repository
          </CardTitle>
          <CardDescription>
            Add a GitHub repository to analyze and explore with AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-4 border-green-200 bg-green-50">
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="github_url">GitHub URL *</Label>
              <Input
                id="github_url"
                type="url"
                placeholder="https://github.com/username/repository"
                value={formData.github_url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                  handleGitHubUrlChange(e.target.value)
                }
                required
              />
              <p className="text-sm text-muted-foreground">
                Enter the full GitHub repository URL
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner">Owner *</Label>
                <Input
                  id="owner"
                  placeholder="username or organization"
                  value={formData.owner}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateRepositoryInput) => ({ 
                      ...prev, 
                      owner: e.target.value 
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Repository Name *</Label>
                <Input
                  id="name"
                  placeholder="repository-name"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateRepositoryInput) => ({ 
                      ...prev, 
                      name: e.target.value 
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Brief description of the repository"
                  value={formData.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateRepositoryInput) => ({ 
                      ...prev, 
                      description: e.target.value || null 
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default_branch">Default Branch</Label>
                <Input
                  id="default_branch"
                  placeholder="main"
                  value={formData.default_branch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: CreateRepositoryInput) => ({ 
                      ...prev, 
                      default_branch: e.target.value 
                    }))
                  }
                />
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isCreating}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isCreating ? '🔄 Adding Repository...' : '🚀 Add Repository'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Current Repository Info */}
      {repository && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📋 Repository Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="text-lg font-semibold">{repository.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Owner</Label>
                  <p className="text-lg">{repository.owner}</p>
                </div>
              </div>

              {repository.description && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                  <p className="text-sm">{repository.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Default Branch</Label>
                  <p className="text-sm">{repository.default_branch}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                  <p className="text-sm">{repository.created_at.toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Last Analyzed</Label>
                  <p className="text-sm">
                    {repository.last_analyzed 
                      ? repository.last_analyzed.toLocaleDateString()
                      : 'Not analyzed yet'
                    }
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium text-muted-foreground">GitHub URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1">
                    {repository.github_url}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(repository.github_url, '_blank')}
                  >
                    🔗 Open
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}