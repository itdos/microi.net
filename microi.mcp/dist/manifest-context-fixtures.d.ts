export declare const engineManifest: {
    name: string;
    engines: {
        apiEngineKey: string;
        code: string;
    }[];
};
export declare const toolJson: (result: any) => any;
export declare function harness(options?: {
    identity?: string;
    legacy?: boolean;
    failedValidation?: boolean;
    failWrite?: boolean;
    unknownWrite?: boolean;
    missingBanner?: boolean;
    switchIdentityAt?: string;
}): {
    call: (name: string, input: any) => Promise<any>;
    calls: {
        method: string;
        value: any;
    }[];
    state: {
        identity: string;
    };
    tables: any[];
    fields: any[];
};
export declare const completeManifest: {
    name: string;
    roles: {
        name: string;
    }[];
    tables: ({
        name: string;
        fields: ({
            name: string;
            label: string;
            component: string;
            type: string;
            relation?: undefined;
        } | {
            name: string;
            label: string;
            component: string;
            relation: {
                cardinality: string;
                targetTable: string;
                childForeignKey: string;
                childModule: string;
            };
            type?: undefined;
        })[];
        indexes?: undefined;
    } | {
        name: string;
        fields: {
            name: string;
            label: string;
            component: string;
            type: string;
        }[];
        indexes: {
            name: string;
            columns: string[];
        }[];
    })[];
    modules: ({
        name: string;
        openType: string;
        table?: undefined;
        parentName?: undefined;
        listFields?: undefined;
        display?: undefined;
        appDisplay?: undefined;
        hasChild?: undefined;
    } | {
        name: string;
        table: string;
        parentName: string;
        listFields: string[];
        openType?: undefined;
        display?: undefined;
        appDisplay?: undefined;
        hasChild?: undefined;
    } | {
        name: string;
        table: string;
        display: number;
        appDisplay: number;
        hasChild: number;
        openType?: undefined;
        parentName?: undefined;
        listFields?: undefined;
    })[];
    engines: {
        apiEngineKey: string;
        code: string;
    }[];
    events: {
        formEngineKey: string;
        eventType: string;
        code: string;
    }[];
    dataSources: {
        dataSourceKey: string;
        sourceType: string;
        json: string;
    }[];
    permissions: {
        roleName: string;
        moduleNames: string[];
    }[];
    pages: {
        title: string;
        json: {
            formConfig: {};
            wrapperList: never[];
        };
    }[];
    printTemplates: {
        title: string;
        PageObj: {
            panels: {
                index: number;
                height: number;
                width: number;
                printElements: never[];
            }[];
        };
        PrintObj: {};
    }[];
    workflows: {
        FlowDesign: {
            FlowName: string;
            table: string;
        };
        Nodes: {
            Id: string;
            NodeName: string;
            NodeType: string;
        }[];
        Lines: {
            FromNodeId: string;
            ToNodeId: string;
            LineName: string;
        }[];
    }[];
    jobs: {
        jobName: string;
        apiEngineKey: string;
        cron: string;
    }[];
};
//# sourceMappingURL=manifest-context-fixtures.d.ts.map