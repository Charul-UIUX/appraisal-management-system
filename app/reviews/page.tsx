"use client";

import React from "react";
import { useStore } from "@/app/providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DEMO_ORG, KRA_KEYS } from "@/lib/demoData";
import { KRA_LABELS, scoreToFinalRating, weightedScore } from "@/lib/scoring";
import { KRAKey, Rating5 } from "@/lib/types";

const ratingOptions: { value: Rating5; label: string }[] = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

export default function ReviewsPage() {
  const {
    role,
    actingUserId,
    cycleId,
    settings,
    selfAppraisals,
    managerEvals,
    upsertManagerEval,
    reviews,
    setReview,
  } = useStore();

  const isManager = role === "MANAGER";
  const isHR = role === "HR";

  // Employee in context (Team quick-switch sets acting user to employee)
  const employeeId = actingUserId?.startsWith("e-") ? actingUserId : undefined;

  if (!actingUserId) return <div>Select an acting user.</div>;

  if (!employeeId) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Reviews & Ratings</h1>
        <Card>
          <CardContent className="text-sm text-neutral-700">
            Use <b>Team View</b> to quick-switch into an Employee context for review.
          </CardContent>
        </Card>
      </div>
    );
  }

  const emp = DEMO_ORG.find((p) => p.id === employeeId);
  if (!emp) return <div>Employee not found.</div>;

  const key = `${cycleId}:${employeeId}`;
  const self = selfAppraisals[key];
  const me = managerEvals[key];
  const rr = reviews[key];

  const canManagerEdit = isManager && !me.submitted && rr.status !== "HR_SIGNED_OFF";
  const canHRSignOff = isHR && rr.status === "MANAGER_SUBMITTED";

  // Score preview from manager ratings
  const score = weightedScore(me.kraRatings, settings.kraWeights);
  const predictedFinal = scoreToFinalRating(score.score);

  // Extreme rating governance (Option 1): comment OR evidence link
  const extremeRatings = Object.entries(me.kraRatings).filter(
    ([, v]) => v === 1 || v === 5
  );

  const hasAnyManagerEvidence = (me.evidenceLinks ?? []).some((x) => x.trim().length > 0);
  const hasAnyExtremeComment = extremeRatings.some(
    ([k]) => (me.kraComments as any)?.[k]?.trim()?.length > 0
  );

  const extremeRuleOk =
    extremeRatings.length === 0 || hasAnyManagerEvidence || hasAnyExtremeComment;

  function setRating(kra: KRAKey, val: Rating5) {
    upsertManagerEval({
      ...me,
      submitted: false,
      kraRatings: { ...me.kraRatings, [kra]: val },
    });
  }

  function setComment(kra: KRAKey, val: string) {
    upsertManagerEval({
      ...me,
      submitted: false,
      kraComments: { ...me.kraComments, [kra]: val },
    });
  }

  function submitManager() {
    upsertManagerEval({ ...me, submitted: true, submittedAt: new Date().toISOString() });
    setReview({ ...rr, status: "MANAGER_SUBMITTED", lastUpdatedAt: new Date().toISOString() });
  }

  function sendBackToManager() {
    setReview({ ...rr, status: "SENT_BACK", lastUpdatedAt: new Date().toISOString() });
  }

  function hrSignOff(outcome: "PROMOTION" | "NO_CHANGE" | "PIP" | "BONUS_ONLY") {
    setReview({
      ...rr,
      status: "HR_SIGNED_OFF",
      finalRating: predictedFinal,
      outcome,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Reviews & Ratings</h1>
        <p className="text-sm text-neutral-600">
          Manager submits weighted evaluation. HR finalizes with sign-off workflow.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="font-medium">{emp.name}</div>
          <div className="text-neutral-600">
            {emp.title} • {emp.department}
          </div>
          <div className="mt-2">
            Review status: <b>{rr.status}</b>
          </div>
          {rr.status === "HR_SIGNED_OFF" && (
            <div className="mt-2">
              Final rating: <b>{rr.finalRating}</b> • Outcome: <b>{rr.outcome}</b>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Self-appraisal snapshot</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>
              Self submitted: <b>{self?.submitted ? "Yes" : "No"}</b>
            </div>
            <div className="text-neutral-700">
              <b>Achievements:</b> {self?.achievements?.slice(0, 160) || "-"}
            </div>
            <div className="text-neutral-700">
              <b>Challenges:</b> {self?.challenges?.slice(0, 160) || "-"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weighted score (Preview)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>
              Score (1–5): <b>{score.score}</b>
            </div>
            <div>
              Coverage: <b>{score.coveragePct}%</b> (ratings filled vs weight total)
            </div>
            <div>
              Predicted final rating: <b>{predictedFinal}</b>
            </div>
            <div className="text-xs text-neutral-500">
              Final rating becomes official only after HR sign-off.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manager Evaluation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isManager && (
            <div className="text-sm text-neutral-700">
              Switch role to <b>Manager</b> to edit evaluation.
            </div>
          )}
          {rr.status === "SENT_BACK" && (
            <div className="text-sm text-red-700">
              HR has sent this review back for changes.
            </div>
          )}

          {KRA_KEYS.map((k) => (
            <div key={k} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium">{KRA_LABELS[k]}</div>
                <select
                  className="h-10 rounded-md border px-3 text-sm bg-white"
                  value={(me.kraRatings?.[k] ?? "") as any}
                  onChange={(e) => setRating(k, Number(e.target.value) as Rating5)}
                  disabled={!canManagerEdit}
                >
                  <option value="">Select</option>
                  {ratingOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                className="min-h-20 w-full rounded-md border p-2 text-sm"
                value={me.kraComments?.[k] ?? ""}
                onChange={(e) => setComment(k, e.target.value)}
                disabled={!canManagerEdit}
                placeholder="Comment with evidence / context..."
              />
            </div>
          ))}

          <div className="rounded-md border p-3 space-y-2">
            <div className="text-sm font-medium">
              Manager evidence links (required if any rating = 1 or 5)
            </div>
            <div className="text-xs text-neutral-500">
              Add links to PRs, dashboards, incident reports, feedback docs, etc.
            </div>

            <Button
              variant="secondary"
              onClick={() =>
                upsertManagerEval({
                  ...me,
                  submitted: false,
                  evidenceLinks: [...(me.evidenceLinks ?? []), ""],
                })
              }
              disabled={!canManagerEdit}
            >
              + Add evidence link
            </Button>

            {(me.evidenceLinks ?? []).map((l, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  className="h-10 flex-1 rounded-md border px-3 text-sm"
                  value={l}
                  onChange={(e) => {
                    const copy = [...(me.evidenceLinks ?? [])];
                    copy[idx] = e.target.value;
                    upsertManagerEval({ ...me, submitted: false, evidenceLinks: copy });
                  }}
                  disabled={!canManagerEdit}
                  placeholder="https://..."
                />
                <Button
                  variant="danger"
                  onClick={() => {
                    const copy = (me.evidenceLinks ?? []).filter((_, i) => i !== idx);
                    upsertManagerEval({ ...me, submitted: false, evidenceLinks: copy });
                  }}
                  disabled={!canManagerEdit}
                >
                  Remove
                </Button>
              </div>
            ))}

            {!extremeRuleOk && (
              <div className="text-sm text-red-700">
                Extreme ratings detected (1 or 5). Add at least one manager evidence link OR add a
                comment for an extreme-rated category.
              </div>
            )}
          </div>

          <label className="block space-y-1">
            <div className="text-sm font-medium">Overall assessment</div>
            <textarea
              className="min-h-24 w-full rounded-md border p-2 text-sm"
              value={me.overallComment}
              onChange={(e) =>
                upsertManagerEval({ ...me, submitted: false, overallComment: e.target.value })
              }
              disabled={!canManagerEdit}
            />
          </label>

          <label className="block space-y-1">
            <div className="text-sm font-medium">Promotion recommendation</div>
            <select
              className="h-10 rounded-md border px-3 text-sm bg-white"
              value={me.promotionRecommendation}
              onChange={(e) =>
                upsertManagerEval({
                  ...me,
                  submitted: false,
                  promotionRecommendation: e.target.value as any,
                })
              }
              disabled={!canManagerEdit}
            >
              <option value="YES">YES</option>
              <option value="MAYBE">MAYBE</option>
              <option value="NO">NO</option>
            </select>
          </label>

          <div className="flex justify-end gap-2">
            <Button
              onClick={submitManager}
              disabled={
                !isManager || me.submitted || rr.status === "HR_SIGNED_OFF" || !extremeRuleOk
              }
            >
              Submit manager evaluation
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HR Sign-off</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isHR && (
            <div className="text-sm text-neutral-700">
              Switch role to <b>HR</b> to sign off.
            </div>
          )}

          <div className="text-sm">
            Allowed only when status is <b>MANAGER_SUBMITTED</b>.
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => hrSignOff("NO_CHANGE")} disabled={!canHRSignOff}>
              Sign off: No change
            </Button>
            <Button
              onClick={() => hrSignOff("BONUS_ONLY")}
              disabled={!canHRSignOff}
              variant="secondary"
            >
              Sign off: Bonus only
            </Button>
            <Button
              onClick={() => hrSignOff("PROMOTION")}
              disabled={!canHRSignOff}
              variant="secondary"
            >
              Sign off: Promotion
            </Button>
            <Button onClick={() => hrSignOff("PIP")} disabled={!canHRSignOff} variant="danger">
              Sign off: PIP
            </Button>
            <Button
              onClick={sendBackToManager}
              disabled={!isHR || rr.status !== "MANAGER_SUBMITTED"}
              variant="secondary"
            >
              Send back to manager
            </Button>
          </div>

          <div className="text-xs text-neutral-500">
            Final rating is computed from manager category ratings + KRA weights at time of sign-off.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}