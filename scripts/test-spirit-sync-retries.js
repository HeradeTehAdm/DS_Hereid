"use strict";

const assert = require("node:assert/strict");
const { networkErrorText, retryDelayMs } = require("../src/spirit-outbound-sync");

assert.equal(networkErrorText(Object.assign(new Error("socket failure"), { code: "ETIMEDOUT" })), "ETIMEDOUT");
assert.equal(networkErrorText(new TypeError("fetch failed", {
  cause: Object.assign(new Error("connect failure"), { code: "ENETUNREACH" }),
})), "ENETUNREACH");
assert.equal(networkErrorText(new TypeError("fetch failed", {
  cause: Object.assign(new Error("operation timed out"), { name: "TimeoutError" }),
})), "HTTPS request timeout");
assert.equal(networkErrorText(new TypeError("fetch failed")), "TypeError");
assert.equal(retryDelayMs(1), 30000);
assert.equal(retryDelayMs(2), 60000);
assert.equal(retryDelayMs(3), 120000);
assert.equal(retryDelayMs(99), 900000);
console.log("Spirit sync retry and network diagnostic checks passed");
