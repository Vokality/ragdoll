import { Field } from "./ui/field";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { TextInput, Select } from "./ui/input";
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
        <Button
          variant="secondary"
          onClick={() => setEditor("new")}
          disabled={editor !== null}
        >
          Add connection
        </Button>
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
        <Switch
          checked={connection.enabled}
          aria-label={`Allow ${connection.name} for agent`}
          title="Allow agent to use this connection"
          disabled={pending || connecting}
          onCheckedChange={(checked) =>
            void run(() => service.enable(connection.id, checked))
          }
        />
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
      <ConnectionActions
        connection={connection}
        pending={pending}
        onEdit={onEdit}
        service={service}
        run={run}
      />
    </article>
  );
}

function ConnectionActions({
  connection,
  pending,
  onEdit,
  service,
  run,
}: {
  connection: ConnectionInfo;
  pending: boolean;
  onEdit: () => void;
  service: ConnectionManagementService;
  run: (operation: () => Promise<void>) => Promise<void>;
}) {
  const confirm = useTimedConfirm();
  const connecting = connection.status === "connecting";
  return (
    <div className="connection-actions">
      {connection.status !== "connected" && !connecting && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => void run(() => service.connect(connection.id))}
        >
          {connection.authentication.type === "oauth"
            ? "Sign in / connect"
            : "Connect"}
        </Button>
      )}
      {(connection.status === "connected" || connecting) && (
        <Button
          variant="secondary"
          onClick={() => void run(() => service.disconnect(connection.id))}
        >
          {connecting ? "Cancel" : "Disconnect"}
        </Button>
      )}
      <Button
        variant="secondary"
        disabled={pending || connecting}
        onClick={onEdit}
      >
        Edit
      </Button>
      <Button
        variant="plain"
        className="connection-remove"
        disabled={pending || connecting}
        onClick={() => {
          if (confirm.isArmed) void run(() => service.remove(connection.id));
          else confirm.arm();
        }}
      >
        {confirm.isArmed ? "Confirm remove" : "Remove"}
      </Button>
    </div>
  );
}

interface ConnectionDraft {
  name: string;
  url: string;
  auth: ConnectionConfig["authentication"]["type"];
  clientId: string;
  metadataUrl: string;
  port: string;
  token: string;
}

function createConnectionDraft(connection?: ConnectionInfo): ConnectionDraft {
  const oauth =
    connection?.authentication.type === "oauth"
      ? connection.authentication
      : undefined;
  return {
    name: connection?.name ?? "",
    url: connection?.serverUrl ?? "",
    auth: connection?.authentication.type ?? "oauth",
    clientId: oauth?.clientId ?? "",
    metadataUrl: oauth?.clientMetadataUrl ?? "",
    port: oauth?.callbackPort?.toString() ?? "",
    token: "",
  };
}

function parseConnectionDraft(
  draft: ConnectionDraft,
  connection?: ConnectionInfo,
) {
  const { name, url, auth, clientId, metadataUrl, port, token } = draft;
  if (
    auth === "bearer" &&
    !token.trim() &&
    (connection?.authentication.type !== "bearer" ||
      connection.serverUrl !== url)
  ) {
    return {
      success: false,
      error: "Enter the access token for this server",
    } as const;
  }
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
    bearerToken: auth === "bearer" ? token.trim() || undefined : undefined,
  });
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues.map((issue) => issue.message).join(". "),
    } as const;
  return parsed;
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
  const [draft, setDraft] = useState(() => createConnectionDraft(connection));
  const { name, url, auth, clientId, metadataUrl, port, token } = draft;
  const changeDraft = <K extends keyof ConnectionDraft>(
    key: K,
    value: ConnectionDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="connection-editor"
      aria-label={connection ? "Edit connection" : "Add connection"}
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = parseConnectionDraft(draft, connection);
        if (!parsed.success) {
          setError(parsed.error);
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
      <Field label="Name">
        {(control) => (
          <TextInput
            {...control}
            required
            maxLength={80}
            value={name}
            onChange={(event) => changeDraft("name", event.target.value)}
            placeholder="Connection name"
            disabled={saving}
          />
        )}
      </Field>
      <Field label="Server URL">
        {(control) => (
          <TextInput
            {...control}
            type="url"
            required
            value={url}
            onChange={(event) => changeDraft("url", event.target.value)}
            placeholder="https://service.example/mcp"
            spellCheck={false}
            disabled={saving}
          />
        )}
      </Field>
      <p className="connections-hint">
        Streamable HTTP MCP endpoint. Local HTTP servers are supported.
      </p>
      <Field label="Authentication">
        {(control) => (
          <Select
            {...control}
            value={auth}
            disabled={saving}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "oauth" || value === "bearer" || value === "none") {
                setDraft((current) => ({ ...current, auth: value, token: "" }));
              }
            }}
          >
            <option value="oauth">OAuth — sign in with provider</option>
            <option value="bearer">Access token</option>
            <option value="none">No authentication</option>
          </Select>
        )}
      </Field>
      {auth === "bearer" && (
        <Field label="Access token">
          {(control) => (
            <TextInput
              {...control}
              type="password"
              autoComplete="new-password"
              value={token}
              onChange={(event) => changeDraft("token", event.target.value)}
              placeholder={
                connection?.authentication.type === "bearer"
                  ? "Leave blank to keep saved token"
                  : "Provider access token"
              }
              disabled={saving}
            />
          )}
        </Field>
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
          <Field label="Public client ID">
            {(control) => (
              <TextInput
                {...control}
                value={clientId}
                onChange={(event) =>
                  changeDraft("clientId", event.target.value)
                }
                disabled={saving}
              />
            )}
          </Field>
          <Field label="Client metadata document URL">
            {(control) => (
              <TextInput
                {...control}
                type="url"
                value={metadataUrl}
                onChange={(event) =>
                  changeDraft("metadataUrl", event.target.value)
                }
                disabled={saving}
              />
            )}
          </Field>
          <Field label="Callback port">
            {(control) => (
              <TextInput
                {...control}
                type="number"
                min={1024}
                max={65535}
                value={port}
                placeholder="Automatic"
                onChange={(event) => changeDraft("port", event.target.value)}
                disabled={saving}
              />
            )}
          </Field>
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
        <Button
          variant="primary"
          type="submit"
          loading={saving}
          loadingLabel="Saving…"
        >
          Save connection
        </Button>
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
