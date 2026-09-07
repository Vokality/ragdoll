import { useEffect, useState } from "react";
import {
  connectionSaveSchema,
  type ConnectionInfo,
  type ConnectionConfig,
} from "../../electron/electron-api";
import type { ConnectionManagementService } from "../application/connection-management-service";
import { useTimedConfirm } from "../hooks/use-timed-confirm";
import "./connections-section.css";

export function ConnectionsSection({
  service,
}: {
  service: ConnectionManagementService;
}) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<ConnectionInfo | "new" | null>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const refresh = async () => {
      const request = ++generation;
      try {
        const result = await service.list();
        if (active && request === generation) {
          setConnections(result);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError("Could not load connections");
          setLoading(false);
        }
      }
    };
    const unsubscribe = service.subscribe(() => {
      void refresh();
    });
    void refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [service]);
  return (
    <section
      className="connections-section"
      aria-labelledby="connections-title"
    >
      <div className="connections-heading">
        <h3 id="connections-title">Connections</h3>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => setEditor("new")}
          disabled={editor !== null}
        >
          Add connection
        </button>
      </div>
      <p className="connections-hint">
        Connect your services, then allow Lumen to use their tools on your
        behalf.
      </p>
      {loading && <p role="status">Loading connections…</p>}
      {error && (
        <p role="alert" className="connections-error">
          {error}
        </p>
      )}
      {!loading && !connections.length && !editor && (
        <p className="connections-empty">
          No connections yet. Add an MCP server to get started.
        </p>
      )}
      <div className="connections-list">
        {connections.map((connection) => (
          <ConnectionRow
            key={connection.id}
            connection={connection}
            service={service}
            onEdit={() => setEditor(connection)}
          />
        ))}
      </div>
      {editor && (
        <ConnectionEditor
          key={editor === "new" ? "new" : editor.id}
          connection={editor === "new" ? undefined : editor}
          service={service}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  );
}

const statusLabels: Record<ConnectionInfo["status"], string> = {
  disconnected: "Disconnected",
  connecting: "Connecting…",
  connected: "Connected",
  needs_auth: "Sign-in needed",
  error: "Connection failed",
};
function ConnectionRow({
  connection,
  service,
  onEdit,
}: {
  connection: ConnectionInfo;
  service: ConnectionManagementService;
  onEdit: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useTimedConfirm();
  const run = async (operation: () => Promise<void>) => {
    setPending(true);
    setError(null);
    try {
      await operation();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Connection action failed",
      );
    } finally {
      setPending(false);
    }
  };
  const connecting = connection.status === "connecting";
  return (
    <article className="connection-row" aria-label={connection.name}>
      <div className="connection-summary">
        <span className="connection-mark" aria-hidden="true">
          ↗
        </span>
        <div className="connection-identity">
          <strong>{connection.name}</strong>
          <span title={connection.serverUrl}>{connection.serverUrl}</span>
        </div>
        <button
          className={`switch${connection.enabled ? " on" : ""}`}
          type="button"
          aria-pressed={connection.enabled}
          aria-label={`Allow ${connection.name} for agent`}
          title="Allow agent to use this connection"
          disabled={pending || connecting}
          onClick={() =>
            void run(() => service.enable(connection.id, !connection.enabled))
          }
        >
          <span className="switch-knob" />
        </button>
      </div>
      <div className="connection-status" role="status">
        <span className={`connection-dot ${connection.status}`} />
        {statusLabels[connection.status]}
        {connection.status === "connected" && (
          <span>
            · {connection.toolCount} tools ·{" "}
            {connection.enabled ? "Agent access on" : "Agent access off"}
          </span>
        )}
      </div>
      {(error || connection.error) && (
        <p role="alert" className="connections-error">
          {error || connection.error}
        </p>
      )}
      <div className="connection-actions">
        {connection.status !== "connected" && !connecting && (
          <button
            className="btn-secondary"
            type="button"
            disabled={pending}
            onClick={() => void run(() => service.connect(connection.id))}
          >
            {connection.authentication.type === "oauth"
              ? "Sign in / connect"
              : "Connect"}
          </button>
        )}
        {(connection.status === "connected" || connecting) && (
          <button
            className="btn-secondary"
            type="button"
            onClick={() => void run(() => service.disconnect(connection.id))}
          >
            {connecting ? "Cancel" : "Disconnect"}
          </button>
        )}
        <button
          className="btn-secondary"
          type="button"
          disabled={pending || connecting}
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          className="connection-remove"
          type="button"
          disabled={pending || connecting}
          onClick={() => {
            if (confirm.isArmed) void run(() => service.remove(connection.id));
            else confirm.arm();
          }}
        >
          {confirm.isArmed ? "Confirm remove" : "Remove"}
        </button>
      </div>
    </article>
  );
}

function ConnectionEditor({
  connection,
  service,
  onClose,
}: {
  connection?: ConnectionInfo;
  service: ConnectionManagementService;
  onClose: () => void;
}) {
  const [name, setName] = useState(connection?.name ?? "");
  const [url, setUrl] = useState(connection?.serverUrl ?? "");
  const [auth, setAuth] = useState<ConnectionConfig["authentication"]["type"]>(
    connection?.authentication.type ?? "oauth",
  );
  const oauth =
    connection?.authentication.type === "oauth"
      ? connection.authentication
      : undefined;
  const [clientId, setClientId] = useState(oauth?.clientId ?? "");
  const [metadataUrl, setMetadataUrl] = useState(
    oauth?.clientMetadataUrl ?? "",
  );
  const [port, setPort] = useState(oauth?.callbackPort?.toString() ?? "");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="connection-editor"
      aria-label={connection ? "Edit connection" : "Add connection"}
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = connectionSaveSchema.safeParse({
          id: connection?.id,
          name,
          serverUrl: url,
          authentication:
            auth === "oauth"
              ? {
                  type: auth,
                  clientId: clientId.trim() || undefined,
                  clientMetadataUrl: metadataUrl.trim() || undefined,
                  callbackPort: port ? Number(port) : undefined,
                }
              : { type: auth },
          bearerToken:
            auth === "bearer" ? token.trim() || undefined : undefined,
        });
        if (!parsed.success) {
          setError(
            parsed.error.issues.map((issue) => issue.message).join(". "),
          );
          return;
        }
        if (
          auth === "bearer" &&
          !token &&
          (!connection ||
            connection.authentication.type !== "bearer" ||
            connection.serverUrl !== url)
        ) {
          setError("Enter the access token for this server");
          return;
        }
        setSaving(true);
        setError(null);
        void service
          .save(parsed.data)
          .then(onClose)
          .catch(() => {
            setError(
              "Could not save the connection. Check secure credential storage and try again.",
            );
          })
          .finally(() => setSaving(false));
      }}
    >
      <h4>{connection ? "Edit connection" : "New connection"}</h4>
      <label>
        Name
        <input
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Connection name"
          disabled={saving}
        />
      </label>
      <label>
        Server URL
        <input
          type="url"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://service.example/mcp"
          spellCheck={false}
          disabled={saving}
        />
      </label>
      <p className="connections-hint">
        Streamable HTTP MCP endpoint. Local HTTP servers are supported.
      </p>
      <label>
        Authentication
        <select
          value={auth}
          disabled={saving}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "oauth" || value === "bearer" || value === "none") {
              setAuth(value);
              setToken("");
            }
          }}
        >
          <option value="oauth">OAuth — sign in with provider</option>
          <option value="bearer">Access token</option>
          <option value="none">No authentication</option>
        </select>
      </label>
      {auth === "bearer" && (
        <label>
          Access token
          <input
            type="password"
            autoComplete="new-password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder={
              connection?.authentication.type === "bearer"
                ? "Leave blank to keep saved token"
                : "Provider access token"
            }
            disabled={saving}
          />
        </label>
      )}
      {auth === "oauth" && (
        <details>
          <summary>
            Provider client settings <span>(optional)</span>
          </summary>
          <p className="connections-hint">
            Most providers discover login automatically. Supply client details
            only when your provider requires them.
          </p>
          <label>
            Public client ID
            <input
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              disabled={saving}
            />
          </label>
          <label>
            Client metadata document URL
            <input
              type="url"
              value={metadataUrl}
              onChange={(event) => setMetadataUrl(event.target.value)}
              disabled={saving}
            />
          </label>
          <label>
            Callback port
            <input
              type="number"
              min={1024}
              max={65535}
              value={port}
              placeholder="Automatic"
              onChange={(event) => setPort(event.target.value)}
              disabled={saving}
            />
          </label>
          {connection && port && (
            <p className="connections-hint">
              Redirect URI: http://127.0.0.1:{port}/oauth/callback/
              {connection.id}
            </p>
          )}
        </details>
      )}
      <p className="connections-hint">
        Credentials stay in Lumen’s encrypted storage. Connect after saving; use
        the switch to grant agent access.
      </p>
      {connection && (
        <p className="connections-hint">
          Changing the server or authentication clears its saved credentials.
        </p>
      )}
      {error && (
        <p className="connections-error" role="alert">
          {error}
        </p>
      )}
      <div className="connection-actions">
        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save connection"}
        </button>
        <button
          className="btn-secondary"
          type="button"
          disabled={saving}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
