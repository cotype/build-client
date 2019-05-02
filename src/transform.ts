import ts from "typescript";
import { cg } from "oazapfts";
import {
  getText,
  findType,
  getContentRef,
  createVisitor,
  transformAst,
  isMediaRef
} from "./util";

export type Join = Record<string, string[]>;
export type Joins = Record<string, Join>;

function visitType(
  typeNode: ts.Node,
  context: ts.TransformationContext,
  join: Join
) {
  function visitor(node: ts.Node): ts.Node {
    if (isMediaRef(node)) {
      return ts.createIntersectionTypeNode([
        node,
        ts.createTypeReferenceNode("Media", undefined)
      ]);
    } else {
      const ref = getContentRef(node);
      if (ref && ref in join) {
        return ts.createIntersectionTypeNode([
          node as ts.TypeNode,
          ts.createTypeReferenceNode(ref, undefined)
        ]);
      }
    }
    return ts.visitEachChild(node, visitor, context);
  }
  return ts.visitNode(typeNode, visitor) as ts.TypeNode;
}

/**
 * Find and vist method declarations listed in `joins`.
 */
function visitRoot(
  root: ts.Node,
  context: ts.TransformationContext,
  joins: Joins
) {
  const visit = createVisitor(context);
  return visit(root, (node: ts.Node) => {
    if (ts.isMethodDeclaration(node)) {
      const name = getText(node.name);
      if (name === "_fetchJson") {
        // Patch method to call mergeRefs
        return visit(node, (node: ts.Node) => {
          if (ts.isReturnStatement(node)) {
            return ts.createReturn(
              cg.createCall("mergeRefs", { args: [node.expression!] })
            );
          }
        });
      }
      if (!name.startsWith("_")) {
        return visitMethod(node, context, joins[name], root);
      }
    }
  });
}

/**
 * Remove `join` option and replace it with the given config.
 */
function visitMethod(
  method: ts.MethodDeclaration,
  context: ts.TransformationContext,
  join: Join | undefined,
  root: ts.Node
) {
  function visitor(node: ts.Node): ts.Node | undefined {
    // Visit params and remove empty ones afterwards
    if (ts.isParameter(node)) {
      const transformed = ts.visitEachChild(node, visitor, context);
      const { type } = transformed;
      if (type && ts.isTypeLiteralNode(type)) {
        if (!type.members.length) return undefined;
      }
      return transformed;
    }

    // Remove the `join` parameter:
    if (
      (ts.isBindingElement(node) || ts.isPropertySignature(node)) &&
      /join|_refs/.test(getText(node.name))
    ) {
      return undefined;
    }

    if (
      ts.isShorthandPropertyAssignment(node) &&
      getText(node.name) == "join"
    ) {
      return !join
        ? undefined
        : ts.createPropertyAssignment(
            "join",
            ts.createObjectLiteral(
              Object.entries(join).map(([name, value]) =>
                ts.createPropertyAssignment(
                  name,
                  ts.createArrayLiteral(
                    value.map(v => ts.createStringLiteral(v))
                  )
                )
              )
            )
          );
    }

    if (ts.isAsExpression(node)) {
      return ts.createAsExpression(
        ts.visitEachChild(node.expression, visitor, context),
        visitAsType(node.type, context, join, root)
      );
    }

    return ts.visitEachChild(node, visitor, context);
  }
  const node = ts.visitEachChild(method, visitor, context);
  return node;
}

/**
 * Include joins in the return type.
 */
function visitAsType(
  node: ts.TypeNode,
  context: ts.TransformationContext,
  join: Join | undefined,
  root: ts.Node
) {
  function visitor(node: ts.Node): ts.Node | undefined {
    if (ts.isPropertySignature(node) && getText(node.name) == "_refs") {
      return undefined;
    }
    if (join && ts.isTypeReferenceNode(node)) {
      const type = findType(root, getText(node.typeName));
      return visitType(type, context, join);
    }
    return ts.visitEachChild(node, visitor, context);
  }
  return ts.visitEachChild(node, visitor, context);
}

export default function transform(ast: ts.SourceFile, joins: Joins) {
  const result = transformAst(
    ast,
    (node: ts.Node, context: ts.TransformationContext) => {
      return visitRoot(node, context, joins);
    }
  );

  const mergeRefs = cg.parseFile(__dirname + "/../src/mergeRefs.ts");

  return cg.printNodes([...result.transformed, ...mergeRefs.statements]);
}
