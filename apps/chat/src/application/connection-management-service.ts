import type {
  ElectronAPI,
  ConnectionSave,
  OperationResult,
} from "../../electron/electron-api";

export type ConnectionGateway = Pick<
  ElectronAPI,
  | "getConnections"
  | "saveConnection"
  | "connectConnection"
  | "disconnectConnection"
  | "setConnectionEnabled"
  | "removeConnection"
  | "onConnectionsChanged"
>;
export class ConnectionManagementService {
  constructor(private readonly api: ConnectionGateway) {}
  list() {
    return this.api.getConnections();
  }
  subscribe(callback: () => void) {
    return this.api.onConnectionsChanged(callback);
  }
  save(input: ConnectionSave) {
    return this.api.saveConnection(input);
  }
  connect(id: string) {
    return this.checked(this.api.connectConnection(id));
  }
  disconnect(id: string) {
    return this.checked(this.api.disconnectConnection(id));
  }
  enable(id: string, enabled: boolean) {
    return this.checked(this.api.setConnectionEnabled(id, enabled));
  }
  remove(id: string) {
    return this.checked(this.api.removeConnection(id));
  }
  private async checked(operation: Promise<OperationResult>): Promise<void> {
    const result = await operation;
    if (!result.success) throw new Error(result.error);
  }
}
