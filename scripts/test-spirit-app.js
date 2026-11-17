const assert = require("node:assert/strict");
const { appUrl, configuredAppUrl, inviteEmbed, inviteComponents, canPublish } = require("../src/spirit-app");
const { PermissionFlagsBits } = require("discord.js");

assert.equal(appUrl("https://spirit.example.com"), "https://spirit.example.com/");
assert.equal(configuredAppUrl(""), "https://duh-svobody-app.vercel.app/");
assert.equal(configuredAppUrl("https://custom.example.com/path"), "https://custom.example.com/path");
assert.equal(configuredAppUrl("http://unsafe.example.com"), null);
for (const value of ["http://spirit.example.com", "javascript:alert(1)", "https://user:pass@example.com", "https://localhost", "https://example.com/#secret"]) {
  assert.equal(appUrl(value), null, value);
}
assert.equal(inviteEmbed("HERADE HOUSE").data.title, "🕊️ ДУХ СВОБОДЫ • APP");
assert.equal(inviteComponents("https://spirit.example.com/")[0].components[0].data.url, "https://spirit.example.com/");
const channel = { isTextBased: () => true, send: () => {}, permissionsFor: () => ({
  has: (flag) => [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks].includes(flag),
}) };
assert.equal(canPublish(channel, {}), true);
assert.equal(canPublish({ ...channel, send: null }, {}), false);
console.log("Spirit App helper checks passed");
