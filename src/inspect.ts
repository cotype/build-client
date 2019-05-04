import ts from "typescript";
import { getText, createVisitor, transformAst } from "./util";
import { Method, Join } from "./transform";

export default function(ast: ts.Node | ts.Node[]) {
  const methods: Method[] = [];
  transformAst(ast, (root, context) => {
    visitRoot(root, context, methods);
    return root;
  });
  return methods;
}

function visitRoot(
  root: ts.Node,
  context: ts.TransformationContext,
  methods: Method[]
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
            const join: Join[] = [];
            methods.push({ name, join });
            const typeNode = node.type;
            if (!typeNode) return;
            return visit(typeNode, (node: ts.Node) => {
              if (ts.isPropertySignature(node)) {
                const type = getText(node.name);
                const props: string[] = [];
                join.push({ type, props });
                const typeNode = node.type;
                if (!typeNode) return;
                // collect the possible values
                return visit(typeNode, node => {
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
