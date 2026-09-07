// Source module for the client bundle. Edit here, then regenerate
// client/client.js with: npm run build:client

const NS = "skillFusion";
const name = "dsh-skill-fusion";
const inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "skill-fusion: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("settings.section", () => {
    const off = ctx.slots.register({
      name: "settings.section",
      id: "skill-fusion",
      order: 15,
      label: () => t("nav"),
      locale: NS,
      inject: () => ({}),
    }, (props) => react.createElement(SkillForgeView, Object.assign({}, props, { t })));
    return off;
  });
}
exports.name = name;
exports.apply = apply;
exports.inject = inject;
