import { fetchSpec, generateAst } from "oazapfts";
import transform from "./transform";
import inspect from "./inspect";

export async function generateClient(spec: string, configFile: string) {
  const json = await fetchSpec(spec);
  const ast = generateAst(json);
  const methods = inspect(ast);
  const config = require(configFile);
  return transform(ast, config(methods));
}
