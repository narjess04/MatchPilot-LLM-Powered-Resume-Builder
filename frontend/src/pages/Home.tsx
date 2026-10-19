import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { IconArrow, IconCheck, IconPlay, LogoMark } from "../components/icons";
import "../styles/home.css";

export default function Home() {
  const video = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShown(true));
    if ((video.current?.readyState ?? 0) >= 2) setVideoReady(true);
  }, []);

  const watchDemo = () => {
    const v = video.current;
    if (!v) return;
    if (videoReady) {
      v.currentTime = 0;
      v.muted = false;
      v.play();
    }
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const reveal = `reveal${shown ? " in" : ""}`;

  return (
    <div className="home">
      <nav>
        <div className="wrap nav-inner">
          <Link to="/" className="logo"><LogoMark />MatchPilot</Link>
          <div className="nav-right">
            <ThemeToggle />
            <Link to="/app" className="btn btn-primary">Commencer</Link>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap hero-grid">
          <div className={reveal}>
            <span className="eyebrow"><span className="dot" />CV · Offre · Lettre en quelques minutes</span>
            <h1>Un CV taillé pour <em>chaque offre</em>. Sans rien inventer.</h1>
            <p className="lead">
              Importez votre CV, collez l'offre d'emploi : MatchPilot mesure votre correspondance, met en avant vos
              expériences pertinentes et génère un CV optimisé ATS et une lettre de motivation.
            </p>
            <div className="hero-cta">
              <Link to="/app" className="btn btn-primary">Analyser mon CV <IconArrow /></Link>
              <button type="button" className="btn btn-ghost" onClick={watchDemo}>Voir la démo</button>
            </div>
            <div className="hero-proof">
              <span><IconCheck />PDF, DOCX ou TXT</span>
              <span><IconCheck />Français &amp; anglais</span>
              <span><IconCheck />Export Word</span>
            </div>
          </div>

          <div className={`video-shell ${reveal}`}>
            <div className="video-card">
              <div className="video-bar"><i /><i /><i /><span>Démo — MatchPilot</span></div>
              <div className="video-frame">
                {/* Mets ta vidéo dans frontend/public/demo.mp4 (et optionnellement public/poster.jpg) */}
                <video
                  ref={video}
                  autoPlay muted loop playsInline preload="metadata"
                  poster="/poster.jpg"
                  controls={videoReady}
                  onLoadedData={() => setVideoReady(true)}
                >
                  <source src="/demo.mp4" type="video/mp4" />
                </video>
                {!videoReady && (
                  <div className="video-placeholder">
                    <div className="play"><IconPlay /></div>
                    <div>Votre vidéo de démonstration apparaîtra ici.<br />Ajoutez-la dans <code>frontend/public/demo.mp4</code></div>
                  </div>
                )}
              </div>
            </div>
            <div className="float-badge badge-score">
              <svg className="mini-ring" viewBox="0 0 42 42">
                <circle cx="21" cy="21" r="17" fill="none" stroke="var(--line)" strokeWidth="5" />
                <circle cx="21" cy="21" r="17" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="106.8" strokeDashoffset="16" transform="rotate(-90 21 21)" />
              </svg>
              <div><strong>85%</strong><small>Correspondance</small></div>
            </div>
            <div className="float-badge badge-ats">
              <div><strong>+9</strong><small>mots-clés ATS couverts</small></div>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
