import { DatabaseService } from "../services/database.service";
import { TransferConfig, TransferProgress } from "../types/database-types";

interface ForeignKeyRelation {
  tableName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

interface TableNode {
  tableName: string;
  level: number;
  records: any[];
}

export class TransferEngine {
  private sourceDb: DatabaseService;
  private targetDb: DatabaseService;
  private progressCallback?: (progress: TransferProgress) => void;
  private maxDepth: number = 10;
  private visitedRecords: Map<string, Set<any>> = new Map();

  constructor() {
    this.sourceDb = new DatabaseService();
    this.targetDb = new DatabaseService();
  }

  setProgressCallback(callback: (progress: TransferProgress) => void) {
    this.progressCallback = callback;
  }

  async transfer(config: TransferConfig): Promise<void> {
    this.maxDepth = config.maxDepth || 10;
    this.visitedRecords.clear();

    try {
      await this.sourceDb.connect(config.source);
      await this.targetDb.connect(config.target);

      const dbName = config.source.database.database;

      // Disable FK checks and start transaction
      await this.targetDb.executeQuery("SET FOREIGN_KEY_CHECKS=0");
      await this.targetDb.executeQuery("START TRANSACTION");

      try {
        // Build dependency graph dynamically
        const dependencyGraph = await this.buildDependencyGraph(
          config.tableName,
          config.recordId,
          dbName
        );

        // Sort by level (parents first)
        const sortedNodes = dependencyGraph.sort((a, b) => a.level - b.level);

        // Transfer each table's records
        for (const node of sortedNodes) {
          if (node.records.length > 0) {
            await this.transferTableRecords(node);
          }
        }

        await this.targetDb.executeQuery("COMMIT");
        await this.targetDb.executeQuery("SET FOREIGN_KEY_CHECKS=1");
      } catch (error) {
        await this.targetDb.executeQuery("ROLLBACK");
        await this.targetDb.executeQuery("SET FOREIGN_KEY_CHECKS=1");
        throw error;
      }
    } finally {
      await this.sourceDb.disconnect();
      await this.targetDb.disconnect();
    }
  }

  /**
   * Recursively discovers FK relationships and builds dependency graph
   */
  private async buildDependencyGraph(
    rootTable: string,
    rootId: any,
    dbName: string,
    level: number = 1
  ): Promise<TableNode[]> {
    if (level > this.maxDepth) {
      return [];
    }

    // Track visited records to avoid circular references
    const tableKey = `${rootTable}:${rootId}`;
    if (!this.visitedRecords.has(rootTable)) {
      this.visitedRecords.set(rootTable, new Set());
    }
    if (this.visitedRecords.get(rootTable)!.has(rootId)) {
      return [];
    }
    this.visitedRecords.get(rootTable)!.add(rootId);

    const nodes: TableNode[] = [];

    // 1. Fetch the root record
    const records = await this.sourceDb.executeQuery(
      `SELECT * FROM ${rootTable} WHERE id = ?`,
      [rootId]
    );

    if (records.length === 0) {
      return [];
    }

    // 2. Discover foreign keys FROM other tables TO this table (children)
    const childForeignKeys = await this.discoverChildForeignKeys(
      rootTable,
      dbName
    );

    // 3. Create node for current table
    const currentNode: TableNode = {
      tableName: rootTable,
      level: level,
      records: records,
    };
    nodes.push(currentNode);

    // 4. Recursively fetch child records
    for (const fk of childForeignKeys) {
      const childRecords = await this.sourceDb.executeQuery(
        `SELECT * FROM ${fk.tableName} WHERE ${fk.columnName} = ?`,
        [rootId]
      );

      for (const childRecord of childRecords) {
        const childNodes = await this.buildDependencyGraph(
          fk.tableName,
          childRecord.id,
          dbName,
          level + 1
        );
        nodes.push(...childNodes);
      }
    }

    return nodes;
  }

  /**
   * Queries information_schema to find all FK constraints pointing TO this table
   */
  private async discoverChildForeignKeys(
    tableName: string,
    dbName: string
  ): Promise<ForeignKeyRelation[]> {
    const query = `
      SELECT 
        TABLE_NAME as tableName,
        COLUMN_NAME as columnName,
        REFERENCED_TABLE_NAME as referencedTable,
        REFERENCED_COLUMN_NAME as referencedColumn
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND REFERENCED_TABLE_NAME = ?
        AND REFERENCED_COLUMN_NAME IS NOT NULL
    `;

    const results = await this.sourceDb.executeQuery<any>(query, [
      dbName,
      tableName,
    ]);

    return results.map((row) => ({
      tableName: row.tableName,
      columnName: row.columnName,
      referencedTable: row.referencedTable,
      referencedColumn: row.referencedColumn,
    }));
  }

  /**
   * Transfers all records for a specific table node
   */
  private async transferTableRecords(node: TableNode): Promise<void> {
    this.reportProgress({
      tableName: node.tableName,
      recordsTransferred: 0,
      totalRecords: node.records.length,
      status: "in-progress",
    });

    try {
      for (let i = 0; i < node.records.length; i++) {
        const record = node.records[i];
        const columns = Object.keys(record);
        const values = Object.values(record);
        const placeholders = columns.map(() => "?").join(", ");

        // Use INSERT IGNORE to skip duplicates
        const insertQuery = `
          INSERT IGNORE INTO ${node.tableName} (${columns.join(", ")})
          VALUES (${placeholders})
        `;

        await this.targetDb.executeQuery(insertQuery, values);

        this.reportProgress({
          tableName: node.tableName,
          recordsTransferred: i + 1,
          totalRecords: node.records.length,
          status: "in-progress",
        });
      }

      this.reportProgress({
        tableName: node.tableName,
        recordsTransferred: node.records.length,
        totalRecords: node.records.length,
        status: "completed",
      });
    } catch (error) {
      this.reportProgress({
        tableName: node.tableName,
        recordsTransferred: 0,
        totalRecords: 0,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private reportProgress(progress: TransferProgress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
}
