import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import type { Repository, DependencyVisualization as DependencyData } from '../../../server/src/schema';

interface DependencyVisualizationProps {
  repository: Repository;
}

interface NodeStats {
  totalNodes: number;
  nodeTypes: Record<string, number>;
  totalEdges: number;
  edgeTypes: Record<string, number>;
}

export function DependencyVisualization({ repository }: DependencyVisualizationProps) {
  const [dependencyData, setDependencyData] = useState<DependencyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [stats, setStats] = useState<NodeStats | null>(null);

  const loadDependencies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await trpc.getDependencyVisualization.query({ 
        repositoryId: repository.id 
      });
      setDependencyData(result);
      
      // Calculate stats
      const nodeTypes: Record<string, number> = {};
      const edgeTypes: Record<string, number> = {};
      
      result.nodes.forEach(node => {
        nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
      });
      
      result.edges.forEach(edge => {
        edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
      });
      
      setStats({
        totalNodes: result.nodes.length,
        nodeTypes,
        totalEdges: result.edges.length,
        edgeTypes
      });
    } catch (error) {
      console.error('Failed to load dependencies:', error);
      setError('Failed to load dependency visualization');
      setDependencyData(null);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [repository.id]);

  useEffect(() => {
    loadDependencies();
  }, [loadDependencies]);

  const getNodeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      entry: 'bg-green-500',
      utility: 'bg-blue-500',
      config: 'bg-purple-500',
      component: 'bg-orange-500',
      service: 'bg-red-500',
      model: 'bg-yellow-500',
      test: 'bg-gray-500',
      default: 'bg-slate-500'
    };
    return colors[type] || colors.default;
  };

  const getEdgeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      import: 'border-blue-400 bg-blue-50',
      require: 'border-green-400 bg-green-50',
      include: 'border-purple-400 bg-purple-50',
      extend: 'border-orange-400 bg-orange-50',
      inherit: 'border-red-400 bg-red-50'
    };
    return colors[type] || 'border-gray-400 bg-gray-50';
  };

  const getConnectedNodes = (nodeId: string) => {
    if (!dependencyData) return { incoming: [], outgoing: [] };
    
    const incoming = dependencyData.edges
      .filter(edge => edge.to === nodeId)
      .map(edge => edge.from);
    
    const outgoing = dependencyData.edges
      .filter(edge => edge.from === nodeId)
      .map(edge => edge.to);
    
    return { incoming, outgoing };
  };

  const selectedNodeData = selectedNode 
    ? dependencyData?.nodes.find(node => node.id === selectedNode)
    : null;

  const selectedNodeConnections = selectedNode 
    ? getConnectedNodes(selectedNode)
    : { incoming: [], outgoing: [] };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                🕸️ Dependency Visualization
              </CardTitle>
              <CardDescription>
                Explore the dependency graph for {repository.name}
              </CardDescription>
            </div>
            <Button
              onClick={loadDependencies}
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? '🔄 Loading...' : '🔄 Refresh'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📊 Dependency Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.totalNodes}</div>
                <div className="text-sm text-blue-800">Total Files</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.totalEdges}</div>
                <div className="text-sm text-green-800">Dependencies</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {Object.keys(stats.nodeTypes).length}
                </div>
                <div className="text-sm text-orange-800">File Types</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round((stats.totalEdges / stats.totalNodes) * 100) / 100}
                </div>
                <div className="text-sm text-purple-800">Avg. Dependencies</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {dependencyData ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Node List */}
          <div className="lg:col-span-1">
            <Card className="h-[600px]">
              <CardHeader>
                <CardTitle className="text-lg">📁 Files & Modules</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[520px]">
                  <div className="space-y-1 p-1">
                    {dependencyData.nodes.map((node) => (
                      <div
                        key={node.id}
                        className={`p-3 rounded cursor-pointer transition-colors ${
                          selectedNode === node.id 
                            ? 'bg-blue-50 border border-blue-200' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedNode(node.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate" title={node.label}>
                            {node.label}
                          </span>
                          <Badge 
                            className={`text-white text-xs ${getNodeTypeColor(node.type)}`}
                          >
                            {node.type}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {getConnectedNodes(node.id).incoming.length} incoming • {' '}
                          {getConnectedNodes(node.id).outgoing.length} outgoing
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Dependency Details */}
          <div className="lg:col-span-2">
            <Card className="h-[600px]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  🔍 Dependency Details
                  {selectedNodeData && (
                    <Badge className={`text-white ${getNodeTypeColor(selectedNodeData.type)}`}>
                      {selectedNodeData.type}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedNodeData ? (
                  <Tabs defaultValue="connections" className="h-[500px]">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="connections">Connections</TabsTrigger>
                      <TabsTrigger value="incoming">Incoming</TabsTrigger>
                      <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
                    </TabsList>

                    <TabsContent value="connections" className="mt-4 space-y-4">
                      <div className="text-center">
                        <h3 className="text-xl font-semibold mb-2">{selectedNodeData.label}</h3>
                        <Badge className={`${getNodeTypeColor(selectedNodeData.type)} text-white`}>
                          {selectedNodeData.type}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {selectedNodeConnections.incoming.length}
                          </div>
                          <div className="text-sm text-green-800">Files depend on this</div>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {selectedNodeConnections.outgoing.length}
                          </div>
                          <div className="text-sm text-blue-800">This depends on</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-medium">All Connections:</h4>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {dependencyData.edges
                              .filter(edge => edge.from === selectedNode || edge.to === selectedNode)
                              .map((edge, index) => {
                                const isIncoming = edge.to === selectedNode;
                                const connectedNode = isIncoming ? edge.from : edge.to;
                                const connectedNodeData = dependencyData.nodes.find(n => n.id === connectedNode);
                                
                                return (
                                  <div 
                                    key={index} 
                                    className={`p-3 rounded border ${getEdgeTypeColor(edge.type)}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">
                                          {isIncoming ? '⬅️' : '➡️'}
                                        </span>
                                        <span className="font-medium text-sm">
                                          {connectedNodeData?.label || connectedNode}
                                        </span>
                                      </div>
                                      <Badge variant="outline" className="text-xs">
                                        {edge.type}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {isIncoming ? 'Depends on this file' : 'This file depends on it'}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>

                    <TabsContent value="incoming" className="mt-4">
                      <ScrollArea className="h-[450px]">
                        {selectedNodeConnections.incoming.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="text-4xl mb-4">📥</div>
                            <h3 className="text-lg font-medium mb-2">No Incoming Dependencies</h3>
                            <p className="text-muted-foreground">
                              No other files depend on this one
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <h4 className="font-medium">
                              Files that depend on {selectedNodeData.label}:
                            </h4>
                            {selectedNodeConnections.incoming.map((nodeId) => {
                              const node = dependencyData.nodes.find(n => n.id === nodeId);
                              const edge = dependencyData.edges.find(e => 
                                e.from === nodeId && e.to === selectedNode
                              );
                              return (
                                <div 
                                  key={nodeId}
                                  className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                                  onClick={() => setSelectedNode(nodeId)}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{node?.label || nodeId}</span>
                                    <div className="flex gap-2">
                                      <Badge variant="outline">{edge?.type}</Badge>
                                      <Badge className={`text-white ${getNodeTypeColor(node?.type || 'default')}`}>
                                        {node?.type}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="outgoing" className="mt-4">
                      <ScrollArea className="h-[450px]">
                        {selectedNodeConnections.outgoing.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="text-4xl mb-4">📤</div>
                            <h3 className="text-lg font-medium mb-2">No Outgoing Dependencies</h3>
                            <p className="text-muted-foreground">
                              This file doesn't depend on other files
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <h4 className="font-medium">
                              {selectedNodeData.label} depends on:
                            </h4>
                            {selectedNodeConnections.outgoing.map((nodeId) => {
                              const node = dependencyData.nodes.find(n => n.id === nodeId);
                              const edge = dependencyData.edges.find(e => 
                                e.from === selectedNode && e.to === nodeId
                              );
                              return (
                                <div 
                                  key={nodeId}
                                  className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                                  onClick={() => setSelectedNode(nodeId)}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{node?.label || nodeId}</span>
                                    <div className="flex gap-2">
                                      <Badge variant="outline">{edge?.type}</Badge>
                                      <Badge className={`text-white ${getNodeTypeColor(node?.type || 'default')}`}>
                                        {node?.type}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4">
                      <div className="text-6xl">👈</div>
                      <h3 className="text-xl font-medium">Select a File</h3>
                      <p className="text-muted-foreground">
                        Choose a file from the list to explore its dependencies
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : !isLoading ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="space-y-4">
              <div className="text-6xl">🕸️</div>
              <h3 className="text-xl font-semibold">No Dependency Data</h3>
              <p className="text-muted-foreground">
                No dependency information available for this repository yet
              </p>
              <Button onClick={loadDependencies} className="bg-blue-600 hover:bg-blue-700">
                🔄 Load Dependencies
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <div className="space-y-4">
              <div className="text-4xl">🔄</div>
              <h3 className="text-lg font-medium">Loading Dependencies...</h3>
              <Progress value={33} className="w-64 mx-auto" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dependency Type Legend */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🎨 Legend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">File Types:</h4>
                <div className="space-y-2">
                  {Object.entries(stats.nodeTypes).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${getNodeTypeColor(type)}`}></div>
                        <span className="text-sm capitalize">{type}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-3">Dependency Types:</h4>
                <div className="space-y-2">
                  {Object.entries(stats.edgeTypes).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded border-2 ${getEdgeTypeColor(type).split(' ')[0]}`}></div>
                        <span className="text-sm capitalize">{type}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}