"use client";

import { ArrowRight, Compass } from "lucide-react";
import type { ProjectGuidance as Guidance } from "@/lib/project-guidance";

export function ProjectGuidance({
  guidance,
  onNavigate,
  disabled = false,
}: {
  guidance: Guidance;
  onNavigate: (stage: Guidance["stage"]) => void;
  disabled?: boolean;
}) {
  return (
    <section
      className={`card project-guidance ${guidance.tone}`}
      aria-label="Suggested next step"
    >
      <div className="project-guidance-copy">
        <p className="eyebrow">
          <Compass size={15} aria-hidden="true" /> Suggested next step
        </p>
        <h2>{guidance.title}</h2>
        <p>{guidance.description}</p>
      </div>
      <button
        type="button"
        className="secondary"
        disabled={disabled}
        onClick={() => onNavigate(guidance.stage)}
      >
        {guidance.actionLabel} <ArrowRight size={15} aria-hidden="true" />
      </button>
    </section>
  );
}
