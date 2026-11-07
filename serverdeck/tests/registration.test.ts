import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { Project } from "../src/types.ts";

test("RDAP caches only matching registration data and keeps manual fields separate", async () => {
  const temporary = mkdtempSync(path.join(tmpdir(), "server-deck-rdap-test-"));
  process.env.SERVER_DECK_DATA_DIR = temporary;
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(
      JSON.stringify({
        ldhName: "sample.cyou",
        events: [
          { eventAction: "expiration", eventDate: "2027-08-18T23:59:59Z" },
        ],
        entities: [
          {
            roles: ["registrar"],
            vcardArray: [
              "vcard",
              [
                ["fn", {}, "text", "Test registrar"],
                ["email", {}, "text", "do-not-retain@example.test"],
              ],
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/rdap+json" } },
    );
  };
  try {
    const { refreshRegistrations, withRegistrations } = await import(
      "../server/registration.ts"
    );
    const project: Project = {
      id: "test",
      serverId: "test",
      originKey: "manual:test",
      name: "Test",
      description: "",
      directory: "",
      services: [],
      endpoints: [
        {
          url: "https://sample.cyou",
          source: "manual",
          registrar: "My manual registrar",
        },
        { url: "https://www.sample.cyou", source: "nginx" },
      ],
      source: "manual",
      metricSource: null,
      confirmed: true,
      cpuPercent: null,
      memoryBytes: null,
    };
    await refreshRegistrations([project]);
    await refreshRegistrations([project]);
    assert.equal(calls, 1);
    const enriched = withRegistrations(project);
    assert.equal(enriched.endpoints[0].registrar, "My manual registrar");
    assert.equal(
      enriched.endpoints[0].registration?.registrar,
      "Test registrar",
    );
    assert.equal(
      enriched.endpoints[1].registration?.expiresAt,
      "2027-08-18T23:59:59Z",
    );
    assert.equal(JSON.stringify(enriched).includes("do-not-retain"), false);
    await refreshRegistrations([
      {
        ...project,
        endpoints: [{ url: "https://other.cyou", source: "manual" }],
      },
    ]);
    assert.equal(
      withRegistrations({
        ...project,
        endpoints: [{ url: "https://other.cyou", source: "manual" }],
      }).endpoints[0].registration,
      undefined,
    );
  } finally {
    globalThis.fetch = original;
    const target = path.resolve(temporary);
    if (
      !target.startsWith(path.resolve(tmpdir()) + path.sep) ||
      !path.basename(target).startsWith("server-deck-rdap-test-")
    )
      throw new Error("Unexpected test directory");
    rmSync(target, { recursive: true, force: true });
  }
});
