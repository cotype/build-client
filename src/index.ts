import { OpenApiSpec } from "@loopback/openapi-v3-types";
import { generateAst } from "oazapfts";
import transform, { Method } from "./transform";
import inspect from "./inspect";

export async function generateClient(
  spec: OpenApiSpec,
  config: (methods?: Method[]) => Method[],
) {
  const ast = generateAst(spec);
  const methods = inspect(ast);
  return transform(ast, config(methods));
}
