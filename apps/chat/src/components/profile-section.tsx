import { Field } from "./ui/field";
import { Button } from "./ui/button";
import { TextInput, Textarea, Select, Checkbox } from "./ui/input";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import type { ExperienceService } from "../application/experience-service";
import {
  memoryTierSchema,
  type ProfileEdit,
  type UserProfile,
} from "../../electron/electron-api";
import "./profile-section.css";

export function ProfileSection({ service }: { service: ExperienceService }) {
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot);
  const [edit, setEdit] = useState<ProfileEdit | null>(null);
  const [visibleFacts, setVisibleFacts] = useState(20);
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
      notes: profile.notes.map(({ id, text, tier }) => ({ id, text, tier })),
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
        <ProfileEditor
          edit={edit}
          onChange={setEdit}
          saving={saving}
          error={error}
          visibleFacts={visibleFacts}
          onShowMore={() => setVisibleFacts((count) => count + 20)}
          onSubmit={submit}
          onCancel={() => setEdit(null)}
          onReload={begin}
        />
      ) : (
        <ProfileReview
          profile={profile}
          visibleFacts={visibleFacts}
          onShowMore={() => setVisibleFacts((count) => count + 20)}
          onEdit={begin}
        />
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function MemoryNoteEditor({
  note,
  onChange,
  onForget,
}: {
  note: ProfileEdit["notes"][number];
  onChange: (note: ProfileEdit["notes"][number]) => void;
  onForget: () => void;
}) {
  return (
    <div className="profile-note">
      <div className="profile-note-fields">
        <Field label="Memory type">
          {(control) => (
            <Select
              {...control}
              aria-label={`Memory type for ${note.text}`}
              value={note.tier}
              onChange={(event) =>
                onChange({
                  ...note,
                  tier: memoryTierSchema.parse(event.target.value),
                })
              }
            >
              <option value="working">Working memory</option>
              <option value="long_term">Long-term memory</option>
            </Select>
          )}
        </Field>
        <Field label="Remembered detail">
          {(control) => (
            <Textarea
              {...control}
              maxLength={240}
              value={note.text}
              onChange={(event) =>
                onChange({ ...note, text: event.target.value })
              }
            />
          )}
        </Field>
      </div>
      <Button
        variant="secondary"
        aria-label={`Forget ${note.text}`}
        onClick={onForget}
      >
        Forget
      </Button>
    </div>
  );
}

function ProfileEditor({
  edit,
  onChange,
  saving,
  error,
  visibleFacts,
  onShowMore,
  onSubmit,
  onCancel,
  onReload,
}: {
  edit: ProfileEdit;
  onChange: (edit: ProfileEdit) => void;
  saving: boolean;
  error: string | null;
  visibleFacts: number;
  onShowMore: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
  onCancel: () => void;
  onReload: () => void;
}) {
  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <fieldset disabled={saving}>
        <Field label="Name">
          {(control) => (
            <TextInput
              {...control}
              maxLength={80}
              value={edit.name ?? ""}
              onChange={(event) =>
                onChange({
                  ...edit,
                  name: event.target.value.trim() ? event.target.value : null,
                })
              }
            />
          )}
        </Field>
        {edit.notes.slice(0, visibleFacts).map((note) => (
          <MemoryNoteEditor
            key={note.id}
            note={note}
            onChange={(next) =>
              onChange({
                ...edit,
                notes: edit.notes.map((item) =>
                  item.id === next.id ? next : item,
                ),
              })
            }
            onForget={() =>
              onChange({
                ...edit,
                notes: edit.notes.filter((item) => item.id !== note.id),
              })
            }
          />
        ))}
        {edit.notes.length > visibleFacts && (
          <Button variant="secondary" onClick={() => onShowMore()}>
            Show more facts
          </Button>
        )}
        <label className="profile-check-ins">
          <Checkbox
            checked={edit.checkInsEnabled}
            onChange={(event) =>
              onChange({ ...edit, checkInsEnabled: event.target.checked })
            }
          />
          Occasional check-ins
        </label>
        <div className="profile-actions">
          <Button
            variant="primary"
            type="submit"
            loading={saving}
            loadingLabel="Saving…"
          >
            Save
          </Button>
          <Button variant="secondary" onClick={() => onCancel()}>
            Cancel
          </Button>
          {error && (
            <Button variant="secondary" onClick={onReload}>
              Reload saved memory
            </Button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

function ProfileReview({
  profile,
  visibleFacts,
  onShowMore,
  onEdit,
}: {
  profile: UserProfile;
  visibleFacts: number;
  onShowMore: () => void;
  onEdit: () => void;
}) {
  const working = profile.notes.filter((note) => note.tier === "working");
  const longTerm = profile.notes.filter((note) => note.tier === "long_term");
  return (
    <>
      <p>
        <strong>{profile.name ?? "No name saved"}</strong>
      </p>
      <details open>
        <summary>
          Working memory · {working.length}
          /50
        </summary>
        <p>
          Available in every conversation. When full, the least recently used
          facts move to long-term memory.
        </p>
        <ul>
          {working.map((note) => (
            <li key={note.id}>{note.text}</li>
          ))}
        </ul>
      </details>
      <section className="profile-long-term" aria-label="Long-term memory">
        <h4>Long-term memory · {longTerm.length} facts</h4>
        <p>
          {profile.longTermSummary ??
            (longTerm.length > 0
              ? "Summary pending. Lumen will refresh it during your next conversation."
              : "No long-term facts saved yet.")}
        </p>
        <details>
          <summary>Browse saved facts</summary>
          <ul>
            {longTerm.slice(0, visibleFacts).map((note) => (
              <li key={note.id}>{note.text}</li>
            ))}
          </ul>
          {longTerm.length > visibleFacts && (
            <Button variant="secondary" onClick={() => onShowMore()}>
              Show more facts
            </Button>
          )}
        </details>
      </section>
      {!profile.notes.length && (
        <p>No details saved yet. Tell Lumen what you'd like it to remember.</p>
      )}
      <p>Check-ins {profile.checkInsEnabled ? "on" : "off"}</p>
      <Button variant="secondary" onClick={onEdit}>
        Edit memory
      </Button>
    </>
  );
}
