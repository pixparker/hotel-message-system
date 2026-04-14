import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import type { Language } from "@hms/shared";
import { Page } from "../components/Page.js";
import { LanguageBodiesEditor } from "../components/LanguageBodiesEditor.js";
import { useTemplate, useSaveTemplate } from "../hooks/useTemplates.js";
import { useToast } from "../components/toast.js";

export function TemplateEditPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { push } = useToast();

  const { data } = useTemplate(isNew ? null : id!);
  const save = useSaveTemplate(isNew ? null : id!);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bodies, setBodies] = useState<Partial<Record<Language, string>>>({});

  useEffect(() => {
    if (data) {
      setName(data.name);
      setDescription(data.description ?? "");
      const map: Partial<Record<Language, string>> = {};
      for (const b of data.bodies) map[b.language as Language] = b.body;
      setBodies(map);
    }
  }, [data]);

  async function submit() {
    const bodyList = (Object.keys(bodies) as Language[])
      .filter((l) => bodies[l] && bodies[l]!.trim().length > 0)
      .map((l) => ({ language: l, body: bodies[l]!.trim() }));

    if (!name.trim() || bodyList.length === 0) {
      push({
        variant: "error",
        title: "Missing required fields",
        description: "Give the template a name and fill at least one language.",
      });
      return;
    }
    try {
      await save.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        bodies: bodyList,
      });
      push({ variant: "success", title: isNew ? "Template created" : "Template saved" });
      navigate("/templates");
    } catch {
      push({ variant: "error", title: "Could not save template" });
    }
  }

  return (
    <Page
      title={isNew ? "New template" : "Edit template"}
      description="Write once in any of the supported languages — guests get the version that matches their preferred language."
      actions={
        <Link to="/templates" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      }
    >
      <div className="card p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input
              id="name"
              className="input mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Late checkout reminder"
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="desc">Description</label>
            <input
              id="desc"
              className="input mt-1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional — shown when picking the template"
            />
          </div>
        </div>

        <div>
          <div className="label mb-3">Messages</div>
          <LanguageBodiesEditor
            bodies={bodies}
            onChange={(l, body) => setBodies({ ...bodies, [l]: body })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Link to="/templates" className="btn-secondary">Cancel</Link>
          <button className="btn-primary" onClick={submit} disabled={save.isPending}>
            {save.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> {isNew ? "Create template" : "Save changes"}
              </>
            )}
          </button>
        </div>
      </div>
    </Page>
  );
}
