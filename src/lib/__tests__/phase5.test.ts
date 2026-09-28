import { beforeEach, describe, expect, test } from "bun:test";
import {
  addReport, deleteReport, getDataset, getCitizenReports, isReportDeletable,
  ReportLockedError, resetDemoOverlay, submitInspection,
} from "../data";
import { buildSummary } from "../data";
import { REPORT_PHOTOS_BUCKET, deleteReportPhotoByUrl } from "../storage";

// Deterministic demo ids (scripts/seed.ts keeps these stable).
const CITIZEN = "00000000-0000-4000-8000-001000000001"; // Priya Sharma
const INSPECTOR = "00000000-0000-4000-8000-001000000002"; // R.K. Verma
/** A pristine venue — no incidents, no reports, no item states (Bhopali Adda). */
const PRISTINE = "00000000-0000-4000-8000-00200000004f";

/** The citizen's report on a seeded OPEN incident with the given count. */
async function citizenOpenReport(issueKey: string) {
  const data = await getDataset();
  const report = data.reports.find(
    (r) =>
      r.reporterId === CITIZEN &&
      r.incidentId &&
      data.incidents.some(
        (i) => i.id === r.incidentId && i.issueKey === issueKey && i.status === "open",
      ),
  );
  if (!report) throw new Error(`fixture missing: open ${issueKey} report for the citizen`);
  return report;
}

/** The citizen's report on an inspected incident with the given status. */
async function citizenLockedReport(incidentStatus: "verified" | "action_taken" | "resolved") {
  const data = await getDataset();
  const report = data.reports.find((r) => {
    if (r.reporterId !== CITIZEN || !r.incidentId) return false;
    const inc = data.incidents.find((i) => i.id === r.incidentId);
    return inc?.status === incidentStatus;
  });
  if (!report) throw new Error(`fixture missing: ${incidentStatus} report for the citizen`);
  return report;
}

beforeEach(() => {
  resetDemoOverlay();
});

// ---------------------------------------------------------------------------
// The delete gate (pure)
// ---------------------------------------------------------------------------

describe("Phase 5 — isReportDeletable (the gate)", () => {
  test("pending report on an 'open' (reported/triaged) incident is deletable", () => {
    expect(isReportDeletable({ status: "pending", incidentId: "inc-1" }, { status: "open" })).toBe(true);
  });

  test("pending report with no incident (never entered the pipeline) is deletable", () => {
    expect(isReportDeletable({ status: "pending", incidentId: null }, undefined)).toBe(true);
  });

  test("pending report on a missing incident row is deletable", () => {
    expect(isReportDeletable({ status: "pending", incidentId: "inc-gone" }, undefined)).toBe(true);
  });

  test("verified / action_taken / resolved incidents lock the report", () => {
    for (const status of ["verified", "action_taken", "resolved"] as const) {
      expect(isReportDeletable({ status: "pending", incidentId: "inc-1" }, { status })).toBe(false);
    }
  });

  test("an inspector-confirmed report is locked even while the incident is open", () => {
    expect(isReportDeletable({ status: "confirmed", incidentId: "inc-1" }, { status: "open" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Early delete allowed (full round-trip on a pristine venue)
// ---------------------------------------------------------------------------

describe("Phase 5 — early delete is allowed (before inspection)", () => {
  test("file → delete: report, incident, history and checklist signal all revert; risk recomputes", async () => {
    const before = await getDataset();
    const venue = before.venues.find((v) => v.id === PRISTINE)!;
    const riskBefore = buildSummary(venue, before).risk.score;
    const stateBefore = before.itemStates.find(
      (s) => s.venueId === PRISTINE && s.itemKey === "fire_extinguisher",
    );

    const filed = await addReport({
      venueId: PRISTINE,
      itemKey: "fire_extinguisher",
      title: "Fire extinguisher expired",
      description: "Cafe ke corner wala fire extinguisher expired hai, pressure zero",
      severity: "minor",
      hasPhoto: false,
      reporterId: CITIZEN,
    });
    expect(filed.createdIncident).toBe(true);

    // the report moved the venue: incident open, citizen checklist signal, risk up
    const mid = await getDataset();
    expect(mid.incidents.find((i) => i.id === filed.incidentId)?.reportCount).toBe(1);
    expect(
      mid.itemStates.find((s) => s.venueId === PRISTINE && s.itemKey === "fire_extinguisher"),
    ).toMatchObject({ status: "fail", source: "citizen" });
    expect(buildSummary(venue, mid).risk.score).toBeGreaterThan(riskBefore);

    // citizen sees their own new report
    expect((await getCitizenReports(CITIZEN)).some((c) => c.report.id === filed.reportId)).toBe(true);

    // delete it — the only report on the incident → the incident goes too
    const outcome = await deleteReport(filed.reportId, CITIZEN);
    expect(outcome.incidentDeleted).toBe(true);
    expect(outcome.incidentReportCount).toBeNull();
    expect(outcome.venue.risk.score).toBe(riskBefore); // recomputed on read

    const after = await getDataset();
    expect(after.reports.find((r) => r.id === filed.reportId)).toBeUndefined();
    expect(after.incidents.find((i) => i.id === filed.incidentId)).toBeUndefined();
    expect(after.historyEvents.filter((h) => h.incidentId === filed.incidentId)).toHaveLength(0);
    // the checklist signal this report wrote is reverted to the seeded state
    expect(
      after.itemStates.find((s) => s.venueId === PRISTINE && s.itemKey === "fire_extinguisher"),
    ).toEqual(stateBefore ?? undefined);

    // gone from the citizen's list as well
    expect((await getCitizenReports(CITIZEN)).some((c) => c.report.id === filed.reportId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Incident decrement (other reports keep the incident alive)
// ---------------------------------------------------------------------------

describe("Phase 5 — linked incident decrements (or is removed at 0)", () => {
  test("deleting one of several reports decrements report_count and keeps the incident", async () => {
    const data = await getDataset();
    const report = await citizenOpenReport("exit_accessibility"); // seeded, count 4
    const incident = data.incidents.find((i) => i.id === report.incidentId)!;
    expect(incident.reportCount).toBeGreaterThanOrEqual(2);

    const outcome = await deleteReport(report.id, CITIZEN);
    expect(outcome.incidentDeleted).toBe(false);
    expect(outcome.incidentReportCount).toBe(incident.reportCount - 1);

    const after = await getDataset();
    expect(after.reports.find((r) => r.id === report.id)).toBeUndefined();
    const survivors = after.reports.filter((r) => r.incidentId === incident.id);
    expect(survivors.length).toBe(incident.reportCount - 1); // the others stay
    expect(after.incidents.find((i) => i.id === incident.id)?.reportCount).toBe(
      incident.reportCount - 1,
    );
  });

  test("deleting the LAST report removes the incident and its history", async () => {
    const filed = await addReport({
      venueId: PRISTINE,
      itemKey: "first_aid",
      title: "First-aid kit empty",
      description: "The first-aid box behind the counter is empty",
      severity: "minor",
      hasPhoto: false,
      reporterId: CITIZEN,
    });

    // a second citizen corroborates → count 2
    await addReport({
      venueId: PRISTINE,
      itemKey: "first_aid",
      title: "First-aid kit empty",
      description: "Same here — first aid box has nothing inside",
      severity: "minor",
      hasPhoto: false,
      reporterId: INSPECTOR, // any other reporter profile works for the demo overlay
      linkToIncidentId: filed.incidentId,
    });
    expect((await getDataset()).incidents.find((i) => i.id === filed.incidentId)?.reportCount).toBe(2);

    // deleting one → 1, incident survives
    const first = await deleteReport(filed.reportId, CITIZEN);
    expect(first.incidentDeleted).toBe(false);
    expect(first.incidentReportCount).toBe(1);

    // deleting the other → 0, incident removed with its paper trail
    const data = await getDataset();
    const other = data.reports.find((r) => r.incidentId === filed.incidentId)!;
    const second = await deleteReport(other.id, other.reporterId);
    expect(second.incidentDeleted).toBe(true);
    const after = await getDataset();
    expect(after.incidents.find((i) => i.id === filed.incidentId)).toBeUndefined();
    expect(after.reports.filter((r) => r.incidentId === filed.incidentId)).toHaveLength(0);
    expect(after.historyEvents.filter((h) => h.incidentId === filed.incidentId)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Locked after inspection
// ---------------------------------------------------------------------------

describe("Phase 5 — locked after inspection (government record)", () => {
  test("seeded reports on verified / action_taken / resolved incidents refuse deletion", async () => {
    for (const status of ["verified", "action_taken", "resolved"] as const) {
      const report = await citizenLockedReport(status);
      await expect(deleteReport(report.id, CITIZEN)).rejects.toBeInstanceOf(ReportLockedError);
      await expect(deleteReport(report.id, CITIZEN)).rejects.toThrow(/Locked after inspection/i);
      // the report is still there
      const after = await getDataset();
      expect(after.reports.find((r) => r.id === report.id)).toBeDefined();
    }
  });

  test("an inspection run in THIS session locks the citizen's own report", async () => {
    const filed = await addReport({
      venueId: PRISTINE,
      itemKey: "fire_extinguisher",
      title: "Fire extinguisher expired",
      description: "Fire extinguisher expired at the counter",
      severity: "minor",
      hasPhoto: false,
      reporterId: CITIZEN,
    });

    // pre-inspection: deletable
    expect((await getCitizenReports(CITIZEN)).find((c) => c.report.id === filed.reportId)?.lifecycle)
      .toBe("reported");

    await submitInspection({
      venueId: PRISTINE,
      inspectorId: INSPECTOR,
      items: [{ itemKey: "fire_extinguisher", status: "fail" }], // verifies the report
    });

    expect((await getCitizenReports(CITIZEN)).find((c) => c.report.id === filed.reportId)?.lifecycle)
      .toBe("verified");
    await expect(deleteReport(filed.reportId, CITIZEN)).rejects.toBeInstanceOf(ReportLockedError);
  });
});

// ---------------------------------------------------------------------------
// Ownership / existence guards
// ---------------------------------------------------------------------------

describe("Phase 5 — delete guards", () => {
  test("another reporter cannot delete the report", async () => {
    const filed = await addReport({
      venueId: PRISTINE,
      itemKey: "fire_extinguisher",
      title: "Fire extinguisher expired",
      description: "Fire extinguisher expired",
      severity: "minor",
      hasPhoto: false,
      reporterId: CITIZEN,
    });
    await expect(deleteReport(filed.reportId, INSPECTOR)).rejects.toThrow(/another reporter/i);
  });

  test("a missing report id is a clean not-found", async () => {
    await expect(deleteReport("00000000-0000-4000-8000-ffffffffffff", CITIZEN)).rejects.toThrow(
      /not found/i,
    );
  });
});

// ---------------------------------------------------------------------------
// Evidence photo removal (bucket path extraction)
// ---------------------------------------------------------------------------

describe("Phase 5 — evidence photo removal", () => {
  /** Minimal fake of the storage API surface deleteReportPhotoByUrl touches. */
  function fakeAdmin(removed: string[][]): { storage: unknown } {
    return {
      storage: {
        from: (bucket: string) => {
          if (bucket !== REPORT_PHOTOS_BUCKET) throw new Error(`wrong bucket: ${bucket}`);
          return {
            remove: (paths: string[]) => {
              removed.push(paths);
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      },
    } as { storage: unknown };
  }

  test("a stored bucket URL is removed by its exact object path", async () => {
    const removed: string[][] = [];
    const url = `https://yolrpcoahakmobmkglzw.supabase.co/storage/v1/object/public/${REPORT_PHOTOS_BUCKET}/00000000-0000-4000-8000-002000000001/1718000000000-citizen123.jpg`;
    expect(await deleteReportPhotoByUrl(fakeAdmin(removed) as never, url)).toBe(true);
    expect(removed).toEqual([
      ["00000000-0000-4000-8000-002000000001/1718000000000-citizen123.jpg"],
    ]);
  });

  test("inline data URLs and demo placeholders have nothing to remove", async () => {
    const removed: string[][] = [];
    expect(await deleteReportPhotoByUrl(fakeAdmin(removed) as never, "data:image/jpeg;base64,abc")).toBe(false);
    expect(await deleteReportPhotoByUrl(fakeAdmin(removed) as never, "https://demo.safezone.app/photos/r1.jpg")).toBe(false);
    expect(removed).toEqual([]); // the bucket was never touched
  });

  test("a failed removal never throws — the report delete still proceeds", async () => {
    const failing = {
      storage: {
        from: () => ({
          remove: () => Promise.resolve({ data: null, error: { message: "boom" } }),
        }),
      },
    } as { storage: unknown };
    expect(
      await deleteReportPhotoByUrl(failing as never, `https://x.supabase.co/storage/v1/object/public/${REPORT_PHOTOS_BUCKET}/v/p.jpg`),
    ).toBe(false);
  });
});
