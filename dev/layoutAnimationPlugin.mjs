import postcss from 'postcss';
import stylelint from 'stylelint';

export const LAYOUT_ANIMATION_RULE = 'plugin/no-layout-animation-properties';

const BASE_RULE = 'plugin/no-low-performance-animation-properties';
const GRID_TEMPLATE_PROPERTIES = new Set([
  'grid-template',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
]);
const TRANSITION_MIXIN_REGEX = /^(?:[\w-]+\.)?transition\((.*)\)$/s;
const QUOTED_REGEX = /^(['"])(.*)\1$/s;

const messages = stylelint.utils.ruleMessages(LAYOUT_ANIMATION_RULE, {
  rejected: (transition) => `Unexpected layout property animation in "${transition}". Let the layout jump `
    + 'to its final state and play the change out with `transform` and `clip-path` (src/util/layoutChangeAnimation.ts)',
});

// The base rule reads only plain `transition` declarations and `@keyframes`, so transitions passed to the
// `transition` mixin escape it, and its property list has no `grid-template-*`. This rule closes both gaps.
export default stylelint.createPlugin(LAYOUT_ANIMATION_RULE, () => async (root, result) => {
  const mixinTransitions = buildMixinTransitions(root);

  mixinTransitions.forEach((include, transition) => {
    if (getIsGridTemplateAnimated(transition.value)) reportRejected(result, include, transition.value);
  });

  root.walkDecls(/^transition(-property)?$/, (decl) => {
    postcss.list.comma(decl.value)
      .filter(getIsGridTemplateAnimated)
      .forEach((transition) => reportRejected(result, decl, transition));
  });

  root.walkAtRules(/^keyframes$/i, (keyframes) => {
    keyframes.walkDecls((decl) => {
      if (GRID_TEMPLATE_PROPERTIES.has(decl.prop)) reportRejected(result, decl, decl.prop);
    });
  });

  const baseRuleSettings = result.stylelint.config?.rules?.[BASE_RULE];
  if (!baseRuleSettings || !mixinTransitions.size) return;

  await stylelint.utils.checkAgainstRule({
    ruleName: BASE_RULE,
    ruleSettings: baseRuleSettings,
    root: postcss.root().append(...mixinTransitions.keys()),
    // The base rule marks the result it reports to as failed. A copy keeps that flag off this file,
    // so a mixin line silenced with a disable comment for this rule does not fail the lint.
    result: { stylelint: { ...result.stylelint } },
  }, (warning) => {
    reportRejected(result, mixinTransitions.get(warning.node), warning.node.value);
  });
});

// Each transition becomes a separate `transition` declaration, so a warning on it names the exact transition.
// A variable declared once in the same file is resolved. Imported and redeclared ones stay unchecked:
// a redeclared variable can hold a different value in each Sass scope.
function buildMixinTransitions(root) {
  const variables = new Map();
  root.walkDecls(/^\$/, (decl) => {
    variables.set(decl.prop, variables.has(decl.prop) ? undefined : decl.value);
  });

  const transitions = new Map();
  root.walkAtRules('include', (include) => {
    const args = include.params.match(TRANSITION_MIXIN_REGEX)?.[1];
    if (!args) return;

    const [value] = postcss.list.comma(args);
    const unquotedValue = (variables.get(value) ?? value).replace(QUOTED_REGEX, '$2');

    postcss.list.comma(unquotedValue).forEach((transition) => {
      // The base rule locates the value by the `between` raw and reports the line from the node source
      const decl = postcss.decl({
        prop: 'transition',
        value: transition,
        raws: { between: ': ' },
        source: include.source,
      });
      transitions.set(decl, include);
    });
  });

  return transitions;
}

function getIsGridTemplateAnimated(transition) {
  return postcss.list.space(transition).some((word) => GRID_TEMPLATE_PROPERTIES.has(word));
}

function reportRejected(result, node, transition) {
  stylelint.utils.report({
    ruleName: LAYOUT_ANIMATION_RULE,
    result,
    node,
    message: messages.rejected(transition),
  });
}
