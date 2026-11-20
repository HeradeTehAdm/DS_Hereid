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
assert.equal(inviteEmbed("HERADE HOUSE").data.title, "🕊️ Дух Свободы");
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
  let deniedMessage = null;
  assert.equal(await handleLaunchButton({
    ...interaction,
    memberPermissions: { has: () => false },
    reply: async (message) => { deniedMessage = message; },
  }), true);
  assert.match(deniedMessage.content, /Использовать активности/);
  assert.equal(deniedMessage.flags, 64);
  assert.equal(launches, 1);
  const warnings = [];
  const logger = { warn: (message) => warnings.push(message) };
  for (const [code, phrase] of [[50013, "Use Activities"], [10062, "expired"]]) {
    assert.equal(await handleLaunchButton({
      ...interaction, launchActivity: async () => {
        throw Object.assign(new Error("Discord error"), { code });
      },
    }, logger), true);
    assert.match(warnings.at(-1), new RegExp(phrase));
  }
  assert.equal(launches, 1);
  await assert.rejects(() => handleLaunchButton({
    ...interaction, launchActivity: async () => {
      throw Object.assign(new Error("other API error"), { code: 50001 });
    },
  }, logger), /other API error/);
  console.log("Spirit Activity button interaction checks passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
const channel = { isTextBased: () => true, send: () => {}, permissionsFor: () => ({
  has: (flag) => [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks].includes(flag),
}) };
assert.equal(canPublish(channel, {}), true);
assert.equal(canPublish({ ...channel, send: null }, {}), false);
console.log("Spirit App helper checks passed");
