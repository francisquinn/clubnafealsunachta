import type { Plugin } from 'unified';
import type { Root, Element } from 'hast';

export const rehypeLazyImages: Plugin<[], Root, Root> = () => {
  return (tree) => {
    const visit = (node: Element | Root) => {
      if (node.type === 'element' && node.tagName === 'img') {
        if (!node.properties.loading) {
          node.properties.loading = 'lazy';
        }
      }
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'element') {
            visit(child);
          }
        }
      }
    };
    visit(tree);
  };
};

export default rehypeLazyImages;