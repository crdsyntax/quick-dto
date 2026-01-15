export interface DatabaseConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface SSHConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  username?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

export interface ConnectionConfig {
  database: DatabaseConnection;
  ssh?: SSHConfig;
}

export interface TransferConfig {
  source: ConnectionConfig;
  target: ConnectionConfig;
  tableName: string; // Table to copy from
  recordId: any; // Record ID to copy
  maxDepth?: number; // Max FK traversal depth
}

export interface TransferProgress {
  tableName: string;
  recordsTransferred: number;
  totalRecords: number;
  status: "pending" | "in-progress" | "completed" | "error";
  error?: string;
}
