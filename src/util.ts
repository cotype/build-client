import ts from "typescript";
import pascalCase = require("pascal-case");

export function createVisitor(context: ts.TransformationContext) {
  return (root: ts.Node, cb: (node: ts.Node) => ts.Node | false | void) => {
    const visitor = (n: ts.Node): any => {
      const ret = cb(n);
      if (ret === false) return undefined;
      if (ret === undefined) return ts.visitEachChild(n, visitor, context);
      return ret;
    };
    return ts.visitEachChild(root, visitor, context);
  };
}

export function transformAst(
  ast: ts.Node | ts.Node[],
  cb: (node: ts.Node, context: ts.TransformationContext) => ts.Node
) {
  const transformer = <T extends ts.Node>(
    context: ts.TransformationContext
  ) => (rootNode: T) => {
    return cb(rootNode, context);
  };

  return ts.transform(ast, [transformer]);
}

export function getText(node: ts.Node) {
  if (ts.isIdentifier(node)) return node.escapedText as string;
  throw new Error("Unhandled node type");
}

export function findType(root: ts.Node, name: string) {
  let found;
  ts.forEachChild(root, node => {
    if (ts.isTypeAliasDeclaration(node) && getText(node.name) == name) {
      found = node.type;
      return true;
    }
  });
  return found;
}

function getLiteralValue(node?: ts.Node): string | undefined {
  if (!node) return;
  if (ts.isUnionTypeNode(node)) {
    return node.types.map(getLiteralValue).join();
  }
  if (ts.isLiteralTypeNode(node)) {
    const { literal } = node;
    if (ts.isStringLiteral(literal)) return literal.text;
  }
}

export function getPropertyValue(node: ts.TypeLiteralNode, name: string) {
  const prop = node.members
    .filter(ts.isPropertySignature)
    .find(p => getText(p.name) == name);

  return prop && getLiteralValue(prop.type);
}

export function isMediaRef(node: ts.Node): node is ts.TypeNode {
  return (
    ts.isTypeLiteralNode(node) && getPropertyValue(node, "_ref") === "media"
  );
}

export function getContentRef(node: ts.Node) {
  const name = ts.isTypeLiteralNode(node) && getPropertyValue(node, "_content");
  return name && pascalCase(name);
}
