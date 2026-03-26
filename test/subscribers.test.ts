import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSubscriberQuery,
  formatSubscriberOutput,
} from "../dist/commands/subscribers.js";
import type { Subscriber } from "../src/types.ts";

test("buildSubscriberQuery combines raw query and convenience filters", () => {
  const query = buildSubscriberQuery({
    query: "subscribers.id > 10",
    email: "o'hara@example.com",
    name: "Juan_Pablo%Test",
    status: "enabled",
  });

  assert.equal(
    query,
    "(subscribers.id > 10) AND subscribers.email = 'o''hara@example.com' AND subscribers.name ILIKE '%Juan\\_Pablo\\%Test%' AND subscribers.status = 'enabled'",
  );
});

test("formatSubscriberOutput json mode returns JSON", () => {
  const subscriber: Subscriber = {
    id: 42,
    email: "user@example.com",
    name: "User Example",
    status: "enabled",
  };

  const out = formatSubscriberOutput(subscriber, { json: true });
  assert.match(out, /"id": 42/);
  assert.match(out, /"email": "user@example.com"/);
});

test("formatSubscriberOutput default includes lists and attribs", () => {
  const subscriber: Subscriber = {
    id: 7,
    email: "user@example.com",
    name: "User Example",
    status: "enabled",
    attribs: { cohort: "may" },
    lists: [
      {
        id: 19,
        name: "Alumnos - AI Expert (Mayo 2026)",
      },
    ],
  };

  const out = formatSubscriberOutput(subscriber);
  assert.match(out, /ID: 7/);
  assert.match(out, /Lists: 19:Alumnos - AI Expert \(Mayo 2026\)/);
  assert.match(out, /Attribs: \{"cohort":"may"\}/);
});
