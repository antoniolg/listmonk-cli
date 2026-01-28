import assert from "node:assert/strict";
import test from "node:test";
import { formatCampaignOutput } from "../src/commands/campaigns.js";
import type { Campaign } from "../src/types.js";

test("formatCampaignOutput: json mode returns JSON", () => {
  const campaign: Campaign = {
    id: 42,
    name: "April newsletter",
    subject: "Hello",
    body: "<h1>Hi</h1>",
    status: "draft",
  };

  const out = formatCampaignOutput(campaign, { json: true });
  assert.match(out, /"id": 42/);
  assert.match(out, /"name": "April newsletter"/);
});

test("formatCampaignOutput: default includes body section", () => {
  const campaign: Campaign = {
    id: 1,
    name: "N",
    subject: "S",
    body: "Body text",
    from_email: "team@example.com",
  };

  const out = formatCampaignOutput(campaign);
  assert.match(out, /ID: 1/);
  assert.match(out, /From: team@example\.com/);
  assert.match(out, /--- BODY ---/);
  assert.match(out, /Body text/);
});

