export const DEFAULT_AI_WORKFLOW_GRAPH_LIMIT = 240;
export const MAX_AI_WORKFLOW_GRAPH_LIMIT = 600;

const TYPE_ORDER = [
    "menu",
    "table",
    "engine",
    "workflow",
    "field",
    "v8-event",
    "engine-missing",
    "page",
    "print"
];

function boundedLimit(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_AI_WORKFLOW_GRAPH_LIMIT;
    return Math.min(parsed, MAX_AI_WORKFLOW_GRAPH_LIMIT);
}

function balancedNodes(nodes, limit) {
    const groups = new Map();
    (nodes || []).forEach((node) => {
        const type = String(node?.Type || "table");
        if (!groups.has(type)) groups.set(type, []);
        groups.get(type).push(node);
    });
    const orderedTypes = [
        ...TYPE_ORDER.filter((type) => groups.has(type)),
        ...Array.from(groups.keys()).filter((type) => !TYPE_ORDER.includes(type))
    ];
    const selected = [];
    let index = 0;
    while (selected.length < limit) {
        let added = false;
        orderedTypes.forEach((type) => {
            const group = groups.get(type) || [];
            if (selected.length < limit && index < group.length) {
                selected.push(group[index]);
                added = true;
            }
        });
        if (!added) break;
        index += 1;
    }
    return selected;
}

function compactResource(resource) {
    const source = resource && typeof resource === "object" ? resource : {};
    const result = {};
    [
        "Id", "Name", "Description", "Remark", "TableName", "ApiName",
        "ApiEngineKey", "FlowName", "Category", "ComponentPath", "UpdateTime"
    ].forEach((key) => {
        if (source[key] !== undefined && source[key] !== null) result[key] = source[key];
    });
    return result;
}

function compactNode(node) {
    const source = node && typeof node === "object" ? node : {};
    const { Resource, Details, ...summary } = source;
    return {
        ...summary,
        Resource: compactResource(Resource),
        Details: {},
        DetailLoaded: false
    };
}

function inventoryFromNodes(nodes) {
    const inventory = {
        Tables: [],
        Fields: [],
        Menus: [],
        ApiEngines: [],
        Workflows: [],
        WorkflowNodes: [],
        WorkflowLines: [],
        Pages: [],
        Prints: []
    };
    const seen = new Set();
    (nodes || []).forEach((node) => {
        const resource = node.Resource || {};
        const key = `${node.Type}:${resource.Id || resource.ApiEngineKey || node.Id}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (node.Type === "table") inventory.Tables.push(resource);
        else if (node.Type === "menu") inventory.Menus.push(resource);
        else if (node.Type === "engine") inventory.ApiEngines.push(resource);
        else if (node.Type === "workflow") inventory.Workflows.push(resource);
        else if (node.Type === "page") inventory.Pages.push(resource);
        else if (node.Type === "print") inventory.Prints.push(resource);
    });
    return inventory;
}

export function createBoundedAiWorkflowOverview(payload, requestedLimit) {
    const source = payload && typeof payload === "object" ? payload : {};
    const graph = source.Graph && typeof source.Graph === "object" ? source.Graph : {};
    const sourceNodes = Array.isArray(graph.Nodes) ? graph.Nodes : [];
    const sourceEdges = Array.isArray(graph.Edges) ? graph.Edges : [];
    const limit = boundedLimit(requestedLimit);
    const nodes = balancedNodes(sourceNodes, limit).map(compactNode);
    const nodeIds = new Set(nodes.map((node) => node.Id));
    const edgeLimit = limit * 4;
    const edges = sourceEdges
        .filter((edge) => nodeIds.has(edge?.Source) && nodeIds.has(edge?.Target))
        .slice(0, edgeLimit);
    const sourceStats = source.Stats && typeof source.Stats === "object" ? source.Stats : {};
    const availableNodeCount = Math.max(
        Number(sourceStats.AvailableGraphNodeCount || sourceStats.GraphNodeCount || 0),
        sourceNodes.length
    );
    const availableEdgeCount = Math.max(
        Number(sourceStats.AvailableGraphEdgeCount || sourceStats.GraphEdgeCount || 0),
        sourceEdges.length
    );
    const graphTruncated = source.GraphTruncated === true
        || availableNodeCount > nodes.length
        || availableEdgeCount > edges.length;
    const nextGraph = {
        ...graph,
        Nodes: nodes,
        Edges: edges
    };
    return {
        ...source,
        Graph: nextGraph,
        Inventory: inventoryFromNodes(nodes),
        GraphTruncated: graphTruncated,
        Stats: {
            ...sourceStats,
            AvailableGraphNodeCount: availableNodeCount,
            AvailableGraphEdgeCount: availableEdgeCount,
            RenderedGraphNodeCount: nodes.length,
            RenderedGraphEdgeCount: edges.length
        }
    };
}
