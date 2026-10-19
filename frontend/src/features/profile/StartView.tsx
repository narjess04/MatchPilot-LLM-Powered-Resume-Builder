import { useRef, useState } from "react";
import * as api from "../../api";
import { ProgressModal } from "../../components/ProgressModal";
import { useToast } from "../../components/Toast";
import { IconFileUp, IconInfo, IconLinkedIn, IconPen, IconX } from "../../components/icons";
import { fileExt } from "../../lib/utils";
import { useAuth } from "../../state/auth";
import { useWorkspace } from "../../state/workspace";
import { emptyProfile, type Profile, type Source } from "../../types";

type FileSource = "cv" | "linkedin-pdf";
type Busy = { title: string; stages: string[]; ms: number };

const ACCEPTED = ["pdf", "docx", "txt", "png", "jpg", "jpeg", "webp"];
const FILE_STAGES = ["Lecture du document", "Extraction de vos expériences et formations", "Vérification et création du profil"];
const LINKEDIN_STAGES = ["Autorisation LinkedIn", "Récupération de votre identité", "Création de votre profil"];

export function StartView() {
  const { update } = useWorkspace();
  const { user } = useAuth();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const pickTarget = useRef<FileSource>("cv");
  const [busy, setBusy] = useState<Busy | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");

  const finish = (
    profile: Profile,
    source: Source,
    importFile: string | null = null,
    importMethod: "text" | "ocr" | null = null,
    importWarnings: string[] = [],
  ) => update((w) => ({ ...w, profile, source, importFile, importMethod, importWarnings, noticeClosed: false }));

  async function run<T>(b: Busy, task: () => Promise<T>): Promise<T | null> {
    setBusy(b);
    setError("");
    try {
      return await task();
    } catch (e) {
      // Kept on screen (not a toast) so the reason of a failed import can't be missed
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function fromFile(file: File, source: FileSource) {
    if (!ACCEPTED.includes(fileExt(file.name))) return toast("Format non supporté : PDF, DOCX, TXT ou une photo (PNG, JPG).");
    if (file.size > 10 * 1048576) return toast("Fichier trop lourd (10 Mo maximum).");
    const title = source === "cv" ? "Lecture de votre CV…" : "Lecture du profil LinkedIn…";
    const result = await run({ title, stages: FILE_STAGES, ms: 8000 }, () => api.importProfileFromFile(file, source));
    if (result) finish({ ...emptyProfile(), ...result.profile }, source, file.name, result.method, result.warnings);
  }

  async function fromLinkedIn() {
    const identity = await run({ title: "Connexion à LinkedIn…", stages: LINKEDIN_STAGES, ms: 1800 }, api.linkedinSignIn);
    if (identity) finish({ ...emptyProfile(), ...identity }, "linkedin");
  }

  const pick = (target: FileSource) => {
    pickTarget.current = target;
    fileInput.current?.click();
  };

  return (
    <section className="view start">
      <div className="view-head">
        <h1>Créons votre profil</h1>
        <p>Votre profil sert de base à tous vos CV. Importez vos informations en un clic, vous n'aurez qu'à les vérifier.</p>
      </div>

      {error && (
        <div className="notice warn" role="alert">
          <IconInfo />
          <div><b>L'import n'a pas abouti.</b> {error}</div>
          <button className="icon-btn" aria-label="Fermer" onClick={() => setError("")}><IconX /></button>
        </div>
      )}

      <div className="options">
        <div className="option">
          <div className="o-ico li"><IconLinkedIn /></div>
          <h2>Depuis LinkedIn</h2>
          <p>Connectez votre compte pour récupérer votre identité, puis ajoutez le PDF de votre profil pour tout votre parcours.</p>
          <div className="bottom">
            <button className="btn btn-linkedin" onClick={fromLinkedIn}>Se connecter avec LinkedIn</button>
            <button className="btn btn-ghost" onClick={() => pick("linkedin-pdf")}>Importer le PDF LinkedIn</button>
            <div className="hint">Sur LinkedIn : <b>Profil → Plus → Enregistrer au format PDF</b></div>
          </div>
        </div>

        <div className="option featured">
          <span className="reco">LE PLUS RAPIDE</span>
          <div className="o-ico"><IconFileUp /></div>
          <h2>Depuis mon ancien CV</h2>
          <p>Déposez votre CV actuel : expériences, formations, compétences et langues sont extraites automatiquement.</p>
          <div className="bottom">
            <div
              className={`start-drop${drag ? " drag" : ""}`}
              tabIndex={0}
              role="button"
              onClick={() => pick("cv")}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick("cv"))}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) fromFile(f, "cv");
              }}
            >
              <b>Glissez votre CV ici</b><br />PDF, Word, ou même une photo — ou cliquez
            </div>
          </div>
        </div>

        <div className="option">
          <div className="o-ico"><IconPen /></div>
          <h2>Partir de zéro</h2>
          <p>Pas de CV sous la main ? Remplissez votre profil étape par étape, section par section.</p>
          <div className="bottom">
            <button
              className="btn btn-ghost"
              onClick={() => finish({ ...emptyProfile(), full_name: user?.full_name ?? "", email: user?.email ?? "" }, "scratch")}
            >
              Créer mon profil
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) fromFile(f, pickTarget.current);
        }}
      />
      {busy && <ProgressModal title={busy.title} stages={busy.stages} estimatedMs={busy.ms} />}
    </section>
  );
}
