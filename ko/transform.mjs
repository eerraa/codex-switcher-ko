import ts from 'typescript';
import { parseSource, isDisplayExpression } from './source.mjs';

export function transformSource(code, file, catalog, policy = {}) {
  const { sf, byNode } = parseSource(code, file, policy);
  const runtimeImports = new Set();
  const displayCounts = Object.fromEntries(Object.keys(policy.display?.[file] ?? {}).map(key => [key, 0]));
  const nestedCounts = Object.fromEntries(Object.keys(policy.displayTemplates?.[file] ?? {}).map(key => [key, 0]));
  const chartCounts = Object.fromEntries(Object.keys(policy.reasonCharts?.[file] ?? {}).map(key => [key, 0]));
  const result = ts.transform(sf, [context => root => {
    const factory = context.factory;
    const call = (name, args) => factory.createCallExpression(factory.createIdentifier(name), undefined, args);
    function visit(node) {
      const updated = ts.visitEachChild(node, visit, context);
      if (ts.isExpression(node) && ts.isTemplateSpan(node.parent) && Object.hasOwn(nestedCounts, node.getText(sf))) {
        let owner = node.parent;
        while (owner && !ts.isJsxExpression(owner)) owner = owner.parent;
        if (owner && isDisplayExpression(owner)) {
          nestedCounts[node.getText(sf)]++;
          runtimeImports.add('Message');
          return call('__koMessage', [updated]);
        }
      }
      if (ts.isIdentifier(node) && Object.hasOwn(chartCounts, node.text)) {
        let owner = node.parent;
        while (owner && !ts.isJsxExpression(owner)) owner = owner.parent;
        if (owner && ts.isJsxAttribute(owner.parent) && owner.parent.name.getText(sf) === 'data') {
          chartCounts[node.text]++;
          runtimeImports.add('Reasons');
          return call('__koReasons', [updated]);
        }
      }
      if (isDisplayExpression(node)) {
        const expression = node.expression.getText(sf);
        if (Object.hasOwn(displayCounts, expression)) {
          displayCounts[expression]++;
          runtimeImports.add('Message');
          return factory.updateJsxExpression(updated, call('__koMessage', [updated.expression]));
        }
      }
      if (ts.isStringLiteral(node) && /^zh(?:-CN)?$/.test(node.text) && ts.isCallExpression(node.parent) && /\.toLocale(?:Date|Time)?String$/.test(node.parent.expression.getText(sf)) && node.parent.arguments[0] === node) return factory.createStringLiteral('ko-KR');
      const record = byNode.get(node);
      const translated = record?.role === 'ui' ? catalog[record.source] : undefined;
      if (typeof translated === 'string') {
        if (ts.isTemplateExpression(updated)) {
          runtimeImports.add('Format');
          const values = updated.templateSpans.map(span => factory.createTemplateExpression(factory.createTemplateHead(''), [factory.createTemplateSpan(span.expression, factory.createTemplateTail(''))]));
          return call('__koFormat', [factory.createStringLiteral(translated), factory.createArrayLiteralExpression(values)]);
        }
        const literal = factory.createStringLiteral(translated);
        return ts.isJsxText(node) || ts.isJsxAttribute(node.parent) ? factory.createJsxExpression(undefined, literal) : literal;
      }
      return updated;
    }
    const output = ts.visitNode(root, visit);
    if (!runtimeImports.size) return output;
    if (/\b__ko(?:Format|Message|Reasons)\b/.test(code)) throw new Error(`${file}: reserved localization binding collision`);
    const imports = [...runtimeImports].sort().map(name => factory.createImportSpecifier(false, factory.createIdentifier(name.toLowerCase()), factory.createIdentifier('__ko' + name)));
    const declaration = factory.createImportDeclaration(undefined, factory.createImportClause(false, undefined, factory.createNamedImports(imports)), factory.createStringLiteral('/ko/runtime.mjs'));
    return factory.updateSourceFile(output, [declaration, ...output.statements]);
  }]);
  try {
    return { code: ts.createPrinter().printFile(result.transformed[0]), displayCounts, nestedCounts, chartCounts };
  } finally {
    result.dispose();
  }
}
