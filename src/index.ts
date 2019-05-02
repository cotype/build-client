import { fetchSpec, generateAst } from "oazapfts";
import transform from "./transform";
import inspect from "./inspect";

export async function generateClient(spec: string, configFile: string) {
  const json = await fetchSpec(spec);
  const ast = generateAst(json);
  const possibleJoins = inspect(ast);
  const config = require(configFile);
  const joins = config(possibleJoins);
  return transform(ast, joins);
}
