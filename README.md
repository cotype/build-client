# Create TypeScript clients from cotype API specs

## Usage

```
npx @cotype/build-client <spec> <dest>
```

Where `<spec>` is the URL of a cotype swagger.json spec and `<dest>` is the location of the `.ts` file to be generated.

```
npx @cotype/build-client https://example.com/rest/swagger.json ./lib/Api.ts
```

#### Bin

This package exposes the `cotype-build-client` binary when being installed as a
dependency or globally.

## Configuration

The tool looks for a `client.config.js` in the provided dest folder or any of its parents
when being used via cli.

### Joining

Requests to the cotype REST api can specify if they want to _join_ data of referenced contents (rather than just returning their IDs and links).

For each endpoint we can fine-tune which data should be joined:

```js
module.exports = () => [
  {
    name: "loadPet",
    join: [{ type: "Owner", props: ["name"] }]
  }
];
```

The function receives an argument of the same shape that lists everything that _could possibly_ be joined. Hence the folling config would join every property of every referenced content:

```js
module.exports = methods => methods;
```

While joining everything is usually not what we want, this approach allows us to write config files that don't need to be updated with every single model change. We could for example specify what to include on a per-type basis:

```js
const propsToJoin = { Contact: ["name", "email"] };

module.exports = methods =>
  methods.map(({ name, join }) => ({
    name,
    join: join.map(({ type, props }) => ({
      type,
      props: propsToJoin[type]
    }))
  }));
```

# License

MIT
