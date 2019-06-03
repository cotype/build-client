#!/usr/bin/env node

import fs from "fs";
import path from "path";
import findUp from "find-up";
import { fetchSpec } from "@cotype/oazapfts";

import { generateClient } from "./";

async function generate(spec: string, configFile: string, dest: string) {
  const json = await fetchSpec(spec);
  const config = require(path.resolve(configFile));
  const code = await generateClient(json, config);
  if (dest) fs.writeFileSync(dest, code);
  else console.log(code);
}

const [, , spec, dest] = process.argv;
if (spec && dest) {
  const out = path.resolve(dest);
  const config = findUp.sync("client.config.js", { cwd: path.dirname(out) });
  if (config) {
    generate(spec, config, out);
  } else {
    console.error("Missing config file: client.config.js");
  }
} else {
  console.error(`Usage: cotype-build-client <spec> <dest>`);
}
