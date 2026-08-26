import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameOriginRequest } from "../lib/same-origin.js";

test("rejects sec-fetch-site cross-site", () => {
  assert.equal(isSameOriginRequest({ headers: { "sec-fetch-site": "cross-site", host: "127.0.0.1:3080" } }), false);
});
test("rejects mismatched origin host", () => {
  assert.equal(isSameOriginRequest({ headers: { origin: "https://evil.com", host: "127.0.0.1:3080" } }), false);
});
test("accepts same origin host", () => {
  assert.equal(isSameOriginRequest({ headers: { origin: "http://127.0.0.1:3080", host: "127.0.0.1:3080" } }), true);
});
test("accepts when no origin header present", () => {
  assert.equal(isSameOriginRequest({ headers: { host: "127.0.0.1:3080" } }), true);
});
test("accepts null origin", () => {
  assert.equal(isSameOriginRequest({ headers: { origin: "null", host: "127.0.0.1:3080" } }), true);
});
