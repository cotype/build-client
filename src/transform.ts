import ts from "typescript";
import { cg } from "@cotype/oazapfts";
import {
  getText,
  findType,
  getContentRefs,
  createVisitor,
  transformAst,
  isMediaRef,
  isContentRef
} from "./util";

export type Method = { name: string; join: Join[] };
export type Join = { type: string; props: string[] };

function visitType(
  typeNode: ts.Node,
  context: ts.TransformationContext,
  method?: Method
) {
  function visitor(node: ts.Node): ts.Node {
    if (isMediaRef(node)) {
      return ts.createIntersectionTypeNode([
        ts.createTypeReferenceNode("MediaRef", undefined),
        ts.createTypeReferenceNode("Media", undefined)
      ]);
    } else {
      if (isContentRef(node)) {
        const ref = getContentRefs(node);
        const isJoined = method && method.join.some(j => ref.includes(j.type));
        if (ref.length && isJoined) {
          return ts.createIntersectionTypeNode([
            ts.createTypeReferenceNode("ContentRef", undefined),
            ref.length > 1
              ? ts.createUnionTypeNode(
                  ref.map(r => ts.createTypeReferenceNode(r, undefined))
                )
              : ts.createTypeReferenceNode(ref[0], undefined)
          ]);
        } else {
          return ts.createTypeReferenceNode("ContentRef", undefined);
        }
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
    } else if (ts.isTypeAliasDeclaration(node)) {
      return visit(node, (node: ts.Node) => {
        if (ts.isTypeLiteralNode(node)) {
          return visitType(node, context);
        }
      });
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
    if (ts.isTypeReferenceNode(node)) {
      const type = findType(root, getText(node.typeName));
      if (type) {
        return visitType(type, context, methodConfig);
      }
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
