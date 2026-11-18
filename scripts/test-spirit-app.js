const assert = require("node:assert/strict");
const { appUrl, configuredAppUrl, inviteEmbed, inviteComponents, canPublish, handleLaunchButton, ACTIVITY_LAUNCH_ID } = require("../src/spirit-app");
const { PermissionFlagsBits } = require("discord.js");

assert.equal(appUrl("https://spirit.example.com"), "https://spirit.example.com/");
assert.equal(configuredAppUrl(""), "https://duh-svobody-app.vercel.app/");
assert.equal(configuredAppUrl("https://custom.example.com/path"), "https://custom.example.com/path");
assert.equal(configuredAppUrl("http://unsafe.example.com"), null);
for (const value of ["http://spirit.example.com", "javascript:alert(1)", "https://user:pass@example.com", "https://localhost", "https://example.com/#secret"]) {
  assert.equal(appUrl(value), null, value);
}
assert.equal(inviteEmbed("HERADE HOUSE").data.title, "🕊️ ДУХ СВОБОДЫ • APP");
const launchButton = inviteComponents()[0].components[0].toJSON();
assert.equal(launchButton.custom_id, ACTIVITY_LAUNCH_ID);
assert.equal(launchButton.url, undefined, "Activity launch must not send users to an external site.");
assert.equal(launchButton.label, "🚀 Открыть в Discord");
assert.equal(launchButton.style, 1);
(async () => {
  let launches = 0;
  const interaction = {
    customId: ACTIVITY_LAUNCH_ID,
    isButton: () => true,
    launchActivity: async () => { launches++; },
  };
  assert.equal(await handleLaunchButton(interaction), true);
  assert.equal(launches, 1);
  assert.equal(await handleLaunchButton({ ...interaction, customId: "some:other" }), false);
  assert.equal(launches, 1);
  console.log("Spirit Activity button interaction checks passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
const channel = { isTextBased: () => true, send: () => {}, permissionsFor: () => ({
  has: (flag) => [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks].includes(flag),
}) };
assert.equal(canPublish(channel, {}), true);
assert.equal(canPublish({ ...channel, send: null }, {}), false);
console.log("Spirit App helper checks passed");
