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

export type Method = { name: string; join: Join[] };
export type Join = { type: string; props: string[] };

function visitType(
  typeNode: ts.Node,
  context: ts.TransformationContext,
  joins: Join[]
) {
  function visitor(node: ts.Node): ts.Node {
    if (isMediaRef(node)) {
      return ts.createIntersectionTypeNode([
        node,
        ts.createTypeReferenceNode("Media", undefined)
      ]);
    } else {
      const ref = getContentRef(node);
      const isJoined = joins.some(j => j.type === ref);
      if (ref && isJoined) {
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
  config: Method[]
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
        return visitMethod(
          node,
          context,
          config.find(m => m.name === name),
          root
        );
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
  methodConfig: Method | undefined,
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
      return !methodConfig
        ? undefined
        : ts.createPropertyAssignment(
            "join",
            ts.createObjectLiteral(
              methodConfig.join.map(({ type, props }) =>
                ts.createPropertyAssignment(
                  type,
                  ts.createArrayLiteral(
                    props.map(p => ts.createStringLiteral(p))
                  )
                )
              )
            )
          );
    }

    if (ts.isAsExpression(node)) {
      return ts.createAsExpression(
        ts.visitEachChild(node.expression, visitor, context),
        visitAsType(node.type, context, methodConfig, root)
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
  methodConfig: Method | undefined,
  root: ts.Node
) {
  function visitor(node: ts.Node): ts.Node | undefined {
    if (ts.isPropertySignature(node) && getText(node.name) == "_refs") {
      return undefined;
    }
    if (methodConfig && ts.isTypeReferenceNode(node)) {
      const type = findType(root, getText(node.typeName));
      return visitType(type, context, methodConfig.join);
    }
    return ts.visitEachChild(node, visitor, context);
  }
  return ts.visitEachChild(node, visitor, context);
}

export default function transform(ast: ts.SourceFile, config: Method[]) {
  const result = transformAst(
    ast,
    (node: ts.Node, context: ts.TransformationContext) => {
      return visitRoot(node, context, config);
    }
  );

  const mergeRefs = cg.parseFile(__dirname + "/../src/mergeRefs.ts");

  return cg.printNodes([...result.transformed, ...mergeRefs.statements]);
}
