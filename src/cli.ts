#!/usr/bin/env node

import fs from "fs";
import path from "path";
import findUp from "find-up";

import { generateClient } from "./";

async function generate(spec: string, config: string, dest: string) {
  const code = await generateClient(spec, path.resolve(config));
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
  console.error(`Usage: cotype-client <spec> <dest>`);
}
