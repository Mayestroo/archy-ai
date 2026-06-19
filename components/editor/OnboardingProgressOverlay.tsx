"use client";

import { GENERATION_STAGES, getWizardSteps, WIZARD_STEPS, type GenerationStage, type WizardPhase, type WizardStep } from "@/lib/editor-onboarding";
import type { UserType } from "@/lib/user-types";

interface OnboardingProgressOverlayProps {
  wizardPhase: WizardPhase;
  wizardStep: WizardStep;
  userType?: UserType | null;
  generationStage?: GenerationStage | null;
}

export default function OnboardingProgressOverlay({
  wizardPhase,
  wizardStep,
  userType,
  generationStage,
}: OnboardingProgressOverlayProps) {
  const steps = getWizardSteps(userType);
  const currentIndex = WIZARD_STEPS.indexOf(wizardStep);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto">
        {wizardPhase === "generating" ? (
          <div className="bg-background/95 backdrop-blur border border-border rounded-2xl p-5 max-w-[360px] shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Generation in progress
            </p>
            <div className="space-y-2.5">
              {GENERATION_STAGES.map((stage) => {
                const stageIndex = GENERATION_STAGES.findIndex((s) => s.key === stage.key);
                const currentStageIndex = GENERATION_STAGES.findIndex((s) => s.key === generationStage);
                const done = currentStageIndex > stageIndex;
                const active = currentStageIndex === stageIndex;

                return (
                  <div key={stage.key} className="flex items-center gap-2.5">
                    {active ? (
                      <span className="w-2 h-2 rounded-full bg-[#5D5DFF] animate-pulse" />
                    ) : done ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-border" />
                    )}
                    <span
                      className={`text-xs font-semibold ${
                        active ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/40"
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-background/95 backdrop-blur border border-border rounded-2xl p-5 max-w-[360px] shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Gathering your input
            </p>
            <div className="space-y-2.5">
              {steps.map((s, i) => {
                const completed = i < currentIndex;
                const current = i === currentIndex;
                return (
                  <div
                    key={s.step}
                    className={`flex items-center gap-2.5 ${current ? "text-foreground" : completed ? "text-muted-foreground" : "text-muted-foreground/40"}`}
                  >
                    {completed ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className={`w-4 h-4 rounded-full border-2 ${current ? "border-[#5D5DFF]" : "border-border"}`} />
                    )}
                    <span className={`text-xs font-semibold ${current ? "text-[#5D5DFF]" : ""}`}>
                      {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
