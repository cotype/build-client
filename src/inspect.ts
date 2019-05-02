import ts from "typescript";
import { getText, createVisitor, transformAst } from "./util";
import { Joins, Join } from "./transform";

export default function(ast: ts.Node | ts.Node[]) {
  const joins: Joins = {};
  transformAst(ast, (root, context) => {
    visitRoot(root, context, joins);
    return root;
  });
  return joins;
}

function visitRoot(
  root: ts.Node,
  context: ts.TransformationContext,
  joins: Joins
) {
  const visit = createVisitor(context);
  visit(root, (node: ts.Node) => {
    if (ts.isMethodDeclaration(node)) {
      const name = getText(node.name);
      if (!name.startsWith("_")) {
        // visit public method
        return visit(node, node => {
          if (ts.isPropertySignature(node) && getText(node.name) == "join") {
            // the visit the join type
            const join: Join = (joins[name] = {});
            const { type } = node;
            if (!type) return;
            return visit(type, (node: ts.Node) => {
              if (ts.isPropertySignature(node)) {
                const props: string[] = (join[getText(node.name)] = []);
                const { type } = node;
                if (!type) return;
                // collect the possible values
                return visit(type, node => {
                  if (ts.isStringLiteral(node)) {
                    props.push(node.text);
                  }
                });
              }
            });
          }
        });
      }
    }
  });
}
