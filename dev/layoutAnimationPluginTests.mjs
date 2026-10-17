import assert from 'node:assert/strict';
import test from 'node:test';

import stylelint from 'stylelint';

import { LAYOUT_ANIMATION_RULE } from './layoutAnimationPlugin.mjs';

async function lint(code) {
  const { results: [result] } = await stylelint.lint({
    code,
    codeFilename: 'layoutAnimation.scss',
    configFile: '.stylelintrc.json',
  });

  return {
    errored: result.errored,
    rejected: result.warnings.filter(({ rule }) => rule === LAYOUT_ANIMATION_RULE).map(({ text }) => text),
  };
}

test('rejects layout properties passed to the transition mixin', async () => {
  const { rejected } = await lint(`
    $offset-transition: top 200ms;

    .a { @include mixins.transition('opacity 150ms, max-width 150ms', !important); }
    .b { @include mixins.transition($offset-transition); }
  `);

  assert.equal(rejected.length, 2);
  assert.match(rejected[0], /"max-width 150ms"/);
  assert.match(rejected[1], /"top 200ms"/);
});

test('accepts compositor and paint properties in any mixin argument form', async () => {
  const { rejected } = await lint(`
    .a { @include mixins.transition(transform 200ms cubic-bezier(0.32, 0.72, 0, 1)); }
    .b { @include t.transition("background-color 200ms, clip-path 200ms"); }
    .c { @include mixins.transition(v.$imported-transition); }
  `);

  assert.deepEqual(rejected, []);
});

test('leaves a redeclared variable unchecked instead of guessing its scope', async () => {
  // `.b` reads the global `opacity` value, while the local `top` value is visible only inside `.a`
  const { rejected } = await lint(`
    $offset-transition: opacity 200ms;

    .a { $offset-transition: top 200ms; }
    .b { @include mixins.transition($offset-transition); }
  `);

  assert.deepEqual(rejected, []);
});

test('rejects grid-template-* in transitions and keyframes', async () => {
  const { rejected } = await lint(`
    .a { transition: 200ms grid-template-rows ease; }
    .b { @include mixins.transition('grid-template-columns 200ms'); }

    @keyframes collapse {
      to { grid-template-areas: "a"; }
    }
  `);

  assert.equal(rejected.length, 3);
});

test('a disable comment silences a mixin transition without failing the file', async () => {
  // `errored` reflects every rule, so the snippet is formatted to pass all of them
  const { errored, rejected } = await lint([
    '.a {',
    `  @include mixins.transition('top 200ms'); // stylelint-disable-line ${LAYOUT_ANIMATION_RULE}`,
    '}',
    '',
  ].join('\n'));

  assert.deepEqual(rejected, []);
  assert.equal(errored, false);
});
