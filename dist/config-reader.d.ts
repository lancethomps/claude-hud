export interface ConfigCounts {
    claudeMdCount: number;
    rulesCount: number;
    mcpCount: number;
    hooksCount: number;
}
export interface ConfigDetails {
    claudeMdFiles: string[];
    rulesFiles: string[];
    mcpServers: string[];
    hooks: string[];
}
export interface ConfigResult {
    counts: ConfigCounts;
    details: ConfigDetails;
}
export declare function countConfigs(cwd?: string): Promise<ConfigResult>;
//# sourceMappingURL=config-reader.d.ts.map