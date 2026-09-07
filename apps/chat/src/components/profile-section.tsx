import { useState, useSyncExternalStore, type FormEvent } from "react";
import type { ExperienceService } from "../application/experience-service";
import type { ProfileEdit } from "../../electron/electron-api";
import "./profile-section.css";

export function ProfileSection({ service }: { service: ExperienceService }) {
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot);
  const [edit, setEdit] = useState<ProfileEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = snapshot?.profile;
  if (!profile)
    return (
      <section className="profile-section">
        <h3>Personal memory</h3>
        <p>Loading your local profile…</p>
      </section>
    );
  const begin = () => {
    setEdit({
      name: profile.name,
      notes: profile.notes.map((note) => ({ ...note })),
      checkInsEnabled: profile.checkInsEnabled,
      revision: profile.revision,
    });
    setError(null);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!edit || saving) return;
    setSaving(true);
    setError(null);
    try {
      await service.save(edit);
      setEdit(null);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not save memory",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="profile-section" aria-labelledby="profile-title">
      <h3 id="profile-title">Personal memory</h3>
      <p>
        Remembered locally, separate from chat. Lumen uses these details in
        model requests to personalize its help.
      </p>
      {edit ? (
        <form onSubmit={(event) => void submit(event)}>
          <fieldset disabled={saving}>
            <label>
              Name
              <input
                autoFocus
                maxLength={80}
                value={edit.name ?? ""}
                onChange={(event) =>
                  setEdit({
                    ...edit,
                    name: event.target.value.trim() ? event.target.value : null,
                  })
                }
              />
            </label>
            {edit.notes.map((note) => (
              <div className="profile-note" key={note.id}>
                <label>
                  Remembered detail
                  <textarea
                    maxLength={240}
                    value={note.text}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        notes: edit.notes.map((item) =>
                          item.id === note.id
                            ? { ...item, text: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn-secondary"
                  aria-label={`Forget ${note.text}`}
                  onClick={() =>
                    setEdit({
                      ...edit,
                      notes: edit.notes.filter((item) => item.id !== note.id),
                    })
                  }
                >
                  Forget
                </button>
              </div>
            ))}
            <label className="profile-check-ins">
              <input
                type="checkbox"
                checked={edit.checkInsEnabled}
                onChange={(event) =>
                  setEdit({ ...edit, checkInsEnabled: event.target.checked })
                }
              />
              Occasional check-ins
            </label>
            <div className="profile-actions">
              <button className="btn-primary" type="submit">
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
              {error && (
                <button className="btn-secondary" type="button" onClick={begin}>
                  Reload saved memory
                </button>
              )}
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          <p>
            <strong>{profile.name ?? "No name saved"}</strong>
          </p>
          {profile.notes.length ? (
            <ul>
              {profile.notes.map((note) => (
                <li key={note.id}>{note.text}</li>
              ))}
            </ul>
          ) : (
            <p>
              No details saved yet. Tell Lumen what you'd like it to remember.
            </p>
          )}
          <p>Check-ins {profile.checkInsEnabled ? "on" : "off"}</p>
          <button className="btn-secondary" type="button" onClick={begin}>
            Edit memory
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
