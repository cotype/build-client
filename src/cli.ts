#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { generateClient } from "./";

async function generate(spec: string, config: string, dest: string) {
  const code = await generateClient(spec, path.resolve(config));
  if (dest) fs.writeFileSync(dest, code);
  else console.log(code);
}

const [, , spec, config, dest] = process.argv;
generate(spec, config, dest);
