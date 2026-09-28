import { beforeEach, describe, expect, test } from "bun:test";
import {
  getCitizenReports, getDataset, getIncidentQueue, getNotificationsFor, getVenueDetail,
  resetDemoOverlay, submitInspection, submitReporterFeedback, submitResolution,
} from "../data";

// Deterministic demo ids (scripts/seed.ts keeps these stable).
const ABC = "00000000-0000-4000-8000-002000000001"; // hero venue, 240d-old inspection, URGENT
const CITIZEN = "00000000-0000-4000-8000-001000000001"; // Priya Sharma
const INSPECTOR = "00000000-0000-4000-8000-001000000002"; // R.K. Verma

/** Venue of the citizen's open electrical-wiring report (citizen_fail signal). */
async function citizenWiringVenue(): Promise<string> {
  const data = await getDataset();
  const report = data.reports.find(
    (r) =>
      r.reporterId === CITIZEN &&
      r.incidentId &&
      data.incidents.some((i) => i.id === r.incidentId && i.issueKey === "electrical_wiring" && i.status === "open"),
  );
  return report!.venueId;
}

beforeEach(() => {
  resetDemoOverlay();
});

describe("Phase 3 — audit flips items to the verified trust tier", () => {
  test("item_states flip to source='inspection', passport shows the verified chip, risk drops, queue reranks", async () => {
    const venueId = await citizenWiringVenue();

    const before = await getVenueDetail(venueId);
    expect(before).not.toBeNull();
    const wiringRowBefore = before!.checklist
      .flatMap((c) => c.rows)
      .find((r) => r.item.key === "electrical_wiring");
    expect(wiringRowBefore?.display).toBe("citizen_fail"); // citizen signal before the audit

    const outcome = await submitInspection({
      venueId,
      inspectorId: INSPECTOR,
      items: [
        { itemKey: "electrical_wiring", status: "fail" },
        { itemKey: "fire_extinguisher", status: "pass" },
      ],
    });

    expect(outcome.persisted).toBe("demo");
    expect(outcome.updatedItems).toContain("electrical_wiring");

    const after = await getVenueDetail(venueId);
    const rows = after!.checklist.flatMap((c) => c.rows);
    // the failed item: verified tier overrides the citizen signal
    const wiringRowAfter = rows.find((r) => r.item.key === "electrical_wiring");
    expect(wiringRowAfter?.state?.source).toBe("inspection");
    expect(wiringRowAfter?.display).toBe("confirmed_fail");
    // the passing item: the GREEN verified chip
    const extinguisherRow = rows.find((r) => r.item.key === "fire_extinguisher");
    expect(extinguisherRow?.display).toBe("verified_pass");

    // open incidents at the venue moved to 'verified' and the queue reflects it
    expect(outcome.verifiedIncidents.length).toBeGreaterThan(0);
    const queue = await getIncidentQueue();
    const entry = queue.find((q) => q.venueId === venueId);
    expect(entry?.status).toBe("verified");

    // risk drops on a venue whose stale inspection just got refreshed
    const abcOutcome = await submitInspection({
      venueId: ABC,
      inspectorId: INSPECTOR,
      items: [{ itemKey: "exit_accessibility", status: "fail" }],
    });
    expect(abcOutcome.riskAfter).toBeLessThan(abcOutcome.riskBefore);
  });
});

describe("Phase 3 — resolution writes history + notifications", () => {
  test("audit → action_taken → resolved with history events and reporter notifications", async () => {
    const audit = await submitInspection({
      venueId: ABC,
      inspectorId: INSPECTOR,
      items: [{ itemKey: "exit_accessibility", status: "fail" }],
    });
    expect(audit.verifiedIncidents.length).toBeGreaterThan(0);

    const data = await getDataset();
    const notifiedBefore = (await getNotificationsFor(CITIZEN)).length;
    const citizenReport = data.reports.find(
      (r) => r.venueId === ABC && r.reporterId === CITIZEN && r.incidentId,
    );
    expect(citizenReport).toBeDefined();

    const resolution = await submitResolution({
      venueId: ABC,
      inspectorId: INSPECTOR,
      notice: "Exit cleared and certified unobstructed.",
      reverify: [{ itemKey: "exit_accessibility", fixed: true }],
    });

    expect(resolution.persisted).toBe("demo");
    expect(resolution.resolvedIncidents).toEqual(audit.verifiedIncidents);
    expect(resolution.reverifiedPass).toContain("exit_accessibility");
    expect(resolution.riskAfter).toBeLessThanOrEqual(resolution.riskBefore);

    // history: verified → action_taken → resolved all recorded
    const after = await getDataset();
    const types = new Set(
      after.historyEvents
        .filter((h) => audit.verifiedIncidents.includes(h.incidentId ?? ""))
        .map((h) => h.eventType),
    );
    expect(types.has("incident_verified")).toBe(true);
    expect(types.has("action_taken")).toBe(true);
    expect(types.has("incident_resolved")).toBe(true);

    // notification written for the reporter
    const notified = await getNotificationsFor(CITIZEN);
    expect(notified.length).toBeGreaterThan(notifiedBefore);
    expect(notified.some((n) => n.title.includes("You helped fix"))).toBe(true);

    // the citizen's report card shows the resolved lifecycle + timeline
    const cards = await getCitizenReports(CITIZEN);
    const card = cards.find((c) => c.report.id === citizenReport!.id);
    expect(card?.lifecycle).toBe("resolved");
    expect(
      card?.timeline.some((t) => t.eventType === "incident_resolved"),
    ).toBe(true);
  });
});

describe("Phase 3 — 'Still exists' reopens the incident", () => {
  test("reporter feedback bumps report_count and reopens with risk recomputed", async () => {
    // Build the prerequisite state: audit + resolve, then the citizen disputes.
    await submitInspection({
      venueId: ABC,
      inspectorId: INSPECTOR,
      items: [{ itemKey: "exit_accessibility", status: "fail" }],
    });
    await submitResolution({
      venueId: ABC,
      inspectorId: INSPECTOR,
      notice: "Cleared.",
      reverify: [{ itemKey: "exit_accessibility", fixed: true }],
    });

    const before = await getDataset();
    const incident = before.incidents.find(
      (i) => i.venueId === ABC && i.issueKey === "exit_accessibility",
    )!;
    expect(incident.status).toBe("resolved");
    const countBefore = incident.reportCount;
    const report = before.reports.find(
      (r) => r.incidentId === incident.id && r.reporterId === CITIZEN,
    )!;

    const outcome = await submitReporterFeedback(report.id, "still_exists");

    expect(outcome.verdict).toBe("still_exists");
    expect(outcome.reopenedIncidentId).toBe(incident.id);
    expect(outcome.newReportCount).toBe(countBefore + 1);

    const after = await getDataset();
    const reopened = after.incidents.find((i) => i.id === incident.id)!;
    expect(reopened.status).toBe("open");
    expect(reopened.reportCount).toBe(countBefore + 1);
    expect(after.historyEvents.some((h) => h.eventType === "incident_reopened")).toBe(true);

    // accountability: the reopened critical pushes the venue back up the queue
    const queue = await getIncidentQueue();
    const abcEntry = queue.find((q) => q.venueId === ABC);
    expect(abcEntry?.status).toBe("open");

    // 'fixed' feedback records the confirmation instead
    const fixed = await submitReporterFeedback(report.id, "fixed");
    expect(fixed.reopenedIncidentId).toBeNull();
  });
});
