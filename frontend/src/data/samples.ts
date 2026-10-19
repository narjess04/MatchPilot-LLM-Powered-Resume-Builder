import type { Profile } from "../types";

export const SAMPLE_PROFILE: Profile = {
  photo: null,
  full_name: "Sarah Ben Ali",
  headline: "Ingénieure logiciel — Développement web",
  email: "sarah.benali@email.com",
  phone: "+216 20 000 000",
  location: "Tunis",
  linkedin: "linkedin.com/in/sarah-benali",
  website: "github.com/sarah-benali",
  summary:
    "Jeune diplômée en génie logiciel, passionnée par le développement web. Expérience de stage en React et Node.js, habituée au travail en équipe Agile.",
  experiences: [
    {
      title: "Stagiaire développeuse web", company: "WebNova", location: "Tunis", start: "02/2025", end: "07/2025",
      bullets: "Développement de l'interface React du site de l'entreprise\nCréation de requêtes SQL pour les tableaux de bord internes\nParticipation aux rituels Scrum de l'équipe",
    },
    {
      title: "Stagiaire support informatique", company: "Banque Atlas", location: "Tunis", start: "07/2023", end: "08/2023",
      bullets: "Assistance aux utilisateurs et gestion des tickets\nRédaction de procédures internes",
    },
  ],
  education: [
    {
      degree: "Diplôme d'ingénieur en génie logiciel", institution: "École Supérieure d'Ingénierie de Tunis", location: "Tunis", start: "2022", end: "2025",
      details: "Projet de fin d'études : plateforme de prise de rendez-vous médicaux",
    },
  ],
  projects: [
    {
      name: "MediBook — rendez-vous médicaux", technologies: "React, Node.js, PostgreSQL", link: "github.com/sarah-benali/medibook",
      description: "Application web de réservation de créneaux médicaux\nAPI REST et base de données des rendez-vous",
    },
  ],
  skills: [
    { category: "Langages", items: ["JavaScript", "Python", "SQL"] },
    { category: "Frameworks", items: ["React", "Node.js"] },
    { category: "Outils & méthodes", items: ["PostgreSQL", "Git", "Scrum"] },
  ],
  languages: [
    { language: "Arabe", level: "natif" },
    { language: "Français", level: "courant" },
    { language: "Anglais", level: "B2" },
  ],
  hackathons: [
    { name: "Hack4Health Tunis", result: "2e place", date: "2024", description: "Prototype d'application de suivi des rendez-vous en 24 h" },
  ],
  associations: [
    { organization: "Google Developer Student Club", role: "Responsable événements", start: "2023", end: "2025", description: "Organisation d'ateliers techniques pour 80 étudiants" },
  ],
  interests: ["Hackathons", "Randonnée", "Photographie"],
  sections: { hackathons: true, associations: true, interests: true },
};

export const SAMPLE_JOB = `Développeur·se Full-Stack Junior — Horizon Digital (Tunis, hybride) — CDI

Horizon Digital conçoit des plateformes web pour des clients du secteur de la santé et de l'éducation. Nous recherchons un·e développeur·se Full-Stack Junior pour rejoindre notre équipe produit.

Missions :
- Développer de nouvelles fonctionnalités front-end en React et TypeScript
- Concevoir et maintenir des API REST en Node.js
- Modéliser et interroger les données (SQL / PostgreSQL)
- Écrire des tests unitaires et participer aux revues de code
- Travailler en méthode Agile (Scrum) avec les équipes produit et design

Profil recherché :
- Diplôme d'ingénieur ou master en informatique
- Maîtrise de React, Node.js et SQL ; TypeScript requis
- Bonne pratique de Git
- Docker et CI/CD sont un plus`;
