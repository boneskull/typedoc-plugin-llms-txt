/**
 * Template parsing and slot replacement
 *
 * @packageDocumentation
 */

import fs from 'node:fs';

import type { LlmsTxtContent } from './generator.js';

import {
  renderDeclarations,
  renderHeader,
  renderQuickReference,
  renderSection,
} from './generator.js';

/**
 * Template slot types
 */
export type TemplateSlot =
  | 'declarations'
  | 'header'
  | 'quickReference'
  | 'sections'
  | `section:${string}`;

/**
 * Parses a template file and identifies slots
 *
 * @function
 * @param templatePath - Path to the template file
 * @returns Template content string
 */
export const readTemplate = (templatePath: string): string => {
  return fs.readFileSync(templatePath, 'utf8');
};

/**
 * Finds all slots in a template
 *
 * @function
 * @param template - Template content
 * @returns Array of slot names found
 */
export const findSlots = (template: string): TemplateSlot[] => {
  const slotPattern = /\{\{(\w+(?::\w+)?)\}\}/g;
  const slots: TemplateSlot[] = [];
  let match;

  while ((match = slotPattern.exec(template)) !== null) {
    slots.push(match[1] as TemplateSlot);
  }

  return slots;
};

/**
 * Renders a slot to its content
 *
 * @function
 * @param slot - Slot name
 * @param content - Full llms.txt content
 * @returns Rendered slot content
 */
export const renderSlot = (
  slot: TemplateSlot,
  content: LlmsTxtContent,
): string => {
  switch (slot) {
    case 'declarations':
      return renderDeclarations(content.declarations);

    case 'header':
      return renderHeader(content.header);

    case 'quickReference':
      return renderQuickReference(content.quickReference);

    case 'sections':
      return content.sections.map((s) => renderSection(s)).join('\n\n');

    default:
      // Handle section:CategoryName
      if (slot.startsWith('section:')) {
        const categoryName = slot.slice('section:'.length);
        const section = content.sections.find(
          (s) => s.name === categoryName || s.displayName === categoryName,
        );
        if (section) {
          return renderSection(section);
        }
        return `<!-- Section "${categoryName}" not found -->`;
      }
      return `<!-- Unknown slot: ${slot} -->`;
  }
};

/**
 * Applies content to a template by replacing slots
 *
 * @function
 * @param template - Template content with slots
 * @param content - Content to fill slots with
 * @returns Rendered template
 */
export const applyTemplate = (
  template: string,
  content: LlmsTxtContent,
): string => {
  // Replace each slot pattern with its rendered content
  return template.replace(
    /\{\{(\w+(?::\w+)?)\}\}/g,
    (_, slot: TemplateSlot) => {
      return renderSlot(slot, content);
    },
  );
};

/**
 * Checks if a template file exists and is readable
 *
 * @function
 * @param templatePath - Path to check
 * @returns True if template exists and is readable
 */
export const templateExists = (templatePath: string): boolean => {
  try {
    fs.accessSync(templatePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
};
