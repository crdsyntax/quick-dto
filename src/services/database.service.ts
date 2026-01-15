import * as mysql from "mysql2/promise";
import { Client as SSHClient } from "ssh2";
import * as fs from "fs";
import { ConnectionConfig, DatabaseConnection } from "../types/database-types";

export class DatabaseService {
  private sshClient?: SSHClient;
  private connection?: mysql.Connection;

  async connect(config: ConnectionConfig): Promise<mysql.Connection> {
    if (config.ssh?.enabled) {
      return await this.connectWithSSH(config);
    } else {
      return await this.connectDirect(config.database);
    }
  }

  private async connectDirect(
    dbConfig: DatabaseConnection
  ): Promise<mysql.Connection> {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
    });
    this.connection = connection;
    return connection;
  }

  private async connectWithSSH(
    config: ConnectionConfig
  ): Promise<mysql.Connection> {
    return new Promise((resolve, reject) => {
      this.sshClient = new SSHClient();

      this.sshClient.on("ready", () => {
        this.sshClient!.forwardOut(
          "127.0.0.1",
          0,
          config.database.host,
          config.database.port,
          async (err, stream) => {
            if (err) {
              reject(err);
              return;
            }

            const connection = await mysql.createConnection({
              user: config.database.user,
              password: config.database.password,
              database: config.database.database,
              stream: stream as any,
            });

            this.connection = connection;
            resolve(connection);
          }
        );
      });

      this.sshClient.on("error", (err) => reject(err));

      const sshConfig: any = {
        host: config.ssh!.host,
        port: config.ssh!.port || 22,
        username: config.ssh!.username,
      };

      if (config.ssh!.privateKeyPath) {
        sshConfig.privateKey = fs.readFileSync(config.ssh!.privateKeyPath);
        if (config.ssh!.passphrase) {
          sshConfig.passphrase = config.ssh!.passphrase;
        }
      }

      this.sshClient.connect(sshConfig);
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
    }
    if (this.sshClient) {
      this.sshClient.end();
    }
  }

  async executeQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
    if (!this.connection) {
      throw new Error("No active database connection");
    }
    const [rows] = await this.connection.execute(query, params);
    return rows as T[];
  }
}
