// Generates the four Vault Make scenario blueprints into make/blueprints/.
// Run with VAULT_PASSCODE set (the passcode never goes into git).
const fs = require('fs');
const path = require('path');
const code = require('./build.js');

const CONN = { notion: 14553885, github: 14573763, cloudinary: 14553812, openai: 14553790, gemini: 14569991 };
const HOOK = { action: 4398007, publish: 4398008, forge: 4398009 };
const URL = {
  publish: 'https://hook.eu2.make.com/xfh22l9c34wuyewkpto0waujbz9knym6',
  forge: 'https://hook.eu2.make.com/u0w759ql8jld633koosingutl3fh1lrl'
};
const DS = {
  vaults: 'c390cc11-6939-47ea-922f-9eaf6bf3697f',
  events: '80c81e68-bf65-40ec-9e44-f3081c554709',
  weeks: '6610f72b-a296-468b-9170-d1099552cf2b',
  forms: 'a09891a3-1d76-4d86-a024-65ae31e8e0dd'
};
const NO_ID = '00000000-0000-0000-0000-000000000000';
const REPO = '/repos/rdecaste/VaultQuest/contents/data.json';

let x = 0;
const pos = (y) => ({ x: (x += 300), y: y || 0 });
const meta = (name, y) => ({ designer: Object.assign(pos(y), { name }) });
const notion = (id, name, method, url, body, extra) => Object.assign({
  id, module: 'notion:makeApiCall', version: 1, metadata: meta(name),
  parameters: { __IMTCONN__: CONN.notion },
  mapper: { url, method, body: body || '', headers: [{ key: 'Content-Type', value: 'application/json' }], version: '2025-09-03' }
}, extra || {});
// JSON.stringify escapes the quotes inside Make expressions ({{f(x; "y")}}); Make needs them raw.
const rawExpr = s => s.replace(/"__RAW__(.*?)__RAW__"/g, '$1').replace(/\{\{[^}]*\}\}/g, m => m.replace(/\\"/g, '"'));
const query = (id, name, ds, body, extra) => notion(id, name, 'POST', '/v1/data_sources/' + ds + '/query', rawExpr(JSON.stringify(body)), extra);
const codeModule = (id, name, src, inputs) => ({
  id, module: 'code:ExecuteCode', version: 1, metadata: meta(name), parameters: {},
  mapper: { input: Object.entries(inputs).map(([name, value]) => ({ name, value })), language: 'javascript', inputFormat: 'editor', dependencies: [], codeEditorJavascript: src }
});
const http = (id, name, url, fields, extra) => Object.assign({
  id, module: 'http:ActionSendData', version: 3, metadata: meta(name),
  parameters: { handleErrors: true, useNewZLibDeCompress: true },
  mapper: {
    url, method: 'post', bodyType: 'x_www_form_urlencoded', formFields: Object.entries(fields).map(([key, value]) => ({ key, value })),
    gzip: true, timeout: 60, useMtls: false, serializeUrl: false, shareCookies: false, parseResponse: false,
    followRedirect: true, useQuerystring: false, followAllRedirects: false, rejectUnauthorized: true
  }
}, extra || {});
const respond = (id, name, body) => ({
  id, module: 'gateway:WebhookRespond', version: 1, metadata: meta(name), parameters: {},
  mapper: { body, status: '200', headers: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Access-Control-Allow-Origin', value: '*' }] }
});
const webhook = (id, name, hook) => ({ id, module: 'gateway:CustomWebHook', version: 1, metadata: meta(name), parameters: { hook, maxResults: 1 }, mapper: {} });
const sleep = (id, name, s) => ({ id, module: 'util:FunctionSleep', version: 1, metadata: meta(name), parameters: {}, mapper: { duration: s } });
const router = (id, name, routes) => ({ id, module: 'builtin:BasicRouter', version: 1, metadata: meta(name), mapper: null, routes: routes.map(flow => ({ flow })) });
const ignore = (id, name) => ({ id, module: 'builtin:Ignore', version: 1, metadata: meta(name, 400) });
const resume = (id, name) => ({ id, module: 'builtin:Resume', version: 1, metadata: meta(name, 400), mapper: {} });
const filter = (name, conditions) => ({ name, conditions });
const eq = (a, b) => ({ a, o: 'text:equal', b });
const gh = (id, name, method, body, extra) => Object.assign({
  id, module: 'github:makeRestApiCall', version: 4, metadata: meta(name), parameters: { __IMTCONN__: CONN.github },
  mapper: Object.assign({ url: REPO, method, headers: [{ key: 'Accept', value: 'application/vnd.github+json' }].concat(body ? [{ key: 'Content-Type', value: 'application/json' }] : []) },
    body ? { body } : { qs: [{ key: 'ref', value: 'main' }] })
}, extra || {});
const scenarioMeta = (instant, sequential) => ({ instant, version: 1, designer: { orphans: [] }, scenario: { dlq: false, slots: null, dataloss: false, maxErrors: 3, autoCommit: true, roundtrips: 1, sequential: !!sequential, confidential: false, autoCommitTriggerLast: false } });
const activeVaultQuery = (id) => query(id, 'Find Active Vault', DS.vaults, { filter: { property: 'Status', select: { equals: 'Active' } }, sorts: [{ timestamp: 'created_time', direction: 'descending' }], page_size: 1 });

// ---------------- Publish ----------------
function publish() {
  x = 0;
  const vid = '{{ifempty(3.body.results[1].id; "' + NO_ID + '")}}';
  return {
    name: 'Vault — Publish Dashboard',
    flow: [
      webhook(1, 'Publish Request', HOOK.publish),
      sleep(2, "Let Notion index the caller's writes", 2),
      activeVaultQuery(3),
      query(4, 'Read Vault Forms', DS.forms, { sorts: [{ property: 'Tier', direction: 'ascending' }], page_size: 50 }),
      query(5, 'Read Vault Events', DS.events, { filter: { property: 'Vault', relation: { contains: vid } }, sorts: [{ property: 'Occurred At', direction: 'descending' }], page_size: 100 }),
      query(6, 'Read Vault Weeks', DS.weeks, { filter: { property: 'Vault', relation: { contains: vid } }, sorts: [{ property: 'Week Start', direction: 'descending' }], page_size: 30 }),
      query(7, 'Read Opened Vaults (Loot Archive)', DS.vaults, { filter: { property: 'Status', select: { equals: 'Opened' } }, page_size: 50 }),
      gh(8, 'Read data.json + SHA', 'GET'),
      codeModule(9, 'Build Vault State', code.publish, {
        vault: '{{3.body.results[1]}}', forms: '{{4.body.results}}', events: '{{5.body.results}}', weeks: '{{6.body.results}}',
        archive: '{{7.body.results}}', existing: '{{toString(toBinary(8.body.content; "base64"))}}', reason: '{{1.reason}}'
      }),
      respond(10, 'Return the state to the caller', '{{9.result.json}}'),
      gh(11, 'Commit data.json', 'PUT', '{"message":"{{9.result.message}}","content":"{{base64(9.result.json)}}","sha":"{{8.body.sha}}","branch":"main"}', {
        filter: filter('Only commit when something changed', [[{ a: '{{9.result.changed}}', o: 'number:equal', b: '1' }]]),
        onerror: [
          gh(12, 'Re-read SHA after a 409', 'GET'),
          gh(13, 'Commit data.json (retry)', 'PUT', '{"message":"{{9.result.message}}","content":"{{base64(9.result.json)}}","sha":"{{12.body.sha}}","branch":"main"}'),
          ignore(14, 'Give up quietly; the next publish catches up')
        ]
      })
    ],
    metadata: scenarioMeta(true, false) // not sequential: a sequential webhook answers "Accepted" instead of the Respond module
  };
}

// ---------------- Forge Tier Visual ----------------
const IMAGE_PROMPT = [
  'Target display: iPhone portrait full-screen living wallpaper, 1206 x 2622 (aspect ratio 201:437). Keep the vault door and every essential detail inside the central 70% of the width and the middle band of the image. Keep the top 22% visually calm (open sky or plain rock) for a title overlay, and the bottom 22% visually calm (sand or soft shadow) for a metrics overlay.',
  '',
  'Subject: {{2.body.results[1].properties.`Scene Prompt`.rich_text[1].plain_text}}',
  '',
  'Art style: stylised hand-drawn comic-book illustration with thick black ink outlines, bold cel shading, hand-hatched shadows, gritty painterly textures and a saturated sun-bleached sci-fi frontier palette. One calm, monumental object with a strong silhouette that reads well on a phone. An original design: do not imitate any existing video game, logo, brand, symbol or character.',
  '',
  'No people, no creatures, no text, letters, numbers, logos, HUD or UI. A calm scene: no combat, no explosions, no weapons firing, no destruction, no flying debris.'
].join('\n');
const VIDEO_PROMPT = [
  'Use the supplied image as the exact visual source.',
  '',
  'Create a short seamless looping living-wallpaper video.',
  '',
  'CAMERA — LOCKED: keep the camera completely still from first frame to last. No zoom, pan, tilt, dolly, orbit, reframing, shake or perspective change.',
  '',
  'THE VAULT STAYS SHUT: the vault door and its structure keep exactly the same shape and position. No opening, no rotating doors, no parts sliding or unfolding, no new objects.',
  '',
  'ALLOWED MOTION ONLY: {{2.body.results[1].properties.Aura.rich_text[1].plain_text}}; gentle glow pulses in the energy core and lamps; slow drifting dust and heat haze; very subtle cloud or star movement in the sky.',
  '',
  'Return every animated element to its exact starting state by the final frame so the loop is seamless; first and final frame should match. No flashes, abrupt brightness changes, cuts or transitions. Portrait 9:16. Silent: no dialogue, music or sound effects.'
].join('\n');
function forge() {
  x = 0;
  const form = '2.body.results[1]';
  const tier = '{{ifempty(1.tier; 1)}}';
  return {
    name: 'Vault — Forge Tier Visual',
    flow: [
      webhook(1, 'Forge Request (tier, force)', HOOK.forge),
      query(2, 'Read Vault Form for tier', DS.forms, { filter: { property: 'Tier', number: { equals: '__RAW__' + tier + '__RAW__' } }, page_size: 1 }),
      {
        id: 3, module: 'openai-gpt-3:GenerateImage', version: 1, metadata: meta('Generate Vault Image'), parameters: { __IMTCONN__: CONN.openai },
        filter: filter('Only when this tier has no video yet, Regenerate is ticked, or force=1', [
          [{ a: '{{' + form + '.id}}', o: 'exist' }, { a: '{{' + form + '.properties.`Video Public ID`.rich_text[1].plain_text}}', o: 'notexist' }],
          [{ a: '{{' + form + '.id}}', o: 'exist' }, { a: '{{' + form + '.properties.Regenerate.checkbox}}', o: 'boolean:equal', b: 'true' }],
          [{ a: '{{' + form + '.id}}', o: 'exist' }, eq('{{1.force}}', '1')]
        ]),
        mapper: { n: 1, size: '1024x1536', model: 'gpt-image-2.5-flare', prompt: IMAGE_PROMPT, quality: 'high', background: 'opaque', moderation: 'low', output_format: 'png' },
        onerror: [ignore(30, 'Image blocked — nothing changed')]
      },
      {
        id: 4, module: 'cloudinary:UploadResource', version: 1, metadata: meta('Upload Vault Image'), parameters: { __IMTCONN__: CONN.cloudinary },
        mapper: { file: '{{3.data[].fileData}}', type: 'upload', folder: 'Vault-Board', file_type: 'data', mime_type: 'image/png', resourceType: 'image', public_id: 'vault-tier-' + tier + '-{{formatDate(now; "YYYYMMDD-HHmmss")}}', use_filename: false },
        onerror: [ignore(31, 'Upload failed — nothing changed')]
      },
      {
        id: 5, module: 'gemini-ai:generateAVideoV2', version: 1, metadata: meta('Animate Vault Image'), parameters: { __IMTCONN__: CONN.gemini },
        mapper: { model: 'gemini-omni-flash-preview', images: [{ uri: '{{4.secure_url}}', mimeType: 'image/png', resolution: 'unspecified', upload_format: 'url' }], prompt: VIDEO_PROMPT, background: false, response_format: { aspectRatio: '9:16' } },
        // The image alone is still a usable visual: save it and publish.
        onerror: [
          notion(32, 'Save image only (video blocked)', 'PATCH', '/v1/pages/{{' + form + '.id}}', '{"properties":{"Image URL":{"url":"{{4.secure_url}}"}}}'),
          http(33, 'Republish with the still', URL.publish, { reason: 'Vault tier ' + tier + ' image forged (video pending)' }),
          ignore(34, 'Stop here')
        ]
      },
      {
        id: 6, module: 'cloudinary:UploadResource', version: 1, metadata: meta('Upload Vault Video'), parameters: { __IMTCONN__: CONN.cloudinary },
        mapper: { file: '{{5.data}}', type: 'upload', folder: 'Vault-Progress', file_type: 'data', mime_type: '{{5.mimeType}}', public_id: 'vault-tier-' + tier + '-{{formatDate(now; "YYYYMMDD-HHmmss")}}', resourceType: 'video', use_filename: false },
        onerror: [ignore(35, 'Video upload failed')]
      },
      notion(7, 'Save media on the Vault Form', 'PATCH', '/v1/pages/{{' + form + '.id}}',
        '{"properties":{"Image URL":{"url":"{{4.secure_url}}"},"Video Public ID":{"rich_text":[{"type":"text","text":{"content":"{{6.public_id}}"}}]},"Video Version":{"number":{{6.version}}},"Regenerate":{"checkbox":false}}}'),
      http(8, 'Republish Vault Dashboard', URL.publish, { reason: 'Vault tier ' + tier + ' visual forged' }, { onerror: [resume(36, 'A missed publish is caught up later')] })
    ],
    metadata: scenarioMeta(true, true)
  };
}

// ---------------- Action ----------------
function action() {
  x = 0;
  const fields = ['passcode', 'action', 'amount', 'reason', 'confirm', 'name', 'goal', 'target', 'starting', 'core', 'start_date', 'currency'];
  const inputs = {}; fields.forEach(f => { inputs[f] = '{{1.' + f + '}}'; });
  inputs.vault = '{{2.body.results[1]}}';
  const publishCall = (id, reason) => http(id, 'Publish and wait for the new state', URL.publish, { reason }, { onerror: [resume(id + 50, 'Dashboard catches up on the next publish')] });
  // The Publish reply arrives as a buffer; anything but the state JSON becomes null.
  const respondOk = (id, pub) => respond(id, 'Respond with result + state', '{"result":{{3.result.feedback}},"state":{{if(contains(toString(' + pub + '.data); "generated_at"); toString(' + pub + '.data); "null")}}}');
  return {
    name: 'Vault — Action',
    flow: [
      webhook(1, 'Dashboard Action', HOOK.action),
      activeVaultQuery(2),
      codeModule(3, 'Plan Action', code.action, inputs),
      router(4, 'Create, update or reject', [
        [
          notion(5, 'Create Vault', 'POST', '/v1/pages', '{{3.result.vault_body}}', { filter: filter('Create', [[eq('{{3.result.op}}', 'create')]]) }),
          router(6, 'Forge first form, then publish', [
            [http(7, 'Start Forge Tier Visual (tier 1)', URL.forge, { tier: '1' }, { onerror: [resume(57, 'Forge can be retried from Notion')] })],
            [publishCall(8, 'Vault forged: {{1.name}}'), respondOk(9, 8)]
          ])
        ],
        [
          notion(10, 'Update Vault', 'PATCH', '/v1/pages/{{2.body.results[1].id}}', '{{3.result.vault_patch}}', { filter: filter('Update', [[eq('{{3.result.op}}', 'update')]]) }),
          router(11, 'Write events, then publish', [
            [
              { id: 12, module: 'builtin:BasicFeeder', version: 1, metadata: meta('Each event'), mapper: { array: '{{3.result.events}}' } },
              notion(13, 'Create Vault Event', 'POST', '/v1/pages', '{{12.value}}')
            ],
            [publishCall(14, 'Vault {{3.result.code}}'), respondOk(15, 14)]
          ])
        ],
        [respond(16, 'Respond rejected', '{{3.result.response_body}}')].map(m => Object.assign(m, { filter: filter('Rejected', [[eq('{{3.result.op}}', 'reject')]]) }))
      ])
    ],
    metadata: scenarioMeta(true, false) // the page waits for this reply, so it must not queue
  };
}

// ---------------- Monday ----------------
function monday() {
  x = 0;
  const vid = '{{1.body.results[1].id}}';
  return {
    name: 'Vault — Monday Evaluation',
    flow: [
      activeVaultQuery(1),
      query(2, 'Read breaches since last evaluation', DS.events, {
        filter: { and: [
          { property: 'Vault', relation: { contains: vid } },
          { property: 'Type', select: { equals: 'BREACH' } },
          { property: 'Occurred At', date: { on_or_after: '{{ifempty(1.body.results[1].properties.`Last Evaluated Week`.date.start; "2000-01-01")}}' } }
        ] }, page_size: 100
      }, { filter: filter('Only with an active Vault', [[{ a: vid, o: 'exist' }]]) }),
      query(3, 'Read Vault Forms', DS.forms, { sorts: [{ property: 'Tier', direction: 'ascending' }], page_size: 50 }),
      codeModule(4, 'Evaluate finished weeks', code.monday, { vault: '{{1.body.results[1]}}', breaches: '{{2.body.results}}', forms: '{{3.body.results}}' }),
      router(5, 'Write weeks and events, then update the Vault', [
        [
          { id: 6, module: 'builtin:BasicFeeder', version: 1, metadata: meta('Each week / event'), mapper: { array: '{{4.result.creates}}' } },
          notion(7, 'Create week or event', 'POST', '/v1/pages', '{{6.value}}')
        ],
        [
          notion(8, 'Update Vault progression', 'PATCH', '/v1/pages/' + vid, '{{4.result.vault_patch}}', { filter: filter('Something was evaluated', [[{ a: '{{4.result.vault_patch}}', o: 'exist' }]]) }),
          http(9, 'Publish Vault Dashboard', URL.publish, { reason: 'Monday evaluation: {{substring(4.result.summary; 0; 90)}}' }, { onerror: [resume(59, 'Publish catches up later')] }),
          http(10, 'Forge the new tier visual', URL.forge, { tier: '{{4.result.tier}}' }, { filter: filter('Only after a tier-up', [[{ a: '{{4.result.tier_up}}', o: 'number:equal', b: '1' }]]) })
        ]
      ])
    ],
    metadata: scenarioMeta(false, true)
  };
}

const out = { publish: publish(), forge: forge(), action: action(), monday: monday() };
module.exports = out;
if (require.main === module) {
  const dir = path.join(__dirname, 'blueprints');
  fs.mkdirSync(dir, { recursive: true });
  for (const [k, v] of Object.entries(out)) fs.writeFileSync(path.join(dir, k + '.json'), JSON.stringify(v, null, 2));
  console.log('written', Object.keys(out).join(', '));
}
