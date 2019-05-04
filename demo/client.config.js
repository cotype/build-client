const propsToJoin = { Contact: ["name", "email"] };

module.exports = methods =>
  methods.map(({ name, join }) => ({
    name,
    join: join.map(({ type, props }) => ({
      type,
      props: propsToJoin[type]
    }))
  }));
