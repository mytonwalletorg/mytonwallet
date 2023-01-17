import React from '../../lib/teact/teact';

import type { TeactNode } from '../../lib/teact/teact';

import { compact } from '../../util/iteratees';

export type TextFilter = ('simple_markdown' | 'br');

const SIMPLE_MARKDOWN_REGEX = /(\*\*|__).+?\1/g;

export default function renderText(
  part: TeactNode,
  filters: Array<TextFilter> = ['simple_markdown', 'br'],
): TeactNode[] {
  if (typeof part !== 'string') {
    return [part];
  }

  return compact(filters.reduce((text, filter) => {
    switch (filter) {
      case 'simple_markdown':
        return replaceSimpleMarkdown(text);

      case 'br':
        return addLineBreaks(text);
    }

    return text;
  }, [part] as TeactNode[]));
}

function replaceSimpleMarkdown(textParts: TeactNode[]): TeactNode[] {
  return textParts.reduce<TeactNode[]>((result, part) => {
    if (typeof part !== 'string') {
      result.push(part);
      return result;
    }

    const parts = part.split(SIMPLE_MARKDOWN_REGEX);
    const entities: string[] = part.match(SIMPLE_MARKDOWN_REGEX) || [];
    result.push(parts[0]);

    return entities.reduce((entityResult: TeactNode[], entity, i) => {
      entityResult.push(
        entity.startsWith('**')
          ? <b>{entity.replace(/\*\*/g, '')}</b>
          : <i>{entity.replace(/__/g, '')}</i>,
      );

      const index = i * 2 + 2;
      if (parts[index]) {
        entityResult.push(parts[index]);
      }

      return entityResult;
    }, result);
  }, []);
}

function addLineBreaks(textParts: TeactNode[]): TeactNode[] {
  return textParts.reduce((result: TeactNode[], part) => {
    if (typeof part !== 'string') {
      result.push(part);
      return result;
    }

    const splittenParts = part
      .split(/\r\n|\r|\n/g)
      .reduce((parts: TeactNode[], line: string, i, source) => {
        // This adds non-breaking space if line was indented with spaces, to preserve the indentation
        const trimmedLine = line.trimStart();
        const indentLength = line.length - trimmedLine.length;
        parts.push(String.fromCharCode(160).repeat(indentLength) + trimmedLine);

        if (i !== source.length - 1) {
          parts.push(<br />);
        }

        return parts;
      }, []);

    return [...result, ...splittenParts];
  }, []);
}
